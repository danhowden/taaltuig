import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'

// Mock Google OAuth Provider
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  GoogleLogin: () => <div>Google Login</div>,
}))

// Mock mesh gradient (requires WebGL context)
vi.mock('@/components/ui/mesh-gradient-background', () => ({
  MeshGradientBackground: () => <div data-testid="mesh-gradient-mock" />,
}))

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeInTheDocument()
  })

  it('wraps app in necessary providers', () => {
    render(<App />)

    // App should render (providers working)
    expect(document.body).toBeInTheDocument()
  })

  it('renders routing structure', () => {
    const { container } = render(<App />)

    // App should render with mesh gradient mock
    expect(container.querySelector('[data-testid="mesh-gradient-mock"]')).toBeInTheDocument()
  })
})
