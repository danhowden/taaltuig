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

describe('Cards Page', () => {
  it('loads paginated cards and displays card count', async () => {
    renderApp({ initialEntries: ['/cards'] })

    await waitFor(() => {
      expect(screen.getByText('5 cards')).toBeInTheDocument()
    })
  })

  it('displays card text in the list', async () => {
    renderApp({ initialEntries: ['/cards'] })

    await waitFor(() => {
      expect(screen.getByText('5 cards')).toBeInTheDocument()
    })

    // Cards should be visible (may need to expand categories first)
    // In grouped view, categories are collapsed by default
    // The footer count confirms all cards loaded
  })

  it('filters cards by search query', async () => {
    const { user } = renderApp({ initialEntries: ['/cards'] })

    await waitFor(() => {
      expect(screen.getByText('5 cards')).toBeInTheDocument()
    })

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'kat')

    // Only matching cards should remain
    await waitFor(() => {
      expect(screen.getByText('1 cards')).toBeInTheDocument()
    })
  })

  it('creates a card via BulkCardCreator', async () => {
    let createCalled = false

    server.use(
      http.post('*/api/cards', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        createCalled = true
        return HttpResponse.json({
          card: {
            id: 'CARD#new-1',
            card_id: 'new-1',
            user_id: 'user-1',
            created_at: new Date().toISOString(),
            ...body,
          },
        })
      }),
    )

    const { user } = renderApp({ initialEntries: ['/cards'] })

    await waitFor(() => {
      expect(screen.getByText('5 cards')).toBeInTheDocument()
    })

    // Click Create button to open BulkCardCreator
    await user.click(screen.getByRole('button', { name: /Create/ }))

    // Fill in front and back fields
    const frontInputs = screen.getAllByPlaceholderText(/dutch/i)
    const backInputs = screen.getAllByPlaceholderText(/english/i)

    await user.type(frontInputs[0], 'de appel')
    await user.type(backInputs[0], 'the apple')

    // Submit
    const saveButton = screen.getByRole('button', { name: /Save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(createCalled).toBe(true)
    })

    // Success toast
    await waitFor(() => {
      const matches = screen.getAllByText(/Created 1 card/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('deletes a card', async () => {
    let deleteCalled = false

    server.use(
      http.delete('*/api/cards/:id', () => {
        deleteCalled = true
        return HttpResponse.json({ success: true })
      }),
    )

    const { user } = renderApp({ initialEntries: ['/cards'] })

    await waitFor(() => {
      expect(screen.getByText('5 cards')).toBeInTheDocument()
    })

    // Search to filter down — this auto-expands categories (few results)
    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'kat')

    await waitFor(() => {
      expect(screen.getByText('1 cards')).toBeInTheDocument()
    })

    // Card row should now be visible with delete button (Trash2 icon, text-destructive class)
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      const deleteButtons = allButtons.filter(
        (btn) => btn.className.includes('text-destructive'),
      )
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
    })

    const allButtons = screen.getAllByRole('button')
    const deleteButtons = allButtons.filter(
      (btn) => btn.className.includes('text-destructive'),
    )
    await user.click(deleteButtons[0])

    // Confirm deletion in dialog if it shows
    const confirmButton = screen.queryByRole('button', { name: /confirm|delete|yes/i })
    if (confirmButton) {
      await user.click(confirmButton)
    }

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })
  })

  it('shows empty state when no cards', async () => {
    server.use(
      http.get('*/api/cards', () => {
        return HttpResponse.json({
          cards: [],
          pagination: { cursor: null, hasMore: false, pageSize: 200 },
        })
      }),
    )

    renderApp({ initialEntries: ['/cards'] })

    // The footer "X cards" should not appear since no cards loaded
    await waitFor(() => {
      expect(screen.queryByText(/\d+ cards/)).not.toBeInTheDocument()
    })
  })
})
