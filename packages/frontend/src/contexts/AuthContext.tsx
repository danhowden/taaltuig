import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('auth_token'),
  )
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    navigate('/login')
  }, [navigate])

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const data = await apiClient.getCurrentUser(token)
          setUser(data.user)
        } catch (error) {
          console.error('Failed to load user:', error)
          // Token invalid, clear it
          localStorage.removeItem('auth_token')
          setToken(null)
        }
      }
      setIsLoading(false)
    }

    loadUser()
  }, [token])

  // Background auth refresh - check token validity every 5 minutes
  useEffect(() => {
    if (!token) return

    const checkAuth = async () => {
      try {
        const data = await apiClient.getCurrentUser(token)
        setUser(data.user)
      } catch (error) {
        console.error('Auth check failed, logging out:', error)
        logout()
      }
    }

    // Check every 5 minutes
    const interval = setInterval(checkAuth, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [token, logout])

  const login = async (newToken: string) => {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)

    try {
      const data = await apiClient.getCurrentUser(newToken)
      setUser(data.user)
      navigate('/review')
    } catch (error) {
      console.error('Login failed:', error)
      localStorage.removeItem('auth_token')
      setToken(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
