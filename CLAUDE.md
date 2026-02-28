# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Working Principles

- **Check understanding**: Ask clarifying questions before making code changes
- **Be concise**: Keep responses brief and to the point
- **Context efficiency**: Use context-saving commands for long operations
- **Refer to design docs**: Check `/docs/design/` before implementing features
- **No unsolicited documentation**: Do NOT create summary docs, migration guides, or completion reports unless explicitly asked. Just do the work and report results concisely in chat.

## Deployment Rules

- **Frontend**: Do NOT deploy automatically. The user runs it locally with `pnpm --filter frontend dev`. Just build to verify changes compile.
- **Backend (Lambdas)**: After making Lambda changes, ASK "Want me to deploy the backend?" before running the deploy command. Never auto-deploy.
- **API Changes**: When adding/modifying endpoints, update `/docs/design/backend/openapi.yaml` to keep it in sync.

## Project Overview

**Taaltuig** - AI-powered Dutch language learning platform using spaced repetition (SRS)

**Key Principles:**
- Understanding over memorization (learn the "why")
- Real-world context (user captures phrases they encounter)
- AI explanations and insights (pinnable grammar patterns)
- Proven SRS methodology (SM-2 for MVP, FSRS consideration for v2)
- Bidirectional learning (Dutch→English AND English→Dutch, independently scheduled)
- No gamification (meaningful metrics, not points/streaks)

**Design Docs:**

⚠️ **DO NOT load these unless specifically needed. Always prefer reading the actual code first.**

**When to consult (in order of priority):**

1. **For product/business questions only:**
   - `/docs/project/definition.md` - Product vision, principles, scope

2. **For API contract questions (after checking code):**
   - `/docs/design/backend/openapi.yaml` - Full API spec with schemas

3. **For architecture questions you can't answer from code:**
   - `/docs/design/backend/system-architecture.md` - Overall AWS architecture
   - `/docs/design/backend/dynamodb-schema.md` - DynamoDB access patterns
   - `/docs/design/frontend/frontend-architecture.md` - React app structure

4. **For SRS algorithm deep-dive (rarely needed):**
   - `/docs/design/backend/srs-engine.md` - SM-2 implementation details

5. **For roadmap/planning:**
   - `/docs/design/phased-roadmap.md` - Completed and future phases

**Instead of reading docs:**
- Read actual Lambda code in `packages/lambdas/<name>/src/`
- Read DynamoDB client in `packages/lambdas/dynamodb-client/src/`
- Read React components in `packages/frontend/src/`
- Use Grep/Glob to find implementation examples

## Commands

**Build & Deploy:**
- `pnpm install` - Install all dependencies
- `pnpm build` - Build all packages (automatically lints lambdas via prebuild)
- `pnpm lint` - Manually lint all packages
- `pnpm synth` - Synthesize CloudFormation templates
- `pnpm --filter infrastructure deploy` - Deploy all stacks to AWS

**Frontend:**
- `pnpm --filter frontend dev` - Dev server (for human use, not agents)
- `pnpm --filter frontend test` - Run tests once
- `pnpm --filter frontend test:coverage` - Coverage report

**Lambda Development:**
- `pnpm --filter @taaltuig/lambda-<name> build` - Build single lambda (auto-lints via prebuild)
- `pnpm --filter @taaltuig/lambda-<name> lint` - Manually lint single lambda
- `pnpm --filter @taaltuig/lambda-<name> test` - Test single lambda
- `pnpm -r --filter '@taaltuig/lambda-*' lint` - Manually lint all lambdas

**Note:** All lambda builds automatically run linting first via `prebuild` hooks. Builds fail if linting errors are found.

## Architecture

**Monorepo structure:**
- `packages/frontend` - React 18 + Vite SPA
- `packages/infrastructure` - AWS CDK stacks
- `packages/lambdas/<name>` - Individual Lambda functions (each is a separate package)

