# Taaltuig - Phased Development Roadmap

## Overall Progress

- ✅ **Phase 1**: Core SRS review system (COMPLETE)
- ✅ **Phase 2**: Anki import with real-time progress (COMPLETE)
- ✅ **Phase 3**: Card management UI (COMPLETE)
- ⏳ **Phase 4**: Writing exercises + AI evaluation (NEXT)
- 🔮 **Phase 5+**: Insights, analytics, themes

**Current Status**: Production-ready through Phase 3. Backend has 18 Lambda functions (16 packages + 2 inline handlers), DynamoDB storage, HTTP + WebSocket APIs.

## Phase 1: MVP - Core SRS Flashcard System ✅ COMPLETE
**Goal**: Functional web app with spaced repetition flashcards and essential backend

**Status**: Deployed and operational

### Frontend
- Basic flashcard review interface
  - **Bidirectional**: Show Dutch→English OR English→Dutch (each direction scheduled independently)
  - Reveal back (translation + optional explanation)
  - Grade buttons: **Again, Hard, Good, Easy** (4-button system)
- Review queue display
  - Cards due today (review + learning states)
  - New cards (respecting daily limit)
  - Stats: due count, new remaining
- Simple navigation

### Backend
- **Auth**: User accounts, login/logout, session management
- **Database**:
  - Users table
  - **Cards** table (user-created content: front, back, explanation)
  - **ReviewItems** table (scheduling state - 2 per card for bidirectional)
  - **ReviewHistory** table (audit log of all reviews)
  - **UserSettings** table (daily limits, learning steps)
- **SRS Engine**:
  - **SM-2 algorithm** implementation (pluggable architecture for future FSRS)
  - **Full state machine**: NEW → LEARNING → REVIEW → RELEARNING
  - **Learning steps**: 1min, 10min (matches Anki default)
  - **Daily new card limits**: Default 20/day
  - Schedule next review based on grade
  - Generate daily review queue (due items + new items up to limit)
- **API**: Endpoints for auth, queue generation, review submission

### Data Model (Initial)
```
User: id, google_sub, email, name, picture_url, created_at, last_login

Card: id, user_id, front, back, explanation, source, tags, deck_id, created_at

ReviewItem: id, card_id, user_id, direction (forward|reverse),
            state (NEW|LEARNING|REVIEW|RELEARNING),
            interval, ease_factor, repetitions, step_index,
            due_date, last_reviewed, created_at

ReviewHistory: id, review_item_id, user_id, grade,
               state_before, state_after, interval_before, interval_after,
               ease_factor_before, ease_factor_after,
               duration_ms, reviewed_at

UserSettings: user_id, new_cards_per_day, learning_steps, relearning_steps,
              graduating_interval, easy_interval, starting_ease, updated_at
```

### Key Features
- **Bidirectional learning**: One card → two independent review items
- **Daily limits**: Prevent overwhelm with new card caps
- **Learning phases**: Short intervals before graduating to long-term review
- **Full SM-2**: Proper ease factor adjustments, relearning on failure

### Tech Stack (Implemented)
- Frontend: React 18 + Vite + TypeScript
- Backend: AWS Lambda + HTTP API Gateway v2 + WebSocket API
- Database: DynamoDB (single-table design)
- Auth: Google OAuth2 + JWT Authorizer
- Storage: S3 for file uploads

---

## Phase 2: Anki Deck Import ✅ COMPLETE
**Goal**: Allow users to import existing Anki decks

**Status**: Deployed with WebSocket progress tracking

### Features (Implemented)
- ✅ File upload with presigned S3 URLs
- ✅ .apkg parser using `anki-reader` library
- ✅ Anki notes → Taaltuig Cards mapping
- ✅ **WebSocket real-time progress tracking**
- ✅ Bulk card creation in batches
- ✅ Automatic bidirectional ReviewItems
- ✅ Category assignment from deck name
- ✅ Security: file size limits, 1-day S3 lifecycle

### Implementation Details
- S3 bucket for temporary file storage
- WebSocket API for progress updates
- Lambda with 5-minute timeout + 512MB memory
- Progress reported every 10 cards
- Cards start as NEW (scheduling not preserved)

---

## Phase 3: Custom Card Creation ✅ COMPLETE
**Goal**: Users can create their own flashcards

**Status**: Full CRUD UI with category management

### Features (Implemented)
- ✅ Create cards manually (Dutch ↔ English)
- ✅ Edit existing cards
- ✅ Delete cards (with confirmation)
- ✅ Bulk delete operations
- ✅ Category filtering
- ✅ Rename categories across all cards
- ✅ Automatic bidirectional ReviewItems
- ✅ Cards table with sorting
- ✅ Search and filtering

### Backend Endpoints
- `POST /api/cards` - Create new card
- `GET /api/cards` - List all cards
- `PUT /api/cards/{id}` - Update card
- `DELETE /api/cards/{id}` - Delete card
- `PUT /api/categories/rename` - Rename category

---

## Phase 4: Writing Exercises + AI Evaluation
**Goal**: Long-form writing practice with AI feedback

### Frontend
- Writing prompt display
- Text editor for user responses
- Submit for evaluation
- Display AI feedback (corrections, suggestions, grade)

### Backend
- Writing prompts database
- AI integration (OpenAI/Anthropic API)
  - Generate prompts
  - Evaluate writing quality
  - Provide constructive feedback
- Store writing submissions and feedback

### SRS Integration
- Writing prompts enter review queue
- Schedule based on performance
- Track writing progress separately

---

## Phase 5+: Future Features
**Prioritization TBD**

### Insight System
- AI-generated grammar insights from user's cards
- Separate SRS queue for insights
- Pin/save key learnings

### Context/Theme System
- Weekly or ongoing themes (travel, family, etc.)
- Customize content without changing core curriculum
- Theme-specific prompts and exercises

### Structured Exercises
- Fill-in-the-blank
- Sentence construction
- Multiple choice (if needed)

### Progress Tracking
- Vocabulary size metrics
- Practice time tracking
- Consistency streaks (non-punitive)
- Visual progress charts

### Human Review Integration (v2)
- Flag incorrect AI responses
- Optional human tutor evaluation
- Community validation mechanisms

---

## Key Architectural Decisions Made

**Database**: DynamoDB with single-table design
- Cost: ~$1-3/month vs $20+/month for RDS
- Performance: Sub-10ms queries, auto-scaling
- Trade-off: More complex access patterns, data denormalization

**API Architecture**: HTTP API v2 + WebSocket
- HTTP API for REST endpoints (70% cheaper than REST API)
- WebSocket for real-time progress (Anki import)
- JWT authorizer for authentication

**Frontend**: React 18 + Vite + shadcn/ui
- Global loading state (LoadingContext)
- React Query for server state
- Custom useApiQuery/useApiMutation hooks

**Deployment**: Single production stack
- 3 CDK stacks: database, api, frontend
- Manual deployment via `pnpm deploy`
- CloudWatch for monitoring

## Architectural Principles
- **Serverless-first**: Lambda + DynamoDB for minimal ops overhead
- **Cost-optimized**: Pay-per-request pricing, no idle costs
- **Modularity**: Each phase independently deployable
- **User ownership**: Users own their data, can export/delete
- **AI-ready**: Data model supports future AI features
