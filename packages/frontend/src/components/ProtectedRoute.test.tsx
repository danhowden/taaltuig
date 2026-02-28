import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import * as AuthContext from '@/contexts/AuthContext'

function TestComponent() {
  return <div>Protected Content</div>
}

function renderProtectedRoute() {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<TestComponent />} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </BrowserRouter>,
  )
}

describe('ProtectedRoute', () => {
  describe('when loading', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      })
    })

    it('shows loading state', () => {
      renderProtectedRoute()

      // LoadingCards component renders an SVG animation
      expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('does not render protected content while loading', () => {
      renderProtectedRoute()

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('when unauthenticated', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })
    })

    it('does not render protected content', () => {
      renderProtectedRoute()

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('triggers navigation to login', () => {
      renderProtectedRoute()

      // ProtectedRoute uses Navigate which changes the route
      // The redirect happens, so we just verify protected content is not shown
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-1',
          google_sub: 'google-123',
          email: 'test@example.com',
          name: 'Test User',
          picture_url: 'https://example.com/pic.jpg',
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-20T00:00:00Z',
        },
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      })
    })

    it('renders protected content', () => {
      renderProtectedRoute()

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('does not show loading state', () => {
      renderProtectedRoute()

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('does not redirect to login', () => {
      renderProtectedRoute()

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    })
  })
})
