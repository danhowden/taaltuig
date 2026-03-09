# Writing Exercises Design

## Overview
Writing exercises extend Taaltuig from recognition-based learning (flashcard recall) to production-based learning (writing Dutch). Exercises are integrated into the daily review cycle as a second phase after flashcard reviews, following a structured CEFR A1→B2 curriculum with both deterministic and AI-assessed grading.

## Design Principles
- **Production over recognition**: Writing tests deeper knowledge than flashcard recall
- **Accuracy first**: Deterministic checking wherever possible, AI grading only when needed, human review as escape hatch
- **Comprehensive curriculum**: Full CEFR A1→B2 coverage, not just vocabulary reinforcement
- **Layered integration**: Writing practice complements flashcard review, never replaces it
- **Grounded AI assessment**: AI grades against explicit grammar rules and reference answers, not open-ended evaluation

---

## Exercise Types

Five exercise types forming a difficulty gradient:

### 1. Fill-in-the-Blank (deterministic)
```
Prompt:  "Ik ___ naar de winkel"
Answer:  "loop"
Alts:    ["ga", "wandel", "ren"]   (if prompt allows multiple verbs)
Focus:   verb conjugation, articles, pronouns
Levels:  A1–B2 (sentence complexity scales)
```
Machine-checkable with reference answer + alternatives list. Tests one specific grammar point in isolation.

### 2. Word Reordering (deterministic)
```
Prompt:  "winkel / naar / de / loop / Ik"
Answer:  "Ik loop naar de winkel"
Alts:    []  (word order is usually unique in Dutch)
Focus:   Dutch word order (SVO, inversion, subordinate clauses)
Levels:  A1–B1
```
Can accept multiple valid orderings where they exist. Particularly valuable because Dutch word order is a major difficulty for learners.

### 3. Sentence Translation (hybrid)
```
Prompt:  "I walk to the store"
Answer:  "Ik loop naar de winkel"
Alts:    ["Ik wandel naar de winkel", "Ik ga naar de winkel"]
Focus:   full sentence production
Levels:  A1–B2
```
Deterministic for simple sentences. AI fallback validates unexpected-but-valid answers.

### 4. Guided Sentence Writing (AI-assessed)
```
Prompt:  "Write a sentence using 'lopen' in the imperfectum"
Ref:     "Ik liep naar de winkel"
Focus:   specific grammar point, open-ended production
Levels:  A2–B2
```
Constrained prompt but open-ended response. AI grades against rubric + grammar focus.

### 5. Paragraph/Situation Writing (AI-assessed)
```
Prompt:  "Describe your morning routine using at least 3 separable verbs"
Focus:   integration of multiple skills, fluency, coherence
Levels:  B1–B2
```
Tests ability to combine grammar patterns in extended writing. Rich AI feedback.

---

## Exercise Sources

### Card-Linked Exercises
Generated from the user's existing vocabulary cards. When a user has a card for "Ik loop naar de winkel", the system generates:
- Fill-in-blank: `Ik ___ naar de winkel` (mask verb)
- Fill-in-blank: `___ loop naar de winkel` (mask pronoun)
- Word reorder: `winkel / naar / de / loop / Ik`
- Translation: `"I walk to the store"` → write in Dutch

Generated on-demand using templates per exercise type. Reinforces vocabulary through production practice. No separate ExerciseTemplate entity needed — derived from card content.

### Curriculum Exercises
Standalone exercises organized by CEFR level and grammar topic. Curated exercise bank with human-reviewed content. These introduce grammar patterns the user may not have encountered in their cards.

Source materials:
- Open-licensed Dutch teaching materials (NT2 resources, inburgering materials)
- AI-generated exercises grounded in grammar rules, validated through the quality pipeline
- Standard Dutch grammar references (structures and rules, not copyrighted exercises)

---

## Curriculum Architecture

### Skill Tree Structure

```
CEFR Level → Topic Category → Specific Skill → Exercises
```

Example (A1):
```
A1
├── Articles
│   ├── Common de-words
│   ├── Common het-words
│   └── de/het selection rules
├── Present Tense
│   ├── Regular verbs (-en stem pattern)
│   ├── Irregular: zijn, hebben, gaan, komen, doen
│   └── Stem + t rules (jij/hij/zij)
├── Word Order
│   ├── SVO in main clauses
│   ├── Inversion after time/place adverbs
│   └── Yes/no questions and W-questions
├── Pronouns
│   ├── Subject pronouns (ik, jij, hij, zij, wij, jullie, zij)
│   ├── Object pronouns
│   └── Possessive pronouns
├── Basic Vocabulary
│   ├── Numbers and time
│   ├── Family and people
│   └── Daily activities
└── Basic Sentences
    ├── Introductions and greetings
    ├── Asking for directions
    └── Ordering food/drink
```

