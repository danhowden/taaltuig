# Writing Exercises Design

## Overview

Writing exercises extend Taaltuig from recognition-based learning (flashcard recall) to production-based learning (writing Dutch). Exercises are AI-generated from the user's known vocabulary, stored as a pending pool, and served on demand.

## Design Principles

- **Production over recognition**: Writing tests deeper knowledge than flashcard recall
- **Vocabulary as input, not exercise**: Cards provide the word pool; AI generates meaningful sentences using them
- **Stored, not ephemeral**: Exercises are persisted for quality validation, analytics, and "complete more"
- **Accuracy first**: Deterministic checking wherever possible, AI grading only when needed
- **Layered integration**: Writing practice complements flashcard review, never replaces it

---

## Core Concept: AI-Generated Exercises from Vocabulary

Most cards are single words ("huis"/"house", "lopen"/"to walk"). Directly using card content as exercises produces flashcards with extra steps. Instead:

```
User's known vocabulary (cards)
  → AI generates natural sentences using those words
  → Stored as pending exercises
  → Optionally AI-validated for quality
  → Served to user
```

### Example

**Input vocabulary:** lopen, winkel, elke, dag

**AI generates:**

| Type | Exercise | Reference Answer |
|---|---|---|
| Translation | "I walk to the store every day" | "Ik loop elke dag naar de winkel" |
| Fill-in-blank | "Ik ___ elke dag naar de winkel" | "loop" (alts: "ga", "wandel") |
| Word reorder | "dag / de / naar / elke / winkel / loop / Ik" | "Ik loop elke dag naar de winkel" |
| Guided write | "Write a sentence about a daily habit using 'lopen'" | "Ik loop elke dag naar de winkel" |

One AI call, multiple exercise types, all grounded in known vocabulary.

---

## Exercise Types

Five exercise types forming a difficulty gradient:

### 1. Fill-in-the-Blank (deterministic)
- AI creates a complete Dutch sentence using target vocabulary
- AI selects the word to blank (verb, article, or target word) based on grammar focus
- Provides reference answer + alternatives
- Focus: verb conjugation, articles, pronouns
- Levels: A1-B2 (sentence complexity scales)

### 2. Word Reordering (deterministic)
- AI creates a sentence, then scrambles the word order
- Only generated for sentences where word order is pedagogically interesting (inversion, subordinate clauses)
- Focus: Dutch word order (SVO, inversion, subordinate clauses)
- Levels: A1-B1

### 3. Sentence Translation (hybrid)
- AI creates a natural English sentence incorporating the target vocabulary's meanings
- Provides the Dutch reference translation + alternatives
- Sentence complexity matches user's CEFR level
- Focus: full sentence production
- Levels: A1-B2
- Assessment: deterministic for simple sentences, AI fallback validates unexpected-but-valid answers

### 4. Guided Sentence Writing (AI-assessed)
- AI creates a prompt targeting a specific grammar pattern using a known word
- e.g., "Write a sentence using 'lopen' in the past tense (imperfectum)"
- Provides a reference answer for the AI grader
- Focus: specific grammar point, open-ended production
- Levels: A2-B2

### 5. Paragraph/Situation Writing (AI-assessed)
- AI creates a situational prompt encouraging use of multiple known words
- e.g., "Describe going shopping. Try to use: winkel, kopen, betalen"
- Focus: integration of multiple skills, fluency, coherence
- Levels: B1-B2

---

## Exercise Generation

### Vocabulary Selection

Source: **full card corpus**, not just today's reviews. Weighted by:

| Factor | Weight | Rationale |
|---|---|---|
| Reviewed in last 7-14 days | High | Fresh in memory, reinforce through production |
| Graded Again/Hard recently | High | Weak cards benefit most from practice |
| Due within 3 days | Medium | Upcoming reviews, prime the recall |
| LEARNING state | Medium | Still being learned, stretch via production |
| NEW state | Low (~20%) | Exposure to new words through context |
| High ease, long interval | Low | Already well-known, less value |

