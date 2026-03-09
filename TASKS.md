# TASKS

## Testing (Coverage & Reliability)

Frontend: 61% statements, 82% branches. Lambdas: 21/22 tested.

- [x] Fix broken `ReviewHeader.test.tsx` (stale import after refactor)
- [x] Exclude shadcn/ui from coverage config (vendor code drags down numbers)
- [x] Add tests for `get-metrics` lambda (only untested package)
- [x] Add tests for `useSubmitReview` hook (6% coverage)
- [x] Add tests for `useReviewQueue` hook (15% coverage)
- [ ] Fix pre-existing `ProtectedRoute.test.tsx` failure (2 tests)

## AI Insights (In Progress ~85%)

Backend and review UI are functional. Missing UX integration points.

- [x] Generate insights Lambda (Claude Sonnet 4.5 via Bedrock)
- [x] Validate insights Lambda (Claude Haiku 4.5 via Bedrock)
- [x] Human review endpoint (approve/reject/edit)
- [x] Insights queue endpoint
- [x] Metrics endpoint (CloudWatch)
- [x] Clear insights debug endpoint
- [x] DynamoDB schema (CardInsight type, denormalized in ReviewItem)
- [x] Frontend InsightsReviewPage (tabbed: human review / AI review / all)
- [x] Frontend insight hooks (useInsightsQueue, useGenerateInsights, etc.)
- [x] API client methods for all insight endpoints
- [x] "Generate Insights" button in cards list/detail UI
- [x] Batch generate UI (select cards → generate)
- [x] Display approved insights during review session
- [ ] Trigger validation from insights review page
- [ ] Metrics/stats display on insights review page
- [ ] Settings UI for `proficiency_level` and `show_unreviewed_insights`
- [ ] Auto-generate insights on Anki import
- [ ] Generation metrics tracking (only validation is tracked)
- [ ] Error recovery / retry for failed generations

## Phase 4: Writing Exercises + AI Evaluation (Not Started)

No code exists for this phase.

- [ ] Design data model (WritingPrompt, WritingSubmission, WritingFeedback)
- [ ] DynamoDB schema additions (PK/SK patterns, GSI for due exercises)
- [ ] `generate-writing-prompts` Lambda (create prompts from vocabulary)
- [ ] `get-writing-queue` Lambda (fetch prompts due for practice)
- [ ] `submit-writing-exercise` Lambda (AI evaluation via Bedrock)
- [ ] `get-writing-feedback` Lambda
- [ ] API routes in api-stack.ts
- [ ] Frontend: Writing exercise page (prompt display + text editor)
- [ ] Frontend: Writing feedback display (corrections, suggestions, grade)
- [ ] Frontend: Writing history/progress view
- [ ] SRS integration (schedule writing prompts like review items)

## Phase 5+: Future Features (Not Started)

### Progress & Analytics
- [ ] Long-term analytics dashboard (vocabulary growth, retention rates)
- [ ] Per-category performance breakdown
- [ ] Practice time tracking
- [ ] Visual progress charts

### Structured Exercises
- [ ] Fill-in-the-blank exercises
- [ ] Sentence construction exercises
- [ ] Multiple choice (if needed)

### Context/Theme System
- [ ] Weekly/ongoing themes (travel, family, etc.)
- [ ] Theme-specific prompts and exercises

### Human Review Integration (v2)
- [ ] Flag incorrect AI responses
- [ ] Optional human tutor evaluation
- [ ] Community validation mechanisms
