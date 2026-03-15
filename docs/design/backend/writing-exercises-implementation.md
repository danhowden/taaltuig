# Writing Exercises — Implementation Plan

Companion to [writing-exercises.md](./writing-exercises.md). Breaks down the implementation into concrete work items.

---

## Phase 1: AI-Generated Translation Exercises

**Goal**: AI generates translation exercises from user's vocabulary. Stored exercise pool. Deterministic assessment. "Complete more" option.

### 1.1 Backend — Exercise Generation

- [ ] Create `packages/lambdas/writing-generate/` Lambda
  - Selects target vocabulary from user's card corpus (weighted by recency, difficulty, state)
  - Filters out trivial words (articles, yes/no, single-character)
  - Groups words into batches of 2-4 for sentence generation
  - Calls Bedrock (Sonnet) with structured prompt → batch of translation exercises
  - Parses and validates AI response
  - Stores exercises as `status: pending` in DynamoDB
- [ ] Vocabulary selection logic in `dynamodb-client`:
  - `getVocabularyForGeneration(userId)` — query ReviewItems, weight by recency/grade/state
  - Include ~20% NEW/LEARNING cards as stretch words
  - Exclude cards already used in recent pending exercises
- [ ] AI prompt template for translation exercise generation
- [ ] Tests: vocabulary selection, prompt construction, response parsing

### 1.2 Backend — Stored Exercise Model

- [ ] Add `WritingExercise` entity type to `dynamodb-client/src/types.ts`
  - Fields: exercise_id, type, status, source, priority, prompt, reference_answer, alternatives, target_vocabulary, grammar_focus, cefr_level, generated_at, served_at, completed_at
  - source: 'auto' | 'user_requested'
  - priority: 'normal' | 'high' (user-requested = high, placed randomly within first 3 positions)
  - Status lifecycle: pending → validated → served → completed (+ expired, rejected)
- [ ] Add card-exercise link items:
  - `SK: CARD_EXERCISE#<card_id>#<exercise_id>` — written at generation time
  - Denormalized: exercise_id, type, status, prompt, generated_at
  - Enables "show exercises for this card" queries
- [ ] DynamoDB client methods:
  - `storeExercises(userId, exercises[])` — batch write pending exercises + card-exercise links
  - `getExercisePool(userId, limit)` — query pending/validated exercises (GSI2), shuffle high-priority into first 3 positions
  - `getExercisesForCard(userId, cardId)` — query card-exercise links
  - `markExercisesServed(userId, exerciseIds[])` — update status
  - `markExerciseCompleted(userId, exerciseId)` — update status + card-exercise link
  - `getExercisePoolCount(userId)` — count pending exercises for pool threshold
  - `expireOldExercises(userId)` — mark stale exercises as expired
- [ ] GSI2 pattern: `USER#<userId>#WRITING_POOL` / `<status>#<generated_at>`

### 1.3 Backend — Queue & Submission

- [ ] Update `writing-queue` Lambda:
  - Read from exercise pool instead of generating at runtime
  - Serve up to `writing_exercises_per_day` pending/validated exercises
  - Mark served exercises
  - Return pool stats (available, served today, can complete more)
  - If pool is low, trigger `writing-generate` asynchronously
- [ ] Update `writing-submit` Lambda:
  - Look up exercise from DynamoDB (server-side reference answer, not from frontend)
  - Run assessment pipeline
  - Store WritingAttempt
  - Mark exercise as completed
  - Return assessment result
- [ ] Add `POST /api/writing/generate` endpoint (manual trigger)
- [ ] Add routes to `api-stack.ts`

### 1.4 Backend — Assessment (mostly exists)

- [ ] Keep existing `TranslationAssessor` from `assessor.ts`
- [ ] Update to read reference_answer from stored exercise, not from request body
- [ ] Tests for edge cases

### 1.5 Frontend — Updates

- [ ] Update `useWritingSession` to handle "complete more":
  - After completion, show "Complete more" button if pool has remaining exercises
  - Fetch next batch on click
- [ ] Update `WritingSession.tsx`:
  - "Complete more" UI at session end
  - Pool count indicator