### Filtering
- Only include cards where the Dutch word is a content word (not just "de", "het", "ja", "nee")
- Prefer cards that haven't been used in recent exercises (avoid repetition)
- ~20% of target vocabulary from NEW/LEARNING state cards — exposure through context

### Generation Process

1. **Select target vocabulary** per weighting above
2. **Group words** into exercise batches (2-4 words per exercise) that can naturally co-occur
3. **AI generates exercises** — a single Bedrock prompt produces a batch:
   - Input: target vocabulary list with translations, user's CEFR level, exercise types to generate
   - Output: structured JSON with exercises, reference answers, alternatives
   - Each exercise specifies which target words it covers and what grammar it tests
4. **Store as pending** in DynamoDB with `status: pending`
5. **Optional AI validation** — second pass reviews for correctness, difficulty, ambiguity

### User-Requested Generation (from Card View)

Users can trigger exercise generation for a specific card from the card detail view:
- "Generate exercises" button with optional type filter (translation, fill-in-blank, etc.)
- Calls `POST /api/writing/generate` with `{ card_id, exercise_type? }`
- AI generates exercises using that word as the primary target (supplemented with other known vocabulary for context)
- Stored with `source: 'user_requested'` and `priority: 'high'`
- **User-requested exercises are weighted near the top** of the queue, but with some randomization — they'll appear in the first few exercises, not necessarily position 1. This avoids a predictable "always my requested one first" pattern and keeps sessions feeling varied

This lets users drill specific words they want to practice, without waiting for the vocabulary selection algorithm to pick them.

### Generation Lambda: `writing-generate`
- Triggered by: review session completion, pool running low, user requesting "complete more", or user-requested from card view
- Async for pool replenishment, sync for user-requested (user expects immediate result)
- Calls Bedrock (Sonnet) with structured prompt
- Parses response, validates format, stores exercises

### AI Prompt Structure
```
You are generating Dutch language writing exercises for a learner at CEFR level {level}.

Target vocabulary (Dutch → English):
- lopen → to walk
- winkel → store/shop
- kopen → to buy

Generate {n} exercises using these words in natural Dutch sentences.
For each exercise, provide:
- type: one of [translation, fill_blank, word_reorder, guided_write]
- prompt: what the user sees
- reference_answer: the correct answer
- alternatives: other valid answers (list)
- target_words: which vocabulary words this exercises
- grammar_focus: what grammar pattern this tests

Rules:
- Sentences must be natural Dutch, appropriate for {level}
- Use vocabulary in realistic context
- Vary sentence structures and grammar patterns
- For fill_blank: blank a verb, article, or target word
- For word_reorder: only create when word order is non-trivial
- For translation: English prompt should be unambiguous
- For guided_write: constrain the prompt to a specific grammar point
```

### Pool Management

**Replenishment triggers:**
- After review session completes → check pool, generate if < 20 pending
- User taps "complete more" and pool is empty → generate on demand
- Scheduled (optional) — daily generation for active users

**Exercise expiry:**
Pending exercises older than 14 days that haven't been served → mark as `expired`. Fresh generations naturally target the user's current weak areas.

---

## Stored Exercise Model

### WritingExercise Entity

```
PK: USER#<user_id>
SK: EXERCISE#<exercise_id>

exercise_id: string (uuid)
type: ExerciseType
status: 'pending' | 'validated' | 'served' | 'completed' | 'expired' | 'rejected'
source: 'auto' | 'user_requested'  // how it was generated
priority: 'normal' | 'high'        // high = user-requested, served first
prompt: string
reference_answer: string
alternatives: string[]
target_vocabulary: string[]        // card_ids used as input
grammar_focus?: string             // e.g., "past tense", "word order"
cefr_level: string
generated_at: string
served_at?: string
completed_at?: string

// For querying pending exercises
GSI2PK: USER#<user_id>#WRITING_POOL
GSI2SK: <status>#<generated_at>
```