Each **Specific Skill** defines:
- **Learning objective**: What the learner can do after mastery
- **Prerequisites**: Which skills must be completed first (edges in the DAG)
- **Exercise set**: 10–30 exercises across types 1–5
- **Mastery threshold**: e.g., 80% accuracy over last 10 attempts to "pass"

### CEFR Level Scope

| Level | Grammar Focus | Exercise Types |
|-------|--------------|---------------|
| A1 | Present tense, articles, basic word order, pronouns | Fill-blank, word reorder, simple translation |
| A2 | Past tenses (perfectum/imperfectum), modal verbs, separable verbs, conjunctions | Fill-blank, word reorder, translation, guided writing |
| B1 | Passive voice, relative clauses, conditional, er-constructions, idiomatic expressions | All types including paragraph writing |
| B2 | Subjunctive, complex subordination, register/formality, nuanced vocabulary | All types, emphasis on paragraph/situation writing |

### Curriculum Content Pipeline

**Phase 1: Structure definition (human)**
Define the skill tree manually based on CEFR standards and Dutch grammar references. This is the backbone — topics, prerequisites, learning objectives. One-time effort per CEFR level.

**Phase 2: Exercise generation (AI + validation)**
AI agent takes a skill definition + grammar rules + example patterns and generates exercise templates with correct answers and alternatives. Output is structured JSON. The AI prompt includes explicit grammar rules to ground generation — it's applying rules, not inventing them.

**Phase 3: Multi-layer validation**
```
AI-generated exercise
  → Automated: format validation, Dutch spell check
  → AI review: second model validates against grammar rules
  → Human review: all exercises reviewed before going live
  → Status: draft → validated → active
```

**Phase 4: Ongoing refinement**
- Track per-exercise dispute rate (users flagging incorrect assessments)
- High-dispute exercises pulled for re-review
- User corrections expand the alternatives list
- Periodic curriculum review per CEFR level

---

## Assessment Pipeline

### Deterministic Assessment (types 1–3)

```
User input
  → Normalize (lowercase, trim, handle diacritics, collapse whitespace)
  → Exact match against reference answer? → CORRECT
  → Match against alternatives list? → CORRECT
  → Fuzzy match (Levenshtein ≤ 1)? → ALMOST (show spelling hint)
  → AI fallback: is this a valid answer given the grammar rules? → ACCEPT / REJECT
```

The AI fallback only fires when deterministic checks fail. It validates unexpected-but-potentially-valid answers. Conservative bias: when uncertain, show the user "This might be correct — here's the reference answer" rather than marking wrong.

**Fallback rate tracking**: If >15% of attempts for an exercise hit the AI fallback, the alternatives list needs expanding. Flag for curriculum review.

### AI Assessment (types 4–5)

The AI grades against a structured rubric provided in the prompt:

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

Every AI grading prompt includes:
- The exercise prompt and grammar focus
- The reference answer
- The specific grammar rules being tested
- The rubric above
- Instruction to output structured JSON: `{ score, feedback, errors[], confidence }`

### AI Grading Accuracy Safeguards

1. **Grammar rule grounding**: The AI checks against defined rules included in the prompt, not general knowledge
2. **Reference answer comparison**: Always provided so the AI has a concrete correct example
3. **Confidence scoring**: AI outputs confidence 0–1. Below 0.7 → assessment is flagged as uncertain, user sees "I'm not fully sure — here's what I think" with option to flag
4. **Specific error identification**: AI must identify exactly what's wrong ("'geloopt' → should be 'gelopen'"), not just pass/fail
5. **Known-pair testing**: Before deploying exercises, test the grader against known correct + incorrect answers. Require >95% accuracy on test set.
6. **Audit log**: Every AI assessment stored with full prompt, response, confidence, and user reaction

### Human Review Queue

Any assessment can be flagged by the user via a "Flag for review" button. Flagged items enter a review queue:

```
FlaggedAssessment:
  exercise_id, user_id, user_answer,
  ai_score, ai_feedback, ai_confidence,
  flag_reason (optional user comment),
  review_status: pending | reviewed,
  reviewer_verdict: correct | incorrect | partially_correct,
  reviewer_notes
```

Reviewers see the exercise, user's answer, AI's assessment, and grammar rules. They can:
- Confirm AI assessment (training signal: AI was right)
- Override AI assessment (training signal: AI was wrong, update alternatives)
- Add the user's answer to the alternatives list (expands deterministic checking)

---