- [ ] Update sidebar badge to reflect pool availability
- [ ] Update ReviewComplete CTA — trigger generation after review, show count when ready
- [ ] Card exercises column + popover (same pattern as insights):
  - Add "Exercises" column to `CardRow` showing count
  - `CardExercisesPopover` component with hover/click popover
  - Fetches exercises via `GET /api/writing/exercises?card_id=<id>`
  - Shows exercise list: type badge, prompt text (truncated), status icon (pending/completed ✓/✗)
  - "Generate exercises" dropdown button with type options
  - Calls `POST /api/writing/generate` with `{ card_id, exercise_type? }`
  - Loading state during generation, new exercises appear in popover
  - Queue ordering: user-requested exercises placed randomly within first 3 positions of next writing session
- [ ] Admin exercise management page (`/writing/admin`):
  - List all exercises with filters (type, status, source) and pagination
  - Exercise cards showing prompt, reference answer, alternatives, target words, grammar focus
  - Actions: reject, validate, edit alternatives
  - Bulk select + bulk reject/validate
  - Stats summary (count by status, by type, pool depth)
  - `GET /api/writing/exercises` (with filter query params)
  - `PUT /api/writing/exercises/:id` (update status/alternatives)
- [ ] Tests

### 1.6 Infrastructure

- [ ] `writing-generate` Lambda definition in `api-stack.ts`
- [ ] Bedrock access (Sonnet model) for writing-generate Lambda
- [ ] API route for manual generation trigger
- [ ] Consider EventBridge rule for post-review generation trigger

---

## Phase 2: Fill-in-Blank + Word Reorder + AI Fallback

**Goal**: Multiple exercise types. AI fallback for unexpected valid answers.

### 2.1 Multi-Type Generation
- [ ] Expand AI prompt to generate fill-in-blank and word reorder exercises
- [ ] Update exercise parsing for new types
- [ ] Exercise type variety in queue (don't serve 10 of the same type)

### 2.2 Fill-in-Blank UI
- [ ] `FillBlankExercise` component: sentence with blank, text input for missing word
- [ ] Assessor: single-word matching with alternatives

### 2.3 Word Reorder UI
- [ ] `WordReorderExercise` component: draggable/tappable word tiles
- [ ] Assessor: exact word order matching

### 2.4 AI Fallback
- [ ] Extend assessor: when deterministic fails → call Bedrock (Haiku) to validate
- [ ] If valid → accept + add to alternatives list (background update)
- [ ] Track fallback rate per exercise

---

## Phase 3: AI-Assessed Guided Writing

**Goal**: Open-ended sentence writing with rubric-based AI grading.

### 3.1 AI Grading Pipeline
- [ ] Rubric-based grading prompt (grammar, task completion, naturalness)
- [ ] `writing-assess-ai` Lambda — Bedrock (Sonnet)
- [ ] Confidence scoring (< 0.7 = uncertain)
- [ ] Known-pair test suite for grader validation

### 3.2 Guided Write UI
- [ ] Larger text input, "Checking..." spinner
- [ ] Multi-dimensional feedback display
- [ ] "Flag for review" button

### 3.3 Human Review Queue
- [ ] `POST /api/writing/flag`
- [ ] `GET /api/review-queue`, `PUT /api/review-queue/:id`
- [ ] Simple admin UI

---

## Phase 4: Paragraph Writing + Polish

**Goal**: Paragraph exercises. Analytics. Full review system.

- [ ] Paragraph/situation writing exercises (type 5)
- [ ] Rich AI feedback with inline error highlights
- [ ] Exercise effectiveness analytics
- [ ] Full review queue UI
- [ ] Exercise quality iteration based on flag/fallback rates

---

## Infrastructure Summary

| Phase | New Lambdas | DynamoDB Changes | Other |
|---|---|---|---|
| 1 | writing-generate | WritingExercise entity, GSI2 pool pattern | Bedrock access (Sonnet), update writing-queue + writing-submit |
| 2 | (extend writing-submit) | — | Bedrock access (Haiku for fallback) |
| 3 | writing-assess-ai | FlaggedAssessment entity | 3 new API routes |
| 4 | (extend existing) | — | Admin UI |

## Cost Estimate

- Bedrock Sonnet generation: ~$0.01-0.03 per batch of 20 exercises
- Bedrock Haiku fallback: ~$0.001 per call
- Bedrock Sonnet grading (Phase 3): ~$0.01-0.03 per call
- At 1 batch/day + 10 exercises/day with ~30% needing AI: ~$0.30-0.90/month per active user