### Exercise Lifecycle

```
[AI generates]
    → pending
        → validated (optional AI review step)
            → served (user sees it)
                → completed (user submitted answer)
        → rejected (AI review found quality issues)
    → expired (14 days without being served)
```

### Card-Exercise Links

To support "show exercises for this card" on the card detail view, a denormalized link item is written at generation time:

```
PK: USER#<user_id>
SK: CARD_EXERCISE#<card_id>#<exercise_id>

exercise_id: string
exercise_type: ExerciseType
exercise_status: string            // mirrors exercise status
prompt: string                     // denormalized for display without join
generated_at: string
```

**Access patterns:**
- "All exercises for card X" → `Query PK=USER#<id>, SK begins_with CARD_EXERCISE#<card_id>`
- Written alongside the exercise at generation time (one link per card per exercise)
- Link status updated only on `completed` (not on `served` — too many writes for a batch). `expired` cleanup can be done lazily or via TTL.

This lets the card detail view show associated exercises without scanning the full exercise pool.

---

## Queue & "Complete More"

### Initial Queue
When user opens `/writing`:
1. Query pending/validated exercises from pool (GSI2)
2. Serve up to `writing_exercises_per_day` (default 10)
3. **Ordering**: user-requested (high priority) exercises are placed randomly within the first 3 positions of the batch. Remaining positions filled from the normal pool. This keeps user-requested exercises near the top without being predictably first.
4. Mark served exercises as `status: served`

### "Complete More"
User finishes their batch and wants more:
1. Check pool for remaining pending/validated exercises
2. Serve next batch
3. If pool is low, trigger background generation

### Cold Start
Users with no vocabulary or < 10 reviewed cards: no writing exercises available. Show message: "Complete some flashcard reviews first to unlock writing practice."

---

## Card Exercises View

Exercises for a card are shown in the cards table using the same pattern as insights: a count column with a hover/click popover showing the list.

### UI: Table Column + Popover

```
│ Front  │ Back  │ Explanation │ Insights │ Exercises │ ...
│ huis   │ house │ ...         │ 3        │ 4         │ ...
```

Clicking "4" opens a popover:

```
┌─ Exercises ──────────────────────────────────┐
│                                              │
│  Translation  "I bought a house last ye…" ✓  │
│  Translation  "The house is on the cor…" ·   │
│  Fill-blank   "Wij hebben een ___ geko…" ·   │
│  Fill-blank   "Het ___ staat op de hoe…" ✗   │
│                                              │
│  [Generate exercises ▾]                      │
│                                              │
└──────────────────────────────────────────────┘
```

### Popover Content
- Shows exercises linked to this card (via `CARD_EXERCISE#` items)
- Each exercise shows: type badge, prompt text (truncated), status icon (pending ·, completed ✓/✗)
- Sorted by most recent first
- "Generate exercises" dropdown button with type options (translation, fill-in-blank, etc.)
- Triggers `POST /api/writing/generate` with `{ card_id, exercise_type? }`
- Loading state during generation, new exercises appear in list

### No Exercises State
- Column shows "—" or "0"
- Popover shows "Generate exercises" CTA

---

## Admin: Exercise Management View

A `/writing/admin` page showing all exercises across all cards, for reviewing what the AI has generated and managing the pool.

### UI

