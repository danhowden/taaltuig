import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './render-app'

// Mock canvas-confetti (ReviewComplete uses it)
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

// Mock WebGL gradient (AppLayout uses MeshGradientBackground)
vi.mock('@/lib/gradient.js', () => ({
  Gradient: vi.fn().mockImplementation(() => ({
    initGradient: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

describe('Navigation & Auth', () => {
  describe('unauthenticated', () => {
    it('redirects /review to /login', async () => {
      renderApp({ initialEntries: ['/review'], authenticated: false })

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })
    })

    it('redirects /cards to /login', async () => {
      renderApp({ initialEntries: ['/cards'], authenticated: false })

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })
    })

    it('redirects /settings to /login', async () => {
      renderApp({ initialEntries: ['/settings'], authenticated: false })

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })
    })

    it('redirects /insights to /login', async () => {
      renderApp({ initialEntries: ['/insights'], authenticated: false })

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })
    })
  })

  describe('authenticated', () => {
    it('renders landing page at /', async () => {
      renderApp({ initialEntries: ['/'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Taaltuig')
      })
      expect(screen.getByText('Get Started')).toBeInTheDocument()
    })

    it('renders review page at /review', async () => {
      renderApp({ initialEntries: ['/review'] })

      // Wait for review session to load and show first card's front
      await waitFor(() => {
        // The FlashCard shows the front text — use getAllByText since sidebar may also show it
        const elements = screen.getAllByText('de kat')
        expect(elements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('renders settings page at /settings', async () => {
      renderApp({ initialEntries: ['/settings'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
      })
    })

    it('renders cards page at /cards', async () => {
      renderApp({ initialEntries: ['/cards'] })

      // Wait for paginated cards to load — cards show in a table/list
      await waitFor(() => {
        expect(screen.getByText('5 cards')).toBeInTheDocument()
      })
    })

    it('renders insights page at /insights', async () => {
      renderApp({ initialEntries: ['/insights'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Insights Review' })).toBeInTheDocument()
      })
    })

    it('renders debug page at /debug', async () => {
      renderApp({ initialEntries: ['/debug'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Behind the Scenes' })).toBeInTheDocument()
      })
    })
  })

  describe('unknown routes', () => {
    it('redirects unknown route to /', async () => {
      renderApp({ initialEntries: ['/nonexistent'] })

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Taaltuig')
      })
    })
  })
})
