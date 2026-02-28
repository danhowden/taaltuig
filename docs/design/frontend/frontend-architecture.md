# Frontend Architecture - Taaltuig

React SPA for spaced repetition learning with Google OAuth authentication and backend API communication.

---

## Technology Stack

**Core**
- React 18 + TypeScript + Vite

**Styling**
- Tailwind CSS (utility-first)
- shadcn/ui (accessible component library)
- CSS Variables (light/dark theme support)

**State Management**
- React Context (auth, global state)
- TanStack Query (server state, caching, mutations)
- Local state (review session)

**Other**
- React Router (client-side routing)
- @react-oauth/google (authentication)
- localStorage (token storage for MVP)
- MSW (API mocking for development)

---

## Application Structure

```
App Shell
├─ GoogleOAuthProvider
├─ LoadingProvider (global loading state)
│  └─ GlobalLoadingIndicator
├─ AuthContext (user, token, login, logout)
└─ QueryClientProvider (React Query)
   └─ Router
      ├─ / (Landing)
      ├─ /login (Google Sign-In)
      └─ Protected Routes
         ├─ /review (Review Session) ← Core feature
         ├─ /cards (Card Management) ← Phase 3
         └─ /settings (SRS Settings)
```

---

## Pages

### Landing Page (`/`)
Marketing page with value proposition, feature highlights, and CTA to sign in. Static content, no authentication required.

### Login Page (`/login`)
Google OAuth authentication flow. On success, stores JWT token and redirects to `/review`.

### Review Session (`/review`) - Core Feature
Daily flashcard review interface with SRS scheduling.

**Components:**
- `ReviewHeader` - Progress bar and card count (e.g., "5/20")
- `FlashCard` - Display front/back with flip animation, shows explanation when revealed
- `GradeButtons` - Four-button grading: Again (1), Hard (2), Good (3), Easy (4)
- `ReviewComplete` - Congratulations screen when queue is empty
- `EmptyState` - No cards available message

**Interaction Flow:**
1. Fetch queue from API on mount
2. Display first card (front only)
3. User clicks or presses Space to reveal answer
4. User grades with buttons or keys (1-4)
5. Submit grade to API with duration
6. Move to next card, repeat until queue empty

**State:**
- `currentIndex` - Position in queue
- `showAnswer` - Card flip state
- `startTime` - Track review duration per card
- `queue` - Array of cards to review (from React Query)

**Keyboard Shortcuts:**
- Space: Reveal answer
- 1/2/3/4: Grade card (Again/Hard/Good/Easy)

### Settings Page (`/settings`)
Configure SRS parameters (new cards per day, learning steps). Uses form with optimistic updates via React Query.

### Card Management (`/cards`)
Full CRUD interface for flashcards with Anki import capability.

**Components:**
- `CardsTable` - Sortable table with all user cards
- `CardForm` - Create/edit card dialog with validation
- `AnkiImport` - File upload + WebSocket progress tracking
- `CategoryFilter` - Filter cards by category
- `BulkActions` - Delete multiple cards, rename categories

**Features:**
- Create new cards manually (Dutch ↔ English)
- Edit/delete existing cards
- Bulk operations (delete, rename category)
- Import Anki decks (.apkg files)
- Real-time import progress via WebSocket
- Category-based organization
- Search and filtering

**State Management:**
- `useCards()` - React Query hook for card list
- `useCreateCard()` - Mutation for creating cards
- `useUpdateCard()` - Mutation for editing cards
- `useDeleteCard()` - Mutation for deleting cards
- WebSocket connection for import progress

---

## State Management

### Global State (AuthContext)
Manages authentication state across the app:
- `user` - User profile (from Google)
- `token` - JWT token (stored in localStorage)
- `isAuthenticated` - Boolean flag
- `login()` - Store token, fetch profile, navigate to /review
- `logout()` - Clear token and state

Auto-fetches user profile on mount if token exists.

