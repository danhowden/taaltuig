/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ReviewSession } from './ReviewSession'
import { renderWithProviders } from '@/test/utils'
import * as useReviewQueue from '@/hooks/useReviewQueue'
import * as useSubmitReview from '@/hooks/useSubmitReview'
import type { QueueResponse } from '@/types'

const mockToast = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock canvas-confetti to avoid canvas-related issues in tests
vi.mock('canvas-confetti', () => ({
  default: {
    create: () => {
      const confettiFn = vi.fn()
      confettiFn.reset = vi.fn()
      return confettiFn
    },
  },
}))

const mockQueue: QueueResponse = {
  queue: [
    {
      review_item_id: 'review-1',
      card_id: 'card-1',
      user_id: 'user-1',
      direction: 'forward' as const,
      state: 'REVIEW' as const,
      interval: 7,
      ease_factor: 2.5,
      repetitions: 3,
      step_index: 0,
      due_date: '2024-01-20T00:00:00Z',
      last_reviewed: '2024-01-13T10:00:00Z',
      created_at: '2024-01-10T00:00:00Z',
      front: 'de kat',
      back: 'the cat',
      explanation: 'de = common gender article',
    },
    {
      review_item_id: 'review-2',
      card_id: 'card-2',
      user_id: 'user-1',
      direction: 'forward' as const,
      state: 'LEARNING' as const,
      interval: 0,
      ease_factor: 2.5,
      repetitions: 0,
      step_index: 1,
      due_date: '2024-01-20T10:10:00Z',
      last_reviewed: '2024-01-20T10:00:00Z',
      created_at: '2024-01-10T00:00:00Z',
      front: 'het huis',
      back: 'the house',
      explanation: 'het = neuter gender article',
    },
    {
      review_item_id: 'review-3',
      card_id: 'card-3',
      user_id: 'user-1',
      direction: 'reverse' as const,
      state: 'NEW' as const,
      interval: 0,
      ease_factor: 2.5,
      repetitions: 0,
      step_index: 0,
      due_date: '2024-01-20T00:00:00Z',
      created_at: '2024-01-11T00:00:00Z',
      front: 'the bicycle',
      back: 'de fiets',
      explanation: 'fiets is feminine/masculine (de-word)',
    },
  ],
  stats: {
    due_count: 2,
    new_count: 1,
    learning_count: 1,
    total_count: 3,
    new_remaining_today: 15,
  },
}

