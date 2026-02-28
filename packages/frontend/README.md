# Taaltuig Frontend

React SPA for the Taaltuig language learning platform.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server with mock API
pnpm dev

# Run tests
pnpm test
pnpm test:watch  # Watch mode

# Build for production
pnpm build
```

## Development with Mock Data

The frontend is currently configured to work with **Mock Service Worker (MSW)** for API mocking. This allows you to develop the UI without needing a live backend.

### Mock API Endpoints

All mock handlers are defined in `src/mocks/handlers.ts`:

- `GET /api/auth/me` - Returns mock user profile
- `GET /api/reviews/queue` - Returns queue of 5 mock review items
- `POST /api/reviews/submit` - Simulates review submission and removes item from queue
- `GET /api/settings` - Returns mock user settings
- `PUT /api/settings` - Accepts settings updates

### Mock Data

Mock data is defined in `src/mocks/data.ts`:
- 5 Dutch-English flashcards
- Mix of NEW, LEARNING, and REVIEW states
- Realistic SRS scheduling data

### Mock Authentication

The login page uses a **mock Google OAuth** flow:
- Click "Sign in with Google" to instantly log in
- No real OAuth - just sets a mock JWT token
- When backend is ready, replace with `@react-oauth/google` integration

## Pages Implemented

### Landing Page (`/`)
- Marketing page with value proposition
- Feature highlights
- CTA to sign in or start reviewing

### Login Page (`/login`)
- Mock Google OAuth login
- Redirects to `/review` after login

### Review Session (`/review`) - Protected
- Core SRS review interface
- Flashcard display with flip animation
- Grade buttons: Again (1), Hard (2), Good (3), Easy (4)
- Keyboard shortcuts: Space to reveal, 1-4 to grade
- Progress tracking
- Queue stats display

### Settings Page (`/settings`) - Protected
- Placeholder for SRS configuration
- Will be implemented in Phase 1

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── review/          # Review session components
│   │   ├── FlashCard.tsx
│   │   ├── GradeButtons.tsx
│   │   ├── ReviewHeader.tsx
│   │   ├── ReviewComplete.tsx
│   │   └── EmptyState.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx  # Auth state management
├── hooks/
│   ├── useReviewQueue.ts    # Fetch review queue
│   ├── useSubmitReview.ts   # Submit review grade
│   └── use-toast.ts         # Toast notifications
├── mocks/
│   ├── data.ts          # Mock data definitions
│   ├── handlers.ts      # MSW request handlers
│   └── browser.ts       # MSW browser setup
├── pages/
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── ReviewSession.tsx
│   └── SettingsPage.tsx
├── types/
│   └── index.ts         # TypeScript type definitions
├── App.tsx              # Router and providers setup
└── main.tsx             # Entry point (enables MSW)
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **React Router** - Routing
- **TanStack Query** - Server state management
- **MSW** - API mocking
- **Vitest** - Testing

## Switching to Real Backend

When the backend is ready:

1. Update `src/mocks/handlers.ts` to use real API base URL
2. Or remove MSW initialization from `src/main.tsx`
3. Update `src/contexts/AuthContext.tsx` to use real Google OAuth
4. Set environment variables:
   ```bash
   VITE_API_BASE_URL=https://api.taaltuig.com
   VITE_GOOGLE_CLIENT_ID=your-client-id
   ```

## Features Implemented

✅ Landing page with marketing content
✅ Mock Google OAuth authentication
✅ Protected routes (require login)
✅ Review session with flashcard display
✅ Grade buttons with keyboard shortcuts
✅ Progress tracking and queue stats
✅ Empty state and completion screens
✅ Mock API with realistic data
✅ React Query for server state
✅ Auth context and hooks

## Next Steps (Phase 1)

- Add real Google OAuth integration
- Implement settings page with form
- Connect to real backend API
- Add loading and error states
- Improve animations and transitions
- Add E2E tests with Playwright

## Notes

- MSW service worker is initialized in `src/main.tsx`
- All API requests are intercepted and mocked in development
- Queue state is maintained in-memory for demo purposes
- Real backend will handle queue state via database