### Global Loading (LoadingContext)
Tracks loading state for all API calls with top-page progress bar:
- `isLoading` - Boolean, true when any API call is in progress
- `startLoading()` - Increment loading counter
- `stopLoading()` - Decrement loading counter
- `GlobalLoadingIndicator` - Top-page progress bar component

Used by `useApiQuery` and `useApiMutation` to automatically show/hide loading state.

### Server State (React Query)
Handles all backend communication with caching and automatic refetching.

**Custom Hooks:**
- `useApiQuery` - Wraps React Query with automatic loading tracking
- `useApiMutation` - Wraps mutations with loading + auto-invalidation

**Query Hooks:**
- `useReviewQueue()` - Fetch daily queue (queryKey: `['review-queue']`)
- `useCards()` - Fetch all cards (queryKey: `['cards']`)
- `useSettings()` - Fetch user SRS settings (queryKey: `['settings']`)

**Mutation Hooks:**
- `useSubmitReview()` - Submit grade, invalidates queue
- `useCreateCard()` - Create card, invalidates cards list
- `useUpdateCard()` - Update card, invalidates cards list
- `useDeleteCard()` - Delete card, invalidates cards list
- `useUpdateSettings()` - Update settings, invalidates settings

**Configuration:**
- Retry: 1 attempt (faster failure feedback)
- staleTime: 0 for queue (always fresh)
- refetchOnWindowFocus: true
- Automatic error handling with toast notifications
- Loading state integrated with LoadingContext

### Local State
Component-level state for UI interactions (flip animation, form inputs, modals, WebSocket connections).

---

## Routing & Protection

**Public Routes:**
- `/` - Landing
- `/login` - Authentication

**Protected Routes:**
All authenticated routes use `<ProtectedRoute>` wrapper that redirects to `/login` if not authenticated.

**Navigation:**
- Post-login → `/review`
- 404 → `/` (catch-all redirect)

---

## Design System

**shadcn/ui Components:**
Button, Card, Progress, Dialog, Toast, Separator, Input, Select, Skeleton

**Theme:**
CSS variables for colors, supports light/dark mode (future).

**Responsive:**
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Review session: single column on mobile, centered card on desktop
- Touch targets: min 44x44px for mobile

**Colors:**
- Again: Red (destructive variant)
- Hard: Orange (outline with custom color)
- Good: Green (default with custom color)
- Easy: Blue (secondary with custom color)

---

## API Integration

**HTTP Endpoints:**
- `GET /api/auth/me` - User profile
- `GET /api/reviews/queue` - Daily review queue
- `POST /api/reviews/submit` - Submit review grade
- `GET /api/settings` - User SRS settings
- `PUT /api/settings` - Update settings
- `GET /api/cards` - List all cards
- `POST /api/cards` - Create new card
- `PUT /api/cards/{id}` - Update card
- `DELETE /api/cards/{id}` - Delete card
- `POST /api/import/upload-url` - Get presigned S3 URL
- `POST /api/import/anki` - Trigger Anki import
- `POST /api/debug/*` - Debug endpoints (dev only)

**WebSocket:**
- `wss://{api-id}.execute-api.{region}.amazonaws.com/prod`
- Used for real-time Anki import progress
- Authenticates with `?token={jwt}` query parameter
- Receives progress updates: `{ step, progress, imported, total }`

**Error Handling:**
- 401 → Auto-logout, redirect to `/login`, clear token
- Network errors → Toast notification, React Query retries
- 400 → Display field-specific validation errors
- 500 → Toast with generic error message

**Auth:**
- HTTP: `Authorization: Bearer <token>` header
- WebSocket: `?token=<token>` query parameter

---

## WebSocket Integration

**Purpose**: Real-time progress updates for Anki deck imports

**Connection**:
```typescript
const ws = new WebSocket(
  `${wsUrl}?token=${encodeURIComponent(token)}`
)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // { step: 'parsing' | 'importing' | 'complete',
  //   progress: 0-100,
  //   imported?: number,
  //   total?: number }
  setProgress(data)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
  toast.error('Connection lost')
}
```

