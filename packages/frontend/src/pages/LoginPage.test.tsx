import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LoginPage } from './LoginPage'
import { BrowserRouter } from 'react-router-dom'
import * as AuthContext from '@/contexts/AuthContext'
import type { CredentialResponse } from '@react-oauth/google'

const mockNavigate = vi.fn()
const mockLogin = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock GoogleLogin component
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({
    onSuccess,
  }: {
    onSuccess: (credentialResponse: CredentialResponse) => void
    onError?: () => void
  }) => {
    // Expose the handlers via data attributes for testing
    return (
      <div
        data-testid="google-login"
        onClick={() => {
          const mockCredential: CredentialResponse = {
            credential: 'mock-google-jwt-token',
            select_by: 'btn',
          }
          onSuccess(mockCredential)
        }}
      >
        Google Login Button
      </div>
    )
  },
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockLogin.mockClear()
  })

  describe('when unauthenticated', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
      })
    })

    it('renders welcome title', () => {
      renderLoginPage()

      expect(screen.getByText('Welcome')).toBeInTheDocument()
    })

    it('renders sign in description', () => {
      renderLoginPage()

      expect(
        screen.getByText('Sign in to start learning Dutch'),
      ).toBeInTheDocument()
    })

    it('renders Google OAuth button', () => {
      renderLoginPage()

      expect(screen.getByTestId('google-login')).toBeInTheDocument()
    })

    it('renders terms and privacy notice', () => {
      renderLoginPage()

      expect(
        screen.getByText(/by signing in, you agree to our terms/i),
      ).toBeInTheDocument()
    })

    it('calls login with Google credential on successful authentication', async () => {
      renderLoginPage()

      const googleButton = screen.getByTestId('google-login')
      googleButton.click()

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('mock-google-jwt-token')
      })
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-1',
          google_sub: 'google-123',
          email: 'test@example.com',
          name: 'John Doe',
          picture_url: 'https://example.com/pic.jpg',
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-20T00:00:00Z',
        },
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: vi.fn(),
      })
    })

    it('redirects to /review when already authenticated', async () => {
      renderLoginPage()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/review')
      })
    })
  })
})
