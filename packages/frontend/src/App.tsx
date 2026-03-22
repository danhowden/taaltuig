import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { ReviewSession } from '@/pages/ReviewSession'
import { SettingsPage } from '@/pages/SettingsPage'
import { CardsPage } from '@/pages/CardsPage'
import { DebugPage } from '@/pages/DebugPage'
import { InsightsReviewPage } from '@/pages/InsightsReviewPage'
import { WritingSession } from '@/pages/WritingSession'
import { ExerciseAdminPage } from '@/pages/ExerciseAdminPage'
import { CurriculumPage } from '@/pages/CurriculumPage'
import { Toaster } from '@/components/ui/toaster'
import { AppLayout } from '@/components/AppLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <LoadingProvider>
          <BrowserRouter>
          <AuthProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes */}
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
                  <Route
                    path="/writing"
                    element={
                      <ErrorBoundary>
                        <WritingSession />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/writing/admin"
                    element={
                      <ErrorBoundary>
                        <ExerciseAdminPage />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/curriculum"
                    element={
                      <ErrorBoundary>
                        <CurriculumPage />
                      </ErrorBoundary>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppLayout>
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
        </LoadingProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}

export default App