**Flow**:
1. User selects .apkg file
2. Frontend uploads to S3 using presigned URL
3. Frontend connects to WebSocket
4. Frontend triggers import Lambda with connection ID
5. Lambda sends progress updates via WebSocket
6. Frontend displays progress bar
7. On completion, WebSocket closes and cards list refreshes

**Implementation**: See `AnkiImport.tsx` component

## Development Setup

**Environment Variables**:
```bash
VITE_API_BASE_URL=https://{api-id}.execute-api.{region}.amazonaws.com
VITE_WS_BASE_URL=wss://{ws-id}.execute-api.{region}.amazonaws.com/prod
VITE_GOOGLE_CLIENT_ID={client-id}.apps.googleusercontent.com
```

**Project Structure:**
```
src/
├── components/
│   ├── ui/                   # shadcn/ui components (Button, Card, Dialog, etc.)
│   ├── review/               # Review-specific components (FlashCard, GradeButtons)
│   ├── AnkiImport.tsx        # Anki import with WebSocket progress
│   ├── GlobalLoadingIndicator.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   ├── AuthContext.tsx       # Authentication state
│   └── LoadingContext.tsx    # Global loading state
├── hooks/
│   ├── useApiQuery.ts        # React Query wrapper with loading tracking
│   ├── useApiMutation.ts     # Mutation wrapper with auto-invalidation
│   ├── useReviewQueue.ts     # Review queue hook
│   ├── useSubmitReview.ts    # Submit review mutation
│   ├── useCards.ts           # Card CRUD hooks
│   └── use-toast.ts          # Toast notifications
├── lib/
│   ├── api.ts                # API client (fetch wrapper)
│   └── utils.ts              # cn() helper and utilities
├── pages/
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── ReviewSession.tsx
│   ├── CardsPage.tsx         # Card management UI
│   └── SettingsPage.tsx
└── types/
    └── index.ts              # TypeScript type definitions
```

---

## Performance

**Code Splitting:**
Lazy load routes with React.lazy() and Suspense for smaller initial bundle.

**Bundle Target:**
< 200KB initial JS bundle

**Optimization:**
- Tree-shake unused shadcn/ui components
- Monitor with vite-bundle-visualizer
- Image lazy loading (Phase 2+)

---

## Accessibility

**Keyboard Navigation:**
Full keyboard support for review flow (Space, 1-4, Tab, Esc).

**Screen Readers:**
- Semantic HTML (main, nav, article)
- ARIA labels on icon buttons
- Live regions for dynamic content

**Color Contrast:**
WCAG AA minimum (4.5:1), don't rely on color alone for grades (use icons + text).

---

## Testing

**Unit Tests (Vitest):**
- Custom hooks (useAuth, useReviewQueue)
- Utility functions

**Component Tests (React Testing Library):**
- FlashCard rendering and interaction
- GradeButtons click/keyboard
- Form validation

**E2E Tests (Phase 2+):**
Playwright for critical user flows (login → review → grade cards).

---

## Deployment

**Build:**
```bash
pnpm --filter frontend build
# Output: packages/frontend/dist/
```

**Environment Variables:**
```bash
VITE_API_BASE_URL=https://api.taaltuig.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Hosting (AWS):**
- S3 + CloudFront (static assets with HTTPS)
- Route 53 for DNS (optional)

---

## Completed Features

- ✅ Core review session with SRS scheduling
- ✅ Settings management
- ✅ Card CRUD operations
- ✅ Anki deck import with WebSocket progress
- ✅ Category filtering and bulk operations
- ✅ Global loading state with progress bar
- ✅ Google OAuth authentication

## Future Enhancements

**Phase 4:**
- Rich text editor for writing exercises
- AI evaluation and feedback display
- Syntax highlighting for corrections

**Phase 5+:**
- Statistics dashboard (charts, heatmaps, retention curves)
- Insights and grammar pattern learning
- Theme customization (dark mode)
- Offline support (PWA with IndexedDB)
- Audio/image support in cards
- Undo last review
- Animation preferences (reduce motion)
