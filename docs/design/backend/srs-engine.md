# SRS Engine Design

## Overview
The Spaced Repetition System (SRS) engine is the core of Taaltuig's learning algorithm. It schedules card reviews using the SM-2 algorithm while supporting bidirectional learning (Dutch→English and English→Dutch) with independent scheduling.

## Design Principles
- **Pluggable scheduler**: Abstract the algorithm interface to allow future swap to FSRS or other algorithms
- **Bidirectional independence**: Each review direction maintains separate scheduling state (critical because retention differs by direction - recognizing "de kat" ≠ producing "de kat")
- **Full state machine**: Implement complete New/Learning/Review/Relearning states for optimal retention
- **Daily limits**: Respect new card caps to prevent overwhelm

---

## Algorithm: SM-2 (SuperMemo 2)

### Core Parameters
Each review item tracks:
- **interval** (days): Time until next review
- **ease_factor**: Multiplier for interval growth (default: 2.5, min: 1.3)
- **repetitions**: Consecutive successful reviews
- **state**: NEW, LEARNING, REVIEW, RELEARNING
- **step_index**: Current position in learning/relearning steps

### SM-2 Calculation (Review state only)
When a card in REVIEW state is graded:

```
If grade = Again (0):
  repetitions = 0
  interval = 1 day
  ease_factor -= 0.2 (min 1.3)
  state = RELEARNING

If grade = Hard (2):
  repetitions = 0
  interval = interval * 1.2
  ease_factor -= 0.15 (min 1.3)

If grade = Good (3):
  repetitions += 1
  if repetitions == 1:
    interval = 1 day
  elif repetitions == 2:
    interval = 6 days
  else:
    interval = interval * ease_factor

If grade = Easy (4):
  repetitions += 1
  if repetitions == 1:
    interval = 4 days
  else:
    interval = interval * ease_factor * 1.3
  ease_factor += 0.15
```

### Learning Steps
Cards in NEW or RELEARNING states use short intervals before graduating:

**Learning steps** (NEW → REVIEW): `[1m, 10m]`
- Step 0: 1 minute
- Step 1: 10 minutes
- On Good/Easy at final step → Graduate to REVIEW state with 1 day interval

**Relearning steps** (RELEARNING → REVIEW): `[10m]`
- Step 0: 10 minutes
- On Good/Easy at final step → Return to REVIEW state

### Grading in Learning States
```
If grade = Again:
  step_index = 0
  due = now + steps[0]

If grade = Hard:
  step_index = max(0, step_index - 1)
  due = now + steps[step_index]

If grade = Good:
  if step_index < len(steps) - 1:
    step_index += 1
    due = now + steps[step_index]
  else:
    Graduate to REVIEW state
    interval = graduating_interval (1 day)
    ease_factor = 2.5

If grade = Easy:
  Graduate to REVIEW immediately
  interval = easy_interval (4 days)
  ease_factor = 2.5
```

---

## Data Model

### Cards Table
Represents the user-created content (one entry per user submission).

```typescript
interface Card {
  id: string                    // UUID
  user_id: string               // Owner
  front: string                 // Dutch phrase
  back: string                  // English translation
  explanation?: string          // Optional context/notes
  source: 'manual' | 'anki' | 'ai-generated'
  created_at: timestamp
  updated_at: timestamp

  // Metadata
  tags: string[]
  deck_id?: string              // Optional grouping
}
```

### ReviewItems Table
Each Card generates TWO ReviewItems (one per direction) with independent scheduling.

```typescript
interface ReviewItem {
  id: string                    // UUID
  card_id: string               // Foreign key to Card
  user_id: string               // Owner (denormalized for query performance)
  direction: 'forward' | 'reverse'  // forward: Dutch→English, reverse: English→Dutch

  // SM-2 State
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
  interval: number              // Days (fractional for minutes: 0.0007 = 1min)
  ease_factor: number           // Default 2.5, min 1.3
  repetitions: number           // Consecutive successful reviews

  // Learning/Relearning
  step_index: number            // Current position in steps array

  // Scheduling
  due_date: timestamp           // When to show next
  last_reviewed?: timestamp     // Last review time

  created_at: timestamp
  updated_at: timestamp
}
```

### ReviewHistory Table
Audit log of all reviews for analytics and potential algorithm adjustments.

