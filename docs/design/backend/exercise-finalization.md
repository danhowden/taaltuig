# Exercise Feature Finalization

Status: **In Progress** (2026-03-22)

Two workstreams to bring the writing exercise feature to production quality.

---

## Workstream 1: CEFR Progression & Topic Tracking

**Problem**: Exercises are generated at a hardcoded A1-A2 level with no topic structure. There's no way to track what a user has practiced, target specific grammar topics, or progress through CEFR levels.

**Goal**: A structured CEFR curriculum that guides exercise generation and tracks user progression from A1 through C2.

### 1.1 Define CEFR Topic Curriculum

- Define a data structure mapping CEFR levels (A1→C2) to grammar topics and vocabulary themes
- Each topic has: id, level, name, description, grammar_points[], example_vocabulary_themes[]
- Examples:
  - A1: greetings, numbers, daily routine, articles (de/het), present tense, basic word order
  - A2: past tense (perfectum), modal verbs, prepositions, shopping/travel/health vocabulary
  - B1: subordinate clauses, conditional, passive voice, word order in complex sentences
  - B2: subjunctive, idiomatic expressions, formal/informal register
  - C1/C2: nuanced grammar, stylistic variation, academic/professional Dutch

### 1.2 User Progress Tracking

- New DynamoDB entity: `UserCEFRProgress` tracking topic completion and mastery per level
- Fields: user_id, level, topic_id, exercises_completed, exercises_correct, mastery_score, last_practiced
- Mastery threshold: e.g., 80% correct over 10+ exercises → topic mastered

### 1.3 Wire Progression into Generation

- Generation prompt receives: user's current CEFR level, topics needing practice (low mastery or untouched), topics already mastered (avoid over-drilling)
- Exercise generation targets specific topics rather than generic "A1-A2"
- Each generated exercise tagged with topic_id + cefr_level (currently `cefr_level` exists in the type but is never set)

### 1.4 Auto-Advancement

- When sufficient topics at a level reach mastery → suggest advancement to next level
- Update `proficiency_level` in UserSettings (currently static, never updated)
- UI: progression dashboard showing level overview, topic mastery, suggested next topics

---

## Workstream 2: Validation Pipeline Hardening

**Problem**: Exercises are still being created incorrectly. The AI validation pass is the only quality gate, and it has known failure modes.

**Goal**: Reliable exercise quality through deterministic validation layered on top of AI generation.

### 2.1 Deterministic Pre-Storage Validation

Add programmatic checks before storing exercises (run after AI generation, before/alongside Haiku validation):

- **fill_blank**: Verify the reference answer + blank reconstruct a valid sentence. Check de/het ambiguity against a known het-word list. Reject conjugation blanks for wij/jullie subjects.
- **word_reorder**: `Set` comparison — every word in prompt must appear in reference_answer and vice versa (case-insensitive). Reject mismatches without needing AI.
- **translation**: Verify reference_answer is actually Dutch (basic heuristic: contains common Dutch words, doesn't match the English prompt).
- **All types**: Reject if reference_answer is empty, prompt is empty, or alternatives contain the reference_answer as a duplicate.

### 2.2 Remove Unsafe Fallbacks

- Current behavior: if Haiku validation response can't be parsed, all exercises pass through (line 335 of writing-generate)
- Change to: reject the entire batch on parse failure, log error, and retry once. If retry fails, store nothing.

### 2.3 Schema Validation of AI Output

- Validate the generated JSON against a strict schema before processing
- Required fields: type (enum), prompt (non-empty string), reference_answer (non-empty string), alternatives (string[]), target_words (string[]), grammar_focus (string)
- Reject individual exercises that fail schema validation

### 2.4 Set cefr_level on Exercises

- `buildExerciseEntities()` currently doesn't populate `cefr_level`
- Set it from the user's proficiency_level (or from the topic's level once workstream 1 is done)

### 2.5 Wire exercise_type Filter

- `_exerciseType` is parsed from the generate request but unused
- Pass it through to the AI prompt so users can request specific exercise types from the card popover

### 2.6 Update openapi.yaml

- Document all 5 writing endpoints that are currently missing from the API spec