```
┌─ Writing Exercises ──────────────────────────────────────────┐
│                                                              │
│  Filter: [All types ▾] [All statuses ▾]  Sort: [Newest ▾]   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Translation · pending                                 │   │
│  │ "I bought a house last year"                          │   │
│  │ → "Ik heb vorig jaar een huis gekocht"                │   │
│  │ Words: huis, kopen    Grammar: perfectum               │   │
│  │                                    [Reject] [Validate] │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Fill-blank · completed ✓                              │   │
│  │ "Wij ___ naar de winkel"                              │   │
│  │ → "lopen" (alts: gaan, wandelen)                      │   │
│  │ Words: lopen, winkel    Grammar: present tense         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Showing 1-20 of 147          [← Prev] [Next →]             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Features
- **Filter** by exercise type, status (pending/validated/served/completed/expired/rejected), source (auto/user-requested)
- **Sort** by generated date, status, type
- **Exercise detail**: prompt, reference answer, alternatives, target vocabulary, grammar focus
- **Actions**: reject (bad quality), validate (approve for serving), edit alternatives
- **Bulk actions**: reject/validate selected exercises
- **Stats summary**: total by status, by type, pool depth

### API
- `GET /api/writing/exercises` — list exercises with filters (reuse the card-specific endpoint with optional `card_id` param)
- `PUT /api/writing/exercises/:id` — update exercise (status, alternatives)

---

## Assessment Pipeline

### Deterministic Assessment (types 1-3)

```
User input
  → Normalize (lowercase, trim, handle diacritics, collapse whitespace)
  → Exact match against reference answer? → CORRECT
  → Match against alternatives list? → CORRECT
  → Fuzzy match (Levenshtein ≤ 1)? → ALMOST (show spelling hint)
  → Diacritics-only difference? → ALMOST (watch the accents)
  → AI fallback: is this a valid answer? → ACCEPT / REJECT
