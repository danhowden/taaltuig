import { screen, waitFor } from '@testing-library/react'
import { renderApp } from './render-app'

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: Object.assign(vi.fn(), {
    create: vi.fn(() => Object.assign(vi.fn(), { reset: vi.fn() })),
  }),
}))

// Mock WebGL gradient
vi.mock('@/lib/gradient.js', () => ({
  Gradient: vi.fn().mockImplementation(() => ({
    initGradient: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// Mock recharts to avoid SVG rendering issues in happy-dom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('Debug Page', () => {
  it('loads and displays queue tab with data', async () => {
    renderApp({ initialEntries: ['/debug'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Behind the Scenes' })).toBeInTheDocument()
    })

    // Queue tab is active by default — shows queue count
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Review Queue/i })).toBeInTheDocument()
    })

    // Queue data loads (5 items from mockQueue)
    await waitFor(() => {
      expect(screen.getByText(/5 of 5 items/)).toBeInTheDocument()
    })
  })

  it('switches to Statistics tab and shows card counts', async () => {
    const { user } = renderApp({ initialEntries: ['/debug'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Behind the Scenes' })).toBeInTheDocument()
    })

    // Click Statistics tab
    await user.click(screen.getByRole('tab', { name: 'Statistics' }))

    // Should show stats cards
    await waitFor(() => {
      expect(screen.getByText('Total Cards')).toBeInTheDocument()
    })

    expect(screen.getByText('Review Items')).toBeInTheDocument()
    expect(screen.getByText('Due Now')).toBeInTheDocument()
    expect(screen.getByText('New Cards')).toBeInTheDocument()
    expect(screen.getByText('State Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('Directions')).toBeInTheDocument()
  })

  it('switches to AI Metrics tab and shows metrics', async () => {
    const { user } = renderApp({ initialEntries: ['/debug'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Behind the Scenes' })).toBeInTheDocument()
    })

    // Click AI Metrics tab
    await user.click(screen.getByRole('tab', { name: 'AI Metrics' }))

    // Should show metrics summary cards
    await waitFor(() => {
      expect(screen.getByText('Approval Rate')).toBeInTheDocument()
    })

    expect(screen.getByText('81.3%')).toBeInTheDocument() // 0.8125 * 100
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument() // totals.approved
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Cards Processed')).toBeInTheDocument()

    // Period buttons
    expect(screen.getByRole('button', { name: 'Last Hour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 24h' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last Week' })).toBeInTheDocument()
  })

  it('shows search functionality in queue tab', async () => {
    const { user } = renderApp({ initialEntries: ['/debug'] })

    // Wait for queue to load
    await waitFor(() => {
      expect(screen.getByText(/5 of 5 items/)).toBeInTheDocument()
    })

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search cards/i)
    await user.type(searchInput, 'kat')

    // Should filter results
    await waitFor(() => {
      expect(screen.getByText(/1 of 5 items/)).toBeInTheDocument()
    })
  })
})