## Integration with Review Cycle (Layered Review)

### Daily Session Flow

```
User opens app
  │
  ├─ Phase 1: Flashcard Review (existing system, unchanged)
  │   └─ SRS queue: REVIEW → LEARNING → RELEARNING → NEW
  │
  ├─ Transition: "Flashcards done! Ready for writing practice?"
  │   └─ User can skip or continue
  │
  └─ Phase 2: Writing Practice
      ├─ Card-linked exercises (reinforce today's vocabulary)
      │   Generated from cards reviewed in Phase 1
      │   Types 1–3 (fill-blank, reorder, translate)
      │
      └─ Curriculum exercises (progress through skill tree)
          Selected by adaptive engine based on:
            - Next unlocked skill in curriculum
            - Weak skills needing reinforcement (SRS-scheduled)
            - Exercise type variety
```

### Exercise Scheduling

**Card-linked exercises**: Generated on-the-fly from flashcard reviews. Not independently SRS-scheduled — they appear when their parent card is reviewed. Optional: if the user gets the flashcard right but the writing exercise wrong, the writing exercise can be independently re-scheduled.

**Curriculum exercises**: Dual scheduling:
- **Progression**: Introduce new exercises from the next unlocked skill at a steady rate (configurable, e.g., 5 new exercises/day)
- **Reinforcement**: Exercises the user got wrong are SRS-scheduled for review, using the same SM-2 algorithm as flashcards
- **Mastery gating**: A skill must reach its mastery threshold before the next dependent skill unlocks

### Session Limits

Configurable per user (with sensible defaults):
- `writing_exercises_per_day`: 10 (mix of card-linked + curriculum)
- `new_curriculum_exercises_per_day`: 5
- `max_writing_session_minutes`: 15

---

## Data Model

### New Entities

**ExerciseTemplate** — curated exercise definition (curriculum exercises only)
```
PK: EXERCISE#<exercise_id>
SK: TEMPLATE

exercise_id: string
type: "fill_blank" | "word_reorder" | "sentence_translate" | "guided_write" | "paragraph_write"
cefr_level: "A1" | "A2" | "B1" | "B2"
topic: string              // e.g. "present_tense"
skill: string              // e.g. "regular_verbs"
prompt: string
context?: string           // situation/story context for paragraph exercises
reference_answer: string
alternatives: string[]
grammar_rules: string[]    // explicit rules the AI grader uses
assessment_mode: "deterministic" | "hybrid" | "ai"
difficulty: number         // 1–5 within the skill
version: number
status: "draft" | "active" | "retired"
created_at: string
updated_at: string
```

**GSI for querying exercises by skill:**
```
GSI3PK: CEFR#<level>#<topic>#<skill>
GSI3SK: <difficulty>#<exercise_id>
```

**UserSkillProgress** — mastery tracking per grammar skill
```
PK: USER#<user_id>
SK: SKILL#<cefr_level>#<topic>#<skill>

attempts: number
correct_count: number
mastery_level: number      // 0.0–1.0, computed from recent accuracy
last_practiced: string
unlocked: boolean          // prerequisites met?

// SRS fields for weak skill reinforcement
srs_state: "ACTIVE" | "REVIEW" | "MASTERED"
srs_interval: number
srs_due_date: string
srs_ease_factor: number
```

**WritingAttempt** — individual submission + assessment
```
PK: USER#<user_id>
SK: ATTEMPT#<timestamp>#<exercise_id>

exercise_id: string        // ExerciseTemplate ID or "card-linked:<card_id>:<type>"
exercise_type: string
user_answer: string
score: number              // 0, 2, 3, or 4 (same as flashcard grades)
feedback: string           // human-readable feedback
errors: string[]           // specific errors identified
confidence: number         // AI grader confidence (1.0 for deterministic)
assessment_mode_used: "deterministic" | "ai_fallback" | "ai"
duration_ms: number
flagged: boolean
flagged_reason?: string
```

**GSI for daily attempt counts:**
```
GSI2PK: USER#<user_id>#WRITING#<YYYY-MM-DD>
GSI2SK: <timestamp>
```

**CurriculumPosition** — user's place in the skill tree
```
PK: USER#<user_id>
SK: CURRICULUM

current_level: "A1" | "A2" | "B1" | "B2"
unlocked_skills: string[]     // skill IDs where prerequisites are met
completed_skills: string[]    // skill IDs at mastery threshold
current_skill?: string        // active skill being practiced
exercises_completed_today: number
```