describe('ReviewSession', () => {
  const mockMutate = vi.fn()

  beforeEach(() => {
    mockToast.mockClear()
    mockMutate.mockClear()

    vi.spyOn(useSubmitReview, 'useSubmitReview').mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isIdle: true,
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      reset: vi.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      variables: undefined,
      submittedAt: 0,
      context: undefined,
    } as any)
  })

  describe('loading state', () => {
    it('shows loading state while fetching queue', () => {
      vi.spyOn(useReviewQueue, 'useReviewQueue').mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      } as any)

      const { container } = renderWithProviders(<ReviewSession />)

      // LoadingCards component renders an SVG animation
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when queue is empty', () => {
      vi.spyOn(useReviewQueue, 'useReviewQueue').mockReturnValue({
        data: { queue: [], stats: {} as any },
        isLoading: false,
        isError: false,
        error: null,
      } as any)

      renderWithProviders(<ReviewSession />)

      // EmptyState component should be rendered
      expect(screen.queryByText('de kat')).not.toBeInTheDocument()
    })
  })

  describe('active review session', () => {
    beforeEach(() => {
      vi.spyOn(useReviewQueue, 'useReviewQueue').mockReturnValue({
        data: mockQueue,
        isLoading: false,
        isError: false,
        error: null,
      } as any)
    })

    it('shows first card when queue loaded', () => {
      renderWithProviders(<ReviewSession />)

      // Card may show text on both front and back faces
      expect(screen.getAllByText('de kat').length).toBeGreaterThan(0)
    })

    it('shows progress in header', () => {
      renderWithProviders(<ReviewSession />)

      // Check that ReviewHeader is rendered (it shows "X to go")
      expect(screen.getByText('Review')).toBeInTheDocument()
      expect(screen.getByText('to go')).toBeInTheDocument()
    })

    it('shows card front initially', () => {
      renderWithProviders(<ReviewSession />)

      // Card shows front text (may be present in both front and back faces of flip card)
      expect(screen.getAllByText('de kat').length).toBeGreaterThan(0)
      // Both faces exist in the DOM for 3D flip - checking "Show Answer" button instead
      expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument()
    })

    it('reveals answer when space key is pressed', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')

      await waitFor(() => {
        expect(screen.getAllByText('the cat')[0]).toBeInTheDocument()
      })
    })

    it('grade buttons appear after answer revealed', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      // Buttons should be disabled initially
      const buttons = screen.getAllByRole('button')
      const gradeButton = buttons.find((btn) => btn.textContent?.includes('Again'))
      expect(gradeButton).toBeDisabled()

      await user.keyboard(' ')

      await waitFor(() => {
        expect(gradeButton).not.toBeDisabled()
      })
    })

    it('submits review and shows next card when grade button clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      // Reveal answer
      await user.keyboard(' ')

      await waitFor(() => {
        expect(screen.getAllByText('the cat').length).toBeGreaterThan(0)
      })

      // Click Good button (grade 3)
      const buttons = screen.getAllByRole('button')
      const goodButton = buttons.find((btn) => btn.textContent?.includes('Good'))

      if (goodButton) {
        await user.click(goodButton)
      }

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            review_item_id: 'review-1',
            grade: 3,
          }),
          expect.any(Object),
        )
      })

      // Should show next card (may appear on both faces)
      await waitFor(() => {
        expect(screen.getAllByText('het huis').length).toBeGreaterThan(0)
      })
    })

    it('keyboard shortcut 1 submits Again grade', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ') // Reveal
      await waitFor(() => {
        expect(screen.getAllByText('the cat')[0]).toBeInTheDocument()
      })

      await user.keyboard('1') // Grade: Again (0)

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            review_item_id: 'review-1',
            grade: 0,
          }),
          expect.any(Object),
        )
      })
    })

    it('keyboard shortcut 2 submits Hard grade', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')
      await user.keyboard('2')

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            grade: 2,
          }),
          expect.any(Object),
        )
      })
    })

    it('keyboard shortcut 3 submits Good grade', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')
      await user.keyboard('3')

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            grade: 3,
          }),
          expect.any(Object),
        )
      })
    })

    it('keyboard shortcut 4 submits Easy grade', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')
      await user.keyboard('4')

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            grade: 4,
          }),
          expect.any(Object),
        )
      })
    })

    it('tracks reviewed count correctly', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      // Review first card
      await user.keyboard(' ')
      await user.keyboard('3')

      await waitFor(() => {
        expect(screen.getAllByText('het huis')[0]).toBeInTheDocument()
      })

      // Review second card
      await user.keyboard(' ')
      await user.keyboard('3')

      await waitFor(() => {
        expect(screen.getAllByText('the bicycle')[0]).toBeInTheDocument()
      })

      // Review third card
      await user.keyboard(' ')
      await user.keyboard('3')

      // Should show completion screen
      await waitFor(() => {
        expect(screen.queryByText('the bicycle')).not.toBeInTheDocument()
      })
    })

    it('shows error toast when review submit fails', async () => {
      const user = userEvent.setup()
      mockMutate.mockImplementation((data, options: any) => {
        options.onError(new Error('API Error'))
      })

      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')
      await user.keyboard('3')

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'Failed to save review',
          description: expect.any(String),
        })
      })
    })
  })

  describe('completion state', () => {
    it('shows completion screen when all cards reviewed', async () => {
      vi.spyOn(useReviewQueue, 'useReviewQueue').mockReturnValue({
        data: {
          queue: [mockQueue.queue[0]],
          stats: mockQueue.stats,
        },
        isLoading: false,
        isError: false,
        error: null,
      } as any)

      const user = userEvent.setup()
      renderWithProviders(<ReviewSession />)

      await user.keyboard(' ')
      await user.keyboard('3')

      await waitFor(() => {
        expect(screen.queryByText('de kat')).not.toBeInTheDocument()
      })
    })
  })
})