```typescript
interface ReviewHistory {
  id: string
  review_item_id: string
  user_id: string

  grade: 0 | 2 | 3 | 4         // Again, Hard, Good, Easy
  duration_ms: number           // Time spent reviewing

  // State before review
  state_before: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
  interval_before: number
  ease_factor_before: number

  // State after review
  state_after: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
  interval_after: number
  ease_factor_after: number

  reviewed_at: timestamp
}
```

### UserSettings Table
Per-user configuration for SRS behavior.

```typescript
interface UserSettings {
  user_id: string               // Primary key

  // Daily limits
  new_cards_per_day: number     // Default: 20
  max_reviews_per_day?: number  // Optional cap on reviews (null = unlimited)

  // Learning steps (stored as minutes)
  learning_steps: number[]      // Default: [1, 10, 1440] (1m, 10m, 1d)
  relearning_steps: number[]    // Default: [10] (10m)

  // Graduating intervals
  graduating_interval: number   // Days, default: 1
  easy_interval: number         // Days, default: 4

  // SM-2 tuning (advanced)
  starting_ease: number         // Default: 2.5
  easy_bonus: number            // Multiplier for Easy, default: 1.3
  interval_modifier: number     // Global multiplier, default: 1.0

  updated_at: timestamp
}
```

---

## Scheduler Interface (Pluggable Architecture)

To support future algorithm swaps (e.g., FSRS), define a scheduler interface:

```typescript
interface IScheduler {
  // Calculate next review based on grade
  schedule(
    reviewItem: ReviewItem,
    grade: Grade,
    now: timestamp
  ): ScheduleResult

  // Get initial state for new review item
  initializeReviewItem(cardId: string, direction: Direction): ReviewItem
}

interface ScheduleResult {
  state: State
  interval: number
  ease_factor: number
  repetitions: number
  step_index: number
  due_date: timestamp
}

type Grade = 0 | 2 | 3 | 4
type Direction = 'forward' | 'reverse'
type State = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
```

**Implementation classes**:
- `SM2Scheduler` - Default, implements above SM-2 logic
- `FSRSScheduler` - Future implementation (v2)

This allows runtime or per-user scheduler selection without changing the data model.

---

## Queue Generation

### Daily Queue Algorithm

```typescript
function generateDailyQueue(userId: string, now: timestamp): ReviewItem[] {
  const settings = getUserSettings(userId)
  const queue: ReviewItem[] = []

  // 1. Get all due review/learning/relearning items (no limit)
  const dueItems = query(`
    SELECT * FROM review_items
    WHERE user_id = ? AND due_date <= ? AND state != 'NEW'
    ORDER BY due_date ASC
  `, [userId, now])

  queue.push(...dueItems)

  // 2. Count how many NEW items already introduced today
  const newCardsToday = query(`
    SELECT COUNT(*) FROM review_history
    WHERE user_id = ?
      AND reviewed_at >= ?
      AND state_before = 'NEW'
  `, [userId, startOfDay(now)])

  // 3. Add NEW items up to daily limit
  const remainingNewCards = settings.new_cards_per_day - newCardsToday
  if (remainingNewCards > 0) {
    const newItems = query(`
      SELECT * FROM review_items
      WHERE user_id = ? AND state = 'NEW'
      ORDER BY created_at ASC
      LIMIT ?
    `, [userId, remainingNewCards])

    queue.push(...newItems)
  }

  // 4. Shuffle NEW items among due items for variety (optional)
  // Anki intersperses new cards rather than showing them all at once

  return queue
}
```

### Interday vs Intraday Scheduling
- **Interday**: Cards due today or earlier (state = REVIEW, RELEARNING)
- **Intraday**: Learning steps within the same day (state = LEARNING, step_index < final_step)

For MVP, we can handle intraday reviews by:
- Showing them immediately after grading (if due < now + 15min)
- OR deferring to next queue fetch

---

## Review Flow API

### 1. Get Daily Queue
```http
GET /api/reviews/queue
Authorization: Bearer {token}
```

**Response**:
```json
{
  "queue": [
    {
      "review_item_id": "uuid",
      "card_id": "uuid",
      "direction": "forward",
      "front": "de kat",
      "back": "the cat",
      "explanation": "het = the (neuter), de = the (common gender)",
      "state": "REVIEW",
      "due_date": "2024-01-19T10:00:00Z"
    }
  ],
  "stats": {
    "due_count": 15,
    "new_count": 5,
    "learning_count": 3,
    "new_cards_remaining_today": 15
  }
}
```