**AWS Stack:**
- CloudFront + S3 → Frontend static assets
- API Gateway (HTTP API v2) → REST endpoints with JWT authorizer
- WebSocket API → Real-time Anki import progress
- Lambda → 20+ serverless functions (Node.js 20)
- DynamoDB → Single-table design (on-demand pricing, ~$1-3/month)
- S3 → Anki deck upload bucket (1-day lifecycle)

**Authentication:**
- Google OAuth2 with API Gateway JWT Authorizer
- No password management
- Frontend stores JWT in localStorage (MVP)

**Lambda structure:**
- Each Lambda under `packages/lambdas/` with own `package.json`
- Uses esbuild for bundling
- CDK references via `lambda.Code.fromAsset(...)`

**Package naming:**
- Frontend: `@taaltuig/frontend`
- Infrastructure: `@taaltuig/infrastructure`
- Lambdas: `@taaltuig/lambda-<name>`
- Shared: `@taaltuig/dynamodb-client` (DB access + SM-2 scheduler)

## Implementation Status

**Backend:** 20+ HTTP endpoints + WebSocket routes. See `packages/infrastructure/lib/stacks/api-stack.ts` for full list.

**Frontend:** Review session, cards management, Anki import, AI insights, AI Lab. See `packages/frontend/src/pages/`.

**SRS Engine:** SM-2 algorithm in `@taaltuig/dynamodb-client`. States: NEW → LEARNING → REVIEW → RELEARNING. Bidirectional (one card → two ReviewItems).

**DynamoDB:** Single table `taaltuig-main`, PK/SK + GSI1/GSI2. See `@taaltuig/dynamodb-client` for access patterns.

## Coding Standards

**Frontend:**
- React 18 + TypeScript, Vite
- Tailwind CSS + shadcn/ui (in `src/components/ui/`)
- ESLint 9, Prettier (no semicolons, single quotes, 2-space)
- Path alias: `@/*` → `src/*`
- Tests alongside source: `*.test.ts` or `*.test.tsx`

**shadcn/ui:**
- Source files copied into project (not npm packages)
- Uses Radix UI primitives
- Use `cn()` utility from `@/lib/utils`
- CSS variables in `src/index.css`
- Add: `npx shadcn@latest add <component>`

**Testing:**
- TDD approach
- Vitest + Happy DOM + React Testing Library
- Aim for >80% coverage
- Use: `test`, `test:coverage`
- **NEVER skip or delete failing tests** - fix them or ask for guidance
- Anki test decks: `/docs/anki-examples/` (Legacy 1 & 2 formats)

**TypeScript:**
- Strict mode
- Explicit return types on exports
- No unused vars (prefix `_` if intentional)

**API Hooks & Global Loading:**
- Use `useApiQuery` / `useApiMutation` wrappers (not raw React Query)
- See `src/hooks/` for examples and patterns

**Loading States:**
- Use the `<LoadingCards />` component (`src/components/review/LoadingCards.tsx`) for page-level loading states (e.g. waiting for a queue to load)
- Do NOT use plain text like "Loading..." — always use the animated card illustration

## Key Design Decisions

- **DynamoDB over RDS**: 10x cheaper (~$1-3/month), no cold starts, trade-off is denormalization
- **HTTP API over REST API**: 70% cheaper, lower latency, native JWT support
- **SM-2 for SRS**: Pluggable IScheduler for future FSRS migration

## Future Phases

- ✅ Phase 1: Core SRS review system (COMPLETE)
- ✅ Phase 2: Anki deck import with WebSocket progress (COMPLETE)
- ✅ Phase 3: Custom card creation UI (COMPLETE)
- 🚧 AI Insights: Generate/validate/review grammar insights (IN PROGRESS)
- Phase 4: Writing exercises + AI evaluation
- Phase 5+: Themes, human review

## Environment Variables

See `.env.example` - copy to `.env` and fill in values.