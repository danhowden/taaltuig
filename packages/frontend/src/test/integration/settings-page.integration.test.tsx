import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
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

describe('Settings Page', () => {
  it('loads settings and populates form', async () => {
    renderApp({ initialEntries: ['/settings'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })

    // Wait for settings to load (form fields populated)
    await waitFor(() => {
      const newCardsInput = screen.getByLabelText(/New cards per day/i)
      expect(newCardsInput).toHaveValue(20)
    })
  })

  it('saves settings and shows success toast', async () => {
    let savedSettings: Record<string, unknown> | null = null

    server.use(
      http.put('*/api/settings', async ({ request }) => {
        savedSettings = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          settings: {
            user_id: 'user-1',
            ...savedSettings,
            updated_at: new Date().toISOString(),
          },
        })
      }),
    )

    const { user } = renderApp({ initialEntries: ['/settings'] })

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByLabelText(/New cards per day/i)).toHaveValue(20)
    })

    // Change new cards per day
    const input = screen.getByLabelText(/New cards per day/i)
    await user.clear(input)
    await user.type(input, '15')

    // Save button should be enabled
    const saveButton = screen.getByRole('button', { name: /Save/i })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    // Success toast
    await waitFor(() => {
      const matches = screen.getAllByText(/Settings saved/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    expect(savedSettings).not.toBeNull()
    expect(savedSettings!.new_cards_per_day).toBe(15)
  })

  it('resets to defaults', async () => {
    const { user } = renderApp({ initialEntries: ['/settings'] })

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByLabelText(/New cards per day/i)).toHaveValue(20)
    })

    // Change a value first
    const input = screen.getByLabelText(/New cards per day/i)
    await user.clear(input)
    await user.type(input, '5')
    expect(input).toHaveValue(5)

    // Click Reset
    const resetButton = screen.getByRole('button', { name: /Reset/i })
    await user.click(resetButton)

    // Should be back to default
    expect(screen.getByLabelText(/New cards per day/i)).toHaveValue(20)
  })

  it('navigates between tabs', async () => {
    const { user } = renderApp({ initialEntries: ['/settings'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })

    // Default tab is Limits — check it shows new cards input
    await waitFor(() => {
      expect(screen.getByLabelText(/New cards per day/i)).toBeInTheDocument()
    })

    // Click Learning tab
    await user.click(screen.getByRole('tab', { name: 'Learning' }))
    await waitFor(() => {
      expect(screen.getByLabelText(/Learning steps/i)).toBeInTheDocument()
    })

    // Click Reviews tab
    await user.click(screen.getByRole('tab', { name: 'Reviews' }))
    await waitFor(() => {
      // Slider renders as div (Radix), so getByLabelText won't work — use text
      expect(screen.getByText(/Starting ease/i)).toBeInTheDocument()
    })

    // Click Lapses tab
    await user.click(screen.getByRole('tab', { name: 'Lapses' }))
    await waitFor(() => {
      expect(screen.getByLabelText(/Relearning steps/i)).toBeInTheDocument()
    })
  })
})
