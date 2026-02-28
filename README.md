# Taaltuig

Personal experiment for learning Dutch my way.

A TypeScript monorepo for a full-stack application with React frontend, AWS Lambda backend, and CDK infrastructure.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: AWS Lambda (Node.js 20)
- **Infrastructure**: AWS CDK
- **Testing**: Vitest + React Testing Library
- **Monorepo**: pnpm workspaces

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- AWS CLI configured (for deployments)

### Installation

```bash
pnpm install
```

### Development

```bash
# Start frontend dev server
pnpm dev

# Run tests in watch mode (TDD)
pnpm --filter frontend test:watch

# Build all packages
pnpm build
```

### Testing

Tests use Vitest with React Testing Library. Follow TDD approach:

```bash
# Watch mode for development
pnpm --filter frontend test:watch

# Run all tests
pnpm test

# Coverage report
pnpm --filter frontend test:coverage

# Interactive UI
pnpm --filter frontend test:ui
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Auto-fix linting issues
pnpm --filter frontend lint:fix

# Format code
pnpm --filter frontend format
```

## Project Structure

```
packages/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── lib/            # Utilities (cn, etc.)
│   │   ├── test/           # Test setup
│   │   └── utils/          # App utilities with tests
│   └── package.json
├── infrastructure/    # AWS CDK
│   ├── bin/          # CDK app entry
│   └── lib/          # Stack definitions
└── lambdas/
    └── hello/        # Example Lambda
        └── src/
```

## Deployment

```bash
# Synthesize CloudFormation
pnpm synth

# Deploy to AWS
pnpm deploy
```

## Coding Standards

- **Style**: Prettier (no semicolons, single quotes, 2 spaces)
- **Linting**: ESLint with TypeScript strict rules
- **Testing**: TDD approach, aim for >80% coverage
- **TypeScript**: Strict mode, explicit return types on exports

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.