### 2. Submit Review
```http
POST /api/reviews/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  "review_item_id": "uuid",
  "grade": 3,
  "duration_ms": 4500
}
```

**Response**:
```json
{
  "next_review": "2024-01-26T10:00:00Z",
  "interval_days": 7,
  "state": "REVIEW",
  "ease_factor": 2.5,

  "next_item": {
    // Next card in queue, if available
  }
}
```

### 3. Undo Last Review (Optional, v2)
```http
POST /api/reviews/undo
Authorization: Bearer {token}
```

Restore previous state using ReviewHistory.

---

## Card Creation Flow

When a user creates a card (manually or via import):

```typescript
function createCard(userId: string, front: string, back: string): Card {
  // 1. Create Card entity
  const card = insertCard({ user_id: userId, front, back, ... })

  // 2. Create TWO ReviewItems (bidirectional)
  const forwardItem = createReviewItem(card.id, 'forward', userId)
  const reverseItem = createReviewItem(card.id, 'reverse', userId)

  return card
}

function createReviewItem(cardId: string, direction: Direction, userId: string): ReviewItem {
  const scheduler = new SM2Scheduler()
  const settings = getUserSettings(userId)

  return {
    id: generateUUID(),
    card_id: cardId,
    user_id: userId,
    direction,
    state: 'NEW',
    interval: 0,
    ease_factor: settings.starting_ease,
    repetitions: 0,
    step_index: 0,
    due_date: now(), // NEW cards are immediately available
    created_at: now(),
    updated_at: now()
  }
}
```

---

## Edge Cases & Considerations

### 1. Suspended/Buried Cards (Future)
Anki allows temporarily hiding cards. For MVP, skip this - just support delete.

### 2. Sibling Cards
Both directions of the same card are siblings. Should we prevent showing both in the same session?
**Decision**: Not for MVP - independent scheduling means they may naturally space out.

### 3. Timezone Handling
All timestamps in UTC. "Start of day" determined by user's timezone preference.

### 4. Late Reviews
If user misses several days, don't penalize harshly. Anki uses "fuzz" (random ±5%) to spread out cards. Consider for v2.

### 5. Graduating Early
"Easy" button in LEARNING state graduates immediately to REVIEW with `easy_interval` (4 days default).

### 6. Relearning Graduation
After failing a REVIEW card, user must pass relearning steps to return to REVIEW state. Interval is preserved (or reset based on grade - see SM-2 formula).

---

## Configuration Defaults

```typescript
const DEFAULT_SETTINGS = {
  new_cards_per_day: 20,
  max_reviews_per_day: null,        // unlimited
  learning_steps: [1, 10],          // 1min, 10min (matches Anki default)
  relearning_steps: [10],           // 10min
  graduating_interval: 1,           // 1 day
  easy_interval: 4,                 // 4 days
  starting_ease: 2.5,
  easy_bonus: 1.3,
  interval_modifier: 1.0
}
```

These match Anki defaults for familiarity.

---

## Future Enhancements (Post-MVP)

1. **FSRS scheduler**: Swap in `FSRSScheduler` implementation
2. **Custom card templates**: Support different card types (cloze deletion, image recognition)
3. **Deck-specific settings**: Override global settings per deck
4. **Load balancing**: Distribute reviews more evenly across days
5. **Statistics dashboard**: Retention rate, forecast, heatmaps
6. **Filtered decks**: Temporary custom queues (e.g., "cram mode" for exam prep)
7. **Undo/redo**: Revert recent reviews
8. **Manual rescheduling**: User can override due dates

---

## Testing Strategy

### Unit Tests
- SM-2 calculation correctness (all grade scenarios)
- State transitions (NEW → LEARNING → REVIEW → RELEARNING)
- Graduating conditions
- Daily limit enforcement

### Integration Tests
- Queue generation with mixed states
- Bidirectional independence (forward and reverse don't interfere)
- Timezone edge cases
- Concurrent reviews (if supporting multiple devices)

### Reference Data
Use known Anki decks with scheduling history to validate algorithm parity.

---

## Open Questions

1. **Mobile sync**: How do we handle offline reviews and sync conflicts? (Defer to v2)
2. **Import scheduling**: Should imported Anki cards preserve their scheduling history, or start fresh? (Start fresh for MVP, preserve as option in v2)
3. **Settings UI**: Should users be able to customize learning steps, or use defaults only? (Defaults only for MVP)
