import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { mockUser } from '@/mocks/data'

const API_BASE = '*/api'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    localStorage.clear()
  })

  it('provides user/token/isAuthenticated when authenticated', async () => {
    localStorage.setItem('auth_token', 'valid-token')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe('valid-token')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns null user when unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('loads user on mount with valid token', async () => {
    localStorage.setItem('auth_token', 'valid-token')

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('handles getCurrentUser API errors gracefully', async () => {
    localStorage.setItem('auth_token', 'invalid-token')

    server.use(
      http.get(`${API_BASE}/auth/me`, () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('login stores token in localStorage and navigates', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.login('new-token')

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    expect(localStorage.getItem('auth_token')).toBe('new-token')
    expect(result.current.token).toBe('new-token')
    expect(mockNavigate).toHaveBeenCalledWith('/review')
  })

  it('login handles API errors', async () => {
    server.use(
      http.get(`${API_BASE}/auth/me`, () => {
        return HttpResponse.json({ error: 'Invalid token' }, { status: 401 })
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.login('bad-token')

    await waitFor(() => {
      expect(result.current.token).toBeNull()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('logout clears token and navigates to login', async () => {
    localStorage.setItem('auth_token', 'valid-token')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(
      () => {
        expect(result.current.user).toEqual(mockUser)
      },
      { timeout: 3000 },
    )

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within AuthProvider')
  })
})