```

AI fallback only fires when deterministic checks fail. Conservative bias: when uncertain, show "This might be correct — here's the reference answer" rather than marking wrong.

**Fallback rate tracking**: If >15% of attempts for an exercise hit AI fallback, the alternatives list needs expanding. Flag for review.

### AI Assessment (types 4-5)

Grades against a structured rubric:

```
Rubric dimensions:
  1. Grammar correctness (weight: primary — specific to exercise's grammar_focus)
  2. Task completion (did they use the required word/tense/structure?)
  3. Vocabulary appropriateness
  4. Naturalness (would a Dutch speaker phrase it this way?)

Score mapping to SRS grades:
  4 (Easy):  Correct, natural, fully complete
  3 (Good):  Minor issues (spelling, slightly unnatural phrasing)
  2 (Hard):  Grammar errors but shows understanding of the target concept
  0 (Again): Fundamentally wrong, incomplete, or missing the target grammar
```

Every AI grading prompt includes the exercise prompt, grammar focus, reference answer, specific grammar rules, and the rubric. Output: `{ score, feedback, errors[], confidence }`.

### Accuracy Safeguards
1. **Grammar rule grounding** — AI checks against defined rules, not general knowledge
2. **Reference answer comparison** — always provided
3. **Confidence scoring** — below 0.7 = flagged as uncertain
4. **Specific error identification** — "geloopt → should be gelopen", not just pass/fail
5. **Known-pair testing** — test grader against known correct/incorrect answers before deploying
6. **Audit log** — every AI assessment stored with full prompt, response, confidence

### Human Review Queue

Users can flag any assessment. Flagged items enter a review queue:

```
FlaggedAssessment:
  exercise_id, user_id, user_answer,
  ai_score, ai_feedback, ai_confidence,
  flag_reason (optional),
  review_status: pending | reviewed,
  reviewer_verdict: correct | incorrect | partially_correct,
  reviewer_notes
```

Reviewers can confirm AI, override it, or add the user's answer to alternatives.

---

## Integration with Review Cycle

### Session Flow

```
User opens app
  │
  ├─ Phase 1: Flashcard Review (existing system, unchanged)
  │
  ├─ Transition: "Ready for writing practice?" + exercise count badge
  │   └─ User can skip or continue
  │
  └─ Phase 2: Writing Practice
      ├─ Exercises served from pending pool
      ├─ Mix of exercise types
      ├─ "Complete more" option when batch is done
      └─ Pool replenished in background after review
```

### Session Limits

Configurable per user:
- `writing_exercises_per_day`: 10 (initial batch size, "complete more" bypasses this)
- `writing_session_enabled`: true

---

## Data Model

### New Entities

**WritingExercise** — AI-generated exercise (see "Stored Exercise Model" above)

**WritingAttempt** — individual submission + assessment
```
PK: USER#<user_id>
SK: ATTEMPT#<timestamp>#<exercise_id>

exercise_id: string
exercise_type: string
user_answer: string
score: number              // 0, 2, 3, or 4
feedback: string
errors: string[]
confidence: number         // 1.0 for deterministic
assessment_mode_used: 'deterministic' | 'ai_fallback' | 'ai'
duration_ms: number
flagged: boolean
flagged_reason?: string

GSI2PK: USER#<user_id>#WRITING#<YYYY-MM-DD>
GSI2SK: <timestamp>
```

**FlaggedAssessment** — human review queue
```
PK: FLAG#<flag_id>
SK: PENDING

user_id, exercise_id, user_answer,
ai_score, ai_feedback, ai_confidence,
flag_reason?, reviewer_verdict?, reviewer_notes?
```

### Existing Entity Changes

**UserSettings** — fields:
```
writing_exercises_per_day: number       // default: 10
writing_session_enabled: boolean        // default: true
```

---

## API Endpoints

```
# Exercise pool & session
GET    /api/writing/queue          → serve exercises from pending pool
POST   /api/writing/submit         → submit answer, get assessment
POST   /api/writing/generate       → trigger exercise generation (manual or from card view)
GET    /api/writing/exercises      → list exercises (optional ?card_id=<id>, ?status=, ?type= filters)
PUT    /api/writing/exercises/:id  → update exercise (status, alternatives)
POST   /api/writing/flag           → flag an assessment for review

# Admin / review
GET    /api/review-queue           → list flagged assessments
PUT    /api/review-queue/:id       → submit reviewer verdict
```

---

## Phased Implementation

### Phase 1: AI-Generated Translation Exercises
- Vocabulary selection from card corpus (weighted)
- AI generation via Bedrock (Sonnet) → stored pending exercises
- Deterministic assessment (exact, alternatives, fuzzy, diacritics)
- Exercise pool with "complete more"
- Basic UI: prompt, text input, immediate feedback
- **Validates the generation pipeline and stored exercise model**

### Phase 2: Fill-in-Blank + Word Reorder + AI Fallback
- Add fill-in-blank and word reorder to generation prompt
- AI fallback for unexpected-but-valid answers on types 1-3
- Exercise type variety in queue
- **Validates multi-type generation and hybrid assessment**

### Phase 3: AI-Assessed Guided Writing
- Guided sentence writing exercises (type 4)
- Rubric-based AI grading via Bedrock (Sonnet)
- Confidence scoring + "flag for review"
- Human review queue
- **Validates AI grading accuracy**

### Phase 4: Paragraph Writing + Full Polish
- Paragraph/situation writing (type 5)
- Rich multi-dimensional feedback
- Analytics on exercise effectiveness
- Full review queue UI
- **Full system operational**

---

## Open Questions

**Q1: Generation batch size and frequency**
How many exercises per batch? Too few = frequent Bedrock calls. Too many = stale vocabulary.
Suggestion: 20-30 per batch. Regenerate when pool < 20 or after review session.

**Q2: Cost**
Bedrock Sonnet for generation: ~$0.01-0.03 per batch of 20 exercises. At one batch/day/user, ~$0.30-0.90/month per active user.

**Q3: Exercise quality iteration**
How do we improve generation over time? Track which exercises get flagged, have low completion rates, or high AI fallback rates. Feed patterns back into the generation prompt.

**Q4: Curriculum exercises (future)**
The original design included a CEFR skill tree with curated exercises. This complements AI-generated exercises — curriculum provides structured progression, AI-generated provides personalized vocabulary practice. Defer to a future phase.
