/* eslint-disable react-refresh/only-export-components */
import { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppLayout } from '@/components/AppLayout'
import { ReviewSession } from '@/pages/ReviewSession'
import { SettingsPage } from '@/pages/SettingsPage'
import { CardsPage } from '@/pages/CardsPage'
import { DebugPage } from '@/pages/DebugPage'
import { InsightsReviewPage } from '@/pages/InsightsReviewPage'
import { LandingPage } from '@/pages/LandingPage'
import { Toaster } from '@/components/ui/toaster'
import userEvent from '@testing-library/user-event'

// Stub LoginPage to avoid GoogleOAuthProvider dependency
function LoginPageStub() {
  return <div data-testid="login-page">Login Page</div>
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface RenderAppOptions {
  initialEntries?: string[]
  authenticated?: boolean
}

/**
 * Full-app render with MemoryRouter, all providers, full route tree, and Toaster.
 * Sets localStorage auth_token when authenticated=true (default).
 * AuthProvider resolves user via MSW GET /api/auth/me.
 */
export function renderApp(options: RenderAppOptions = {}) {
  const { initialEntries = ['/'], authenticated = true } = options

  if (authenticated) {
    localStorage.setItem('auth_token', 'test-token-123')
  }

  const queryClient = createTestQueryClient()
  const user = userEvent.setup()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPageStub />} />

                <Route element={<ProtectedRoute />}>
                  <Route
                    path="/review"
                    element={
                      <ErrorBoundary>
                        <ReviewSession />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ErrorBoundary>
                        <SettingsPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/cards"
                    element={
                      <ErrorBoundary>
                        <CardsPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/debug"
                    element={
                      <ErrorBoundary>
                        <DebugPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/insights"
                    element={
                      <ErrorBoundary>
                        <InsightsReviewPage />
                      </ErrorBoundary>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppLayout>
            <Toaster />
          </AuthProvider>
        </MemoryRouter>
      </LoadingProvider>
    </QueryClientProvider>,
  )

  return { ...result, user }
}

interface RenderPageOptions {
  initialEntries?: string[]
}

/**
 * Lighter render helper for single-page tests without the full route tree.
 * Always sets auth token. Wraps in MemoryRouter + all providers + Toaster.
 */
export function renderPage(ui: ReactElement, options: RenderPageOptions = {}) {
  const { initialEntries = ['/'] } = options

  localStorage.setItem('auth_token', 'test-token-123')

  const queryClient = createTestQueryClient()
  const user = userEvent.setup()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            {ui}
            <Toaster />
          </AuthProvider>
        </MemoryRouter>
      </LoadingProvider>
    </QueryClientProvider>,
  )

  return { ...result, user }
}
