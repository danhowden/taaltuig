import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { renderApp } from './render-app'
import { mockExtraNewCards } from '@/mocks/data'
import type { QueueResponse, QueueItem } from '@/types'

// Mock canvas-confetti
const mockConfettiFn = Object.assign(vi.fn(), { reset: vi.fn() })
vi.mock('canvas-confetti', () => ({
  default: Object.assign(vi.fn(), {
    create: vi.fn(() => mockConfettiFn),
  }),
}))

// Mock WebGL gradient
vi.mock('@/lib/gradient.js', () => ({
  Gradient: vi.fn().mockImplementation(() => ({
    initGradient: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// Helper: find text that may appear multiple times (sidebar + main content)
function expectTextVisible(text: string) {
  const elements = screen.getAllByText(text)
  expect(elements.length).toBeGreaterThanOrEqual(1)
}

describe('Review Session', () => {
  describe('basic flow', () => {
    it('loads queue and displays first card front', async () => {
      renderApp({ initialEntries: ['/review'] })

      await waitFor(() => {
        expectTextVisible('de kat')
      })
    })

    it('space reveals answer and enables grade buttons', async () => {
      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('de kat'))

      // Grade buttons disabled before reveal
      expect(screen.getByRole('button', { name: /Again/ })).toBeDisabled()

      // Press space to reveal
      await user.keyboard(' ')

      await waitFor(() => expectTextVisible('the cat'))

      // Grade buttons enabled
      expect(screen.getByRole('button', { name: /Again/ })).toBeEnabled()
      expect(screen.getByRole('button', { name: /Good/ })).toBeEnabled()
    })

    it('grading advances to next card via keyboard shortcuts', async () => {
      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('de kat'))

      // Reveal and grade Good (key 3)
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('the cat'))
      await user.keyboard('3')

      // Should advance to next card (het huis)
      await waitFor(() => expectTextVisible('het huis'))
    })

    it('submits review with correct payload', async () => {
      let capturedBody: Record<string, unknown> | null = null

      server.use(
        http.post('*/api/reviews/submit', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            next_review: new Date().toISOString(),
            interval_days: 1,
            state: 'REVIEW',
          })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('de kat'))

      await user.keyboard(' ')
      await waitFor(() => expect(screen.getByRole('button', { name: /Good/ })).toBeEnabled())
      await user.keyboard('3')

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
      })

      expect(capturedBody!.review_item_id).toBe('review-1')
      expect(capturedBody!.grade).toBe(3)
      expect(capturedBody!.duration_ms).toBeGreaterThan(0)
    })

    it('completes all cards and shows completion screen', async () => {
      const twoCardQueue: QueueItem[] = [
        {
          review_item_id: 'r-1',
          card_id: 'c-1',
          direction: 'forward',
          state: 'REVIEW',
          interval: 7,
          ease_factor: 2.5,
          repetitions: 3,
          step_index: 0,
          due_date: '2024-01-20T00:00:00Z',
          last_reviewed: null,
          front: 'kaart een',
          back: 'card one',
        },
        {
          review_item_id: 'r-2',
          card_id: 'c-2',
          direction: 'forward',
          state: 'REVIEW',
          interval: 7,
          ease_factor: 2.5,
          repetitions: 3,
          step_index: 0,
          due_date: '2024-01-20T00:00:00Z',
          last_reviewed: null,
          front: 'kaart twee',
          back: 'card two',
        },
      ]

      server.use(
        http.get('*/api/reviews/queue', ({ request }) => {
          const url = new URL(request.url)
          if (url.searchParams.get('extra_new')) {
            return HttpResponse.json({ queue: [], stats: { due_count: 0, new_count: 0, learning_count: 0, total_count: 0, new_remaining_today: 0 } } as QueueResponse)
          }
          return HttpResponse.json({
            queue: twoCardQueue,
            stats: { due_count: 2, new_count: 0, learning_count: 0, total_count: 2, new_remaining_today: 10 },
          } as QueueResponse)
        }),
        http.post('*/api/reviews/submit', async () => {
          return HttpResponse.json({
            next_review: new Date(Date.now() + 7 * 86400000).toISOString(),
            interval_days: 7,
            state: 'REVIEW',
          })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      // Card 1
      await waitFor(() => expectTextVisible('kaart een'))
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('card one'))
      await user.keyboard('3')

      // Card 2
      await waitFor(() => expectTextVisible('kaart twee'))
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('card two'))
      await user.keyboard('3')

      // Completion screen — one of the Dutch phrases
      await waitFor(() => {
        const completionPhrases = [
          'Goed gedaan!',
          'Prima werk!',
          'Uitstekend!',
          'Fantastisch!',
          'Geweldig!',
        ]
        const found = completionPhrases.some((phrase) =>
          screen.queryByText(phrase),
        )
        expect(found).toBe(true)
      })
    })

    it('shows empty state when queue is empty', async () => {
      server.use(
        http.get('*/api/reviews/queue', () => {
          return HttpResponse.json({
            queue: [],
            stats: { due_count: 0, new_count: 0, learning_count: 0, total_count: 0, new_remaining_today: 0 },
          } as QueueResponse)
        }),
      )

      renderApp({ initialEntries: ['/review'] })

      await waitFor(() => {
        expect(screen.getByText('Geen kaarten')).toBeInTheDocument()
      })
    })

    it('shows error toast when review submit fails', async () => {
      server.use(
        http.post('*/api/reviews/submit', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('de kat'))

      await user.keyboard(' ')
      await waitFor(() => expect(screen.getByRole('button', { name: /Good/ })).toBeEnabled())
      await user.keyboard('3')

      await waitFor(() => {
        expect(screen.getByText('Failed to save review')).toBeInTheDocument()
      })
    })
  })

  describe('extra cards (Continue feature)', () => {
    it('shows extra cards buttons on completion and loads more cards', async () => {
      const singleCardQueue: QueueItem[] = [
        {
          review_item_id: 'r-single',
          card_id: 'c-single',
          direction: 'forward',
          state: 'REVIEW',
          interval: 7,
          ease_factor: 2.5,
          repetitions: 3,
          step_index: 0,
          due_date: '2024-01-20T00:00:00Z',
          last_reviewed: null,
          front: 'extra test kaart',
          back: 'extra test card',
        },
      ]

      server.use(
        http.get('*/api/reviews/queue', ({ request }) => {
          const url = new URL(request.url)
          const extraNew = url.searchParams.get('extra_new')
          if (extraNew) {
            const count = Math.min(parseInt(extraNew, 10), mockExtraNewCards.length)
            return HttpResponse.json({
              queue: mockExtraNewCards.slice(0, count),
              stats: { due_count: 0, new_count: count, learning_count: 0, total_count: count, new_remaining_today: 0 },
            } as QueueResponse)
          }
          return HttpResponse.json({
            queue: singleCardQueue,
            stats: { due_count: 1, new_count: 0, learning_count: 0, total_count: 1, new_remaining_today: 10 },
          } as QueueResponse)
        }),
        http.post('*/api/reviews/submit', async () => {
          return HttpResponse.json({
            next_review: new Date(Date.now() + 86400000).toISOString(),
            interval_days: 1,
            state: 'REVIEW',
          })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      // Complete the single card
      await waitFor(() => expectTextVisible('extra test kaart'))
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('extra test card'))
      await user.keyboard('3')

      // Completion screen with extra cards buttons
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+3' })).toBeInTheDocument()
      })

      // Click +3 to add extra cards
      await user.click(screen.getByRole('button', { name: '+3' }))

      // Should load and show first extra card (de hond from mockExtraNewCards)
      await waitFor(() => {
        expectTextVisible('de hond')
      })

      // Toast confirming extra cards added
      await waitFor(() => {
        const matches = screen.getAllByText(/Added 3 more cards/)
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows toast when no more NEW cards available', async () => {
      const singleCardQueue: QueueItem[] = [
        {
          review_item_id: 'r-single-2',
          card_id: 'c-single-2',
          direction: 'forward',
          state: 'REVIEW',
          interval: 7,
          ease_factor: 2.5,
          repetitions: 3,
          step_index: 0,
          due_date: '2024-01-20T00:00:00Z',
          last_reviewed: null,
          front: 'geen kaart meer',
          back: 'no more card',
        },
      ]

      server.use(
        http.get('*/api/reviews/queue', ({ request }) => {
          const url = new URL(request.url)
          if (url.searchParams.get('extra_new')) {
            return HttpResponse.json({
              queue: [],
              stats: { due_count: 0, new_count: 0, learning_count: 0, total_count: 0, new_remaining_today: 0 },
            } as QueueResponse)
          }
          return HttpResponse.json({
            queue: singleCardQueue,
            stats: { due_count: 1, new_count: 0, learning_count: 0, total_count: 1, new_remaining_today: 5 },
          } as QueueResponse)
        }),
        http.post('*/api/reviews/submit', async () => {
          return HttpResponse.json({
            next_review: new Date(Date.now() + 86400000).toISOString(),
            interval_days: 1,
            state: 'REVIEW',
          })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('geen kaart meer'))
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('no more card'))
      await user.keyboard('3')

      await waitFor(() => expect(screen.getByRole('button', { name: '+3' })).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: '+3' }))

      await waitFor(() => {
        expect(screen.getByText('No more NEW cards available')).toBeInTheDocument()
      })
    })
  })

  describe('waiting state', () => {
    it('shows waiting countdown when card graded Again and no more cards', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      const singleCardQueue: QueueItem[] = [
        {
          review_item_id: 'r-wait',
          card_id: 'c-wait',
          direction: 'forward',
          state: 'NEW',
          interval: 0,
          ease_factor: 2.5,
          repetitions: 0,
          step_index: 0,
          due_date: '2024-01-20T00:00:00Z',
          last_reviewed: null,
          front: 'wacht kaart',
          back: 'wait card',
        },
      ]

      server.use(
        http.get('*/api/reviews/queue', ({ request }) => {
          const url = new URL(request.url)
          if (url.searchParams.get('extra_new')) {
            return HttpResponse.json({ queue: [], stats: { due_count: 0, new_count: 0, learning_count: 0, total_count: 0, new_remaining_today: 0 } } as QueueResponse)
          }
          return HttpResponse.json({
            queue: singleCardQueue,
            stats: { due_count: 0, new_count: 1, learning_count: 0, total_count: 1, new_remaining_today: 5 },
          } as QueueResponse)
        }),
        http.post('*/api/reviews/submit', async () => {
          return HttpResponse.json({
            next_review: new Date(Date.now() + 600_000).toISOString(),
            interval_days: 0.007,
            state: 'LEARNING',
          })
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('wacht kaart'))

      // Reveal and grade Again (key 1)
      await user.keyboard(' ')
      await waitFor(() => expectTextVisible('wait card'))
      await user.keyboard('1')

      // Waiting state
      await waitFor(() => {
        expect(screen.getByText(/Next card in \d+s/)).toBeInTheDocument()
      })
      expect(
        screen.getByText(/Cards marked "Again" come back after their learning interval/),
      ).toBeInTheDocument()

      // Advance timer so card becomes available
      vi.advanceTimersByTime(610_000)

      // Card should return for review
      await waitFor(() => {
        expectTextVisible('wacht kaart')
      })

      vi.useRealTimers()
    })
  })

  describe('insights on cards', () => {
    it('shows approved human-reviewed insights on card back', async () => {
      server.use(
        http.get('*/api/reviews/queue', () => {
          return HttpResponse.json({
            queue: [
              {
                review_item_id: 'ri-insight',
                card_id: 'card-1',
                direction: 'forward',
                state: 'REVIEW',
                interval: 7,
                ease_factor: 2.5,
                repetitions: 3,
                step_index: 0,
                due_date: '2024-01-20T00:00:00Z',
                last_reviewed: null,
                front: 'inzicht kaart',
                back: 'insight card',
                insights: [
                  {
                    type: 'compound',
                    content: '"kat" comes from Latin "cattus"',
                    status: 'approved',
                    generated_at: '2024-01-15T00:00:00Z',
                    reviewed_at: '2024-01-16T00:00:00Z',
                    reviewed_by: 'human',
                  },
                ],
              },
            ],
            stats: { due_count: 1, new_count: 0, learning_count: 0, total_count: 1, new_remaining_today: 10 },
          } as QueueResponse)
        }),
      )

      const { user } = renderApp({ initialEntries: ['/review'] })

      await waitFor(() => expectTextVisible('inzicht kaart'))

      await user.keyboard(' ')

      await waitFor(() => {
        expect(screen.getByText('"kat" comes from Latin "cattus"')).toBeInTheDocument()
      })
      expect(screen.getByText('Compound')).toBeInTheDocument()
    })
  })
})
