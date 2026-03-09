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

describe('Insights Review Page', () => {
  it('loads insights queue and displays rows', async () => {
    renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Insights Review' })).toBeInTheDocument()
    })

    // Wait for insights to load — 3 total insights from mockInsightsQueue
    await waitFor(() => {
      expect(screen.getByText('0 of 3 insights reviewed')).toBeInTheDocument()
    })

    // Insight content should be visible
    expect(screen.getByText('"kat" comes from Latin "cattus"')).toBeInTheDocument()
    expect(screen.getByText('lopen: ik loop, jij loopt, hij loopt')).toBeInTheDocument()
  })

  it('shows type badges', async () => {
    renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByText('0 of 3 insights reviewed')).toBeInTheDocument()
    })

    // Type badges visible (may appear in both desktop column and mobile inline badge)
    expect(screen.getAllByText('Compound').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Verb Forms').length).toBeGreaterThanOrEqual(1)
  })

  it('approves an individual insight', async () => {
    let reviewCalled = false

    server.use(
      http.put('*/api/insights/:cardId/review', async () => {
        reviewCalled = true
        return HttpResponse.json({
          card: {
            id: 'CARD#card-1',
            card_id: 'card-1',
            user_id: 'user-1',
            front: 'de kat',
            back: 'the cat',
            created_at: '2024-01-10T00:00:00Z',
          },
        })
      }),
    )

    const { user } = renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByText('0 of 3 insights reviewed')).toBeInTheDocument()
    })

    // Find approve buttons (green icon buttons with Check icon — no aria-label)
    const allButtons = screen.getAllByRole('button')
    const approveButtons = allButtons.filter(
      (btn) => btn.classList.contains('text-green-600'),
    )
    expect(approveButtons.length).toBeGreaterThanOrEqual(1)

    await user.click(approveButtons[0])

    await waitFor(() => {
      expect(reviewCalled).toBe(true)
    })

    // Success toast
    await waitFor(() => {
      const matches = screen.getAllByText(/Insight approved/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('switches filter tabs', async () => {
    const { user } = renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Insights Review' })).toBeInTheDocument()
    })

    // Default tab: "Awaiting Human Review" (ai_approved)
    expect(screen.getByRole('tab', { name: 'Awaiting Human Review' })).toHaveAttribute('data-state', 'active')

    // Switch to "Awaiting AI Review" tab
    await user.click(screen.getByRole('tab', { name: 'Awaiting AI Review' }))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Awaiting AI Review' })).toHaveAttribute('data-state', 'active')
    })

    // Switch to "All" tab
    await user.click(screen.getByRole('tab', { name: 'All' }))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('data-state', 'active')
    })
  })

  it('shows empty state when no insights', async () => {
    server.use(
      http.get('*/api/insights/queue', () => {
        return HttpResponse.json({ cards: [], total: 0 })
      }),
    )

    renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByText('No insights to review in this queue.')).toBeInTheDocument()
    })
  })

  it('performs bulk review', async () => {
    const reviewCalls: Array<{ cardId: string; action: string }> = []

    server.use(
      http.put('*/api/insights/:cardId/review', async ({ params, request }) => {
        const body = (await request.json()) as { action: string }
        reviewCalls.push({ cardId: params.cardId as string, action: body.action })
        return HttpResponse.json({
          card: {
            id: `CARD#${params.cardId}`,
            card_id: params.cardId,
            user_id: 'user-1',
            front: 'test',
            back: 'test',
            created_at: '2024-01-10T00:00:00Z',
          },
        })
      }),
    )

    const { user } = renderApp({ initialEntries: ['/insights'] })

    await waitFor(() => {
      expect(screen.getByText('0 of 3 insights reviewed')).toBeInTheDocument()
    })

    // Click "Review all" button (approves all by default since none marked for rejection)
    const reviewAllButton = screen.getByRole('button', { name: /Review all/i })
    await user.click(reviewAllButton)

    // Should have called review for all 3 insights
    await waitFor(() => {
      expect(reviewCalls.length).toBe(3)
    })

    // All should be approvals (none marked for rejection)
    expect(reviewCalls.every((c) => c.action === 'approve')).toBe(true)

    // Bulk review complete toast
    await waitFor(() => {
      const matches = screen.getAllByText(/Bulk review complete/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })
})