**FlaggedAssessment** — human review queue
```
PK: FLAG#<flag_id>
SK: PENDING                   // changes to REVIEWED#<reviewer_id> after review

GSI: STATUS#PENDING / STATUS#REVIEWED as PK for queue queries

user_id: string
exercise_id: string
user_answer: string
ai_score: number
ai_feedback: string
ai_confidence: number
flag_reason?: string
created_at: string
reviewer_verdict?: "correct" | "incorrect" | "partially_correct"
reviewer_notes?: string
reviewed_at?: string
```

### Existing Entity Changes

**Card** — no changes needed. Card-linked exercises are derived from card content at runtime.

**ReviewItem** — add optional field:
```
writing_exercise_due?: string  // next due date for card-linked writing exercise
writing_exercise_score?: number // last score (for adaptive selection)
```

**UserSettings** — add fields:
```
writing_exercises_per_day: number       // default: 10
new_curriculum_exercises_per_day: number // default: 5
writing_session_enabled: boolean        // default: true
current_cefr_level: "A1" | "A2" | "B1" | "B2"  // default: "A1"
```

---

## API Endpoints

```
# Exercise session
GET    /api/writing/queue          → get today's writing exercises (card-linked + curriculum)
POST   /api/writing/submit         → submit an answer, get assessment back
POST   /api/writing/flag           → flag an assessment for human review

# Curriculum
GET    /api/curriculum/progress    → skill tree with mastery levels
GET    /api/curriculum/skills      → available skills for current level

# Human review (admin/reviewer role)
GET    /api/review-queue           → list flagged assessments
PUT    /api/review-queue/:id       → submit reviewer verdict

# Exercise management (admin/content)
POST   /api/exercises              → create exercise template
PUT    /api/exercises/:id          → update exercise template
GET    /api/exercises?skill=...    → list exercises by skill
```

---

## Phased Implementation

### Phase 1: Card-Linked Fill-in-the-Blank
- Generate fill-in-blank exercises from existing cards (mask verb, article, key word)
- Deterministic assessment with alternatives
- Appears after flashcard review as optional "Writing Practice" section
- Basic UI: prompt display, text input, immediate feedback
- No curriculum, no AI grading yet
- **Validates the UX and core plumbing**

### Phase 2: Curriculum Skeleton + Translation Exercises
- Define A1 skill tree (manual, ~15 skills)
- Source open-licensed NT2/inburgering materials for A1
- AI-generate exercises for A1 skills, human-review all before activation
- Sentence translation with deterministic + AI fallback checking
- Basic skill progress tracking and mastery gating
- **Validates the curriculum model and content pipeline**

### Phase 3: AI-Assessed Writing
- Build rubric-based AI grading pipeline (Bedrock, structured output)
- Guided sentence writing exercises (type 4)
- Confidence scoring + "flag for review" mechanism
- Audit logging for all AI assessments
- Known-pair test suite for grader validation
- **Validates AI grading accuracy**

### Phase 4: Full Curriculum + Paragraph Writing
- Expand to A2, B1, B2 skill trees
- Paragraph/situation writing exercises (type 5)
- Rich AI feedback (multi-dimensional rubric)
- Full coverage tracking with visual progress
- Adaptive exercise selection (balance new topics + weak reinforcement)
- Human review queue UI for flagged assessments
- **Full system operational**

---

## Accuracy Assurance Strategy

### Five Layers of Accuracy

**Layer 1: Curated content** — All exercises human-reviewed before going live. Versioned. Grammar rules explicitly attached to each exercise.

**Layer 2: Deterministic checking first** — Exact match, alternatives list, fuzzy match for typos. AI only fires when these fail.

**Layer 3: Grounded AI assessment** — AI grades against explicit grammar rules and reference answers included in the prompt. Structured rubric output. Confidence scoring.

**Layer 4: User flagging + human review** — Every assessment has a "flag" button. Flagged items enter a review queue. Reviewer verdicts feed back into alternatives lists and grader improvements.

**Layer 5: Analytics and monitoring** — Per-exercise dispute rate tracking. Per-skill accuracy trends. AI fallback rate monitoring. Exercises with anomalous patterns get auto-flagged for curriculum review.

### Breadth Assurance

**Coverage matrix**: Track which CEFR topics have exercises, which topics each user has practiced, and where gaps exist.

**Mastery gating**: Users can't skip topics. Completing a skill requires demonstrated accuracy, not just attempts.

**Adaptive selection**: Daily exercise mix balances new skill progression with weak skill reinforcement. SRS scheduling ensures weak grammar patterns resurface.

**Card-curriculum feedback loop**: When curriculum exercises introduce grammar the user hasn't seen in flashcards, suggest adding relevant vocabulary cards. When flashcard reviews reveal grammar weaknesses, recommend relevant curriculum skills.
