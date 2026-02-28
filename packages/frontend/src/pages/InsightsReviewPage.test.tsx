import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { InsightsReviewPage } from './InsightsReviewPage'
import * as AuthContext from '@/contexts/AuthContext'
import * as LoadingContext from '@/contexts/LoadingContext'
import { apiClient } from '@/lib/api'
import { renderWithProviders, createTestQueryClient } from '@/test/utils'
import type { InsightsQueueResponse } from '@/types'

const mockToast = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInsightsQueue: vi.fn(),
    reviewInsight: vi.fn(),
  },
}))

const mockAuth = {
  user: {
    id: 'user-1',
    google_sub: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture_url: 'https://example.com/pic.jpg',
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-20T00:00:00Z',
  },
  token: 'valid-token',
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}

const mockQueueWithInsights: InsightsQueueResponse = {
  cards: [
    {
      card_id: 'card-1',
      front: 'huis',
      back: 'house',
      category: 'Basics',
      insights: [
        {
          type: 'compound',
          content: 'huis is a standalone word',
          status: 'approved',
          generated_at: '2024-01-01T00:00:00Z',
          reviewed_by: 'ai',
        },
        {
          type: 'plural',
          content: 'huizen (plural)',
          status: 'approved',
          generated_at: '2024-01-01T00:00:00Z',
          reviewed_by: 'human',
          reviewed_at: '2024-01-02T00:00:00Z',
        },
      ],
    },
    {
      card_id: 'card-2',
      front: 'fiets',
      back: 'bicycle',
      category: 'Transport',
      insights: [
        {
          type: 'example',
          content: 'Ik ga met de fiets naar werk',
          status: 'pending',
          generated_at: '2024-01-01T00:00:00Z',
        },
      ],
    },
  ],
  total: 2,
}

const emptyQueue: InsightsQueueResponse = {
  cards: [],
  total: 0,
}

function renderPage() {
  const queryClient = createTestQueryClient()
  return renderWithProviders(<InsightsReviewPage />, { queryClient })
}

describe('InsightsReviewPage', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue(mockAuth)
    vi.spyOn(LoadingContext, 'useLoading').mockReturnValue({
      isLoading: false,
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    })
    mockToast.mockClear()
    vi.mocked(apiClient.getInsightsQueue).mockClear()
    vi.mocked(apiClient.reviewInsight).mockClear()
  })

  it('shows loading state', () => {
    vi.mocked(apiClient.getInsightsQueue).mockReturnValue(new Promise(() => {}))
    renderPage()
    // Header and tabs should still be visible
    expect(screen.getByText('Insights Review')).toBeInTheDocument()
    expect(screen.getByText('Awaiting Human Review')).toBeInTheDocument()
    expect(screen.getByText('Awaiting AI Review')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('shows empty state when no insights', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(emptyQueue)
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText('No insights to review in this queue.')
      ).toBeInTheDocument()
    })
  })

  it('renders insights as table rows', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })
    expect(screen.getByText('house')).toBeInTheDocument()
    expect(screen.getByText('huis is a standalone word')).toBeInTheDocument()
    expect(screen.getByText('huizen (plural)')).toBeInTheDocument()
    expect(screen.getByText('fiets')).toBeInTheDocument()
    expect(screen.getByText('Ik ga met de fiets naar werk')).toBeInTheDocument()
  })

  it('shows correct status badges', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })
    expect(screen.getByText('Awaiting review')).toBeInTheDocument() // AI-approved
    expect(screen.getByText('Approved')).toBeInTheDocument() // Human-reviewed
    expect(screen.getByText('Pending')).toBeInTheDocument() // Pending
  })

  it('shows reviewed count in description', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText('1 of 3 insights reviewed')
      ).toBeInTheDocument()
    })
  })

  it('shows card name only on first insight row per card', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })
    // "huis" should appear once (first insight), not twice
    const huisElements = screen.getAllByText('huis')
    expect(huisElements).toHaveLength(1)
  })

  it('defaults to Awaiting Human Review tab', () => {
    vi.mocked(apiClient.getInsightsQueue).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(apiClient.getInsightsQueue).toHaveBeenCalledWith(
      'valid-token',
      'ai_approved'
    )
  })

  it('switches tabs and refetches', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(emptyQueue)
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(apiClient.getInsightsQueue).toHaveBeenCalledWith(
        'valid-token',
        'ai_approved'
      )
    })

    await user.click(screen.getByText('Awaiting AI Review'))
    await waitFor(() => {
      expect(apiClient.getInsightsQueue).toHaveBeenCalledWith(
        'valid-token',
        'pending'
      )
    })

    await user.click(screen.getByText('All'))
    await waitFor(() => {
      expect(apiClient.getInsightsQueue).toHaveBeenCalledWith(
        'valid-token',
        'all'
      )
    })
  })

  it('approves an insight', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    vi.mocked(apiClient.reviewInsight).mockResolvedValue({
      card_id: 'card-1',
      insight_index: 0,
      status: 'approved',
    })
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })

    // Find approve buttons (green check icons)
    const approveButtons = screen.getAllByRole('button', { name: '' }).filter(
      (btn) => btn.classList.contains('text-green-600')
    )
    expect(approveButtons.length).toBeGreaterThan(0)
    await user.click(approveButtons[0])

    await waitFor(() => {
      expect(apiClient.reviewInsight).toHaveBeenCalledWith(
        'valid-token',
        'card-1',
        { insight_index: 0, action: 'approve' }
      )
    })
  })

  it('rejects an insight', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    vi.mocked(apiClient.reviewInsight).mockResolvedValue({
      card_id: 'card-1',
      insight_index: 0,
      status: 'rejected',
    })
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })

    const rejectButtons = screen.getAllByRole('button', { name: '' }).filter(
      (btn) => btn.classList.contains('text-red-600')
    )
    expect(rejectButtons.length).toBeGreaterThan(0)
    await user.click(rejectButtons[0])

    await waitFor(() => {
      expect(apiClient.reviewInsight).toHaveBeenCalledWith(
        'valid-token',
        'card-1',
        { insight_index: 0, action: 'reject' }
      )
    })
  })

  it('enters edit mode and saves', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    vi.mocked(apiClient.reviewInsight).mockResolvedValue({
      card_id: 'card-1',
      insight_index: 0,
      status: 'approved',
    })
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })

    // Click edit button (pencil icon) - it's a button without specific text
    const editButtons = screen.getAllByRole('button', { name: '' }).filter(
      (btn) =>
        !btn.classList.contains('text-green-600') &&
        !btn.classList.contains('text-red-600')
    )
    // First non-colored icon button should be edit
    await user.click(editButtons[0])

    // Should show input with current content
    const input = screen.getByDisplayValue('huis is a standalone word')
    expect(input).toBeInTheDocument()

    // Edit and save
    await user.clear(input)
    await user.type(input, 'updated content')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(apiClient.reviewInsight).toHaveBeenCalledWith(
        'valid-token',
        'card-1',
        { insight_index: 0, action: 'edit', content: 'updated content' }
      )
    })
  })

  it('cancels edit mode', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue(
      mockQueueWithInsights
    )
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('huis')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: '' }).filter(
      (btn) =>
        !btn.classList.contains('text-green-600') &&
        !btn.classList.contains('text-red-600')
    )
    await user.click(editButtons[0])

    expect(
      screen.getByDisplayValue('huis is a standalone word')
    ).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))

    expect(
      screen.queryByDisplayValue('huis is a standalone word')
    ).not.toBeInTheDocument()
    // Original text should be visible again
    expect(
      screen.getByText('huis is a standalone word')
    ).toBeInTheDocument()
  })

  it('hides action buttons for human-reviewed insights', async () => {
    vi.mocked(apiClient.getInsightsQueue).mockResolvedValue({
      cards: [
        {
          card_id: 'card-1',
          front: 'huis',
          back: 'house',
          category: 'Basics',
          insights: [
            {
              type: 'plural',
              content: 'huizen (plural)',
              status: 'approved',
              generated_at: '2024-01-01T00:00:00Z',
              reviewed_by: 'human',
              reviewed_at: '2024-01-02T00:00:00Z',
            },
          ],
        },
      ],
      total: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    // Row should be dimmed (opacity-50) and have no approve/reject buttons
    const row = screen.getByText('huizen (plural)').closest('tr')!
    expect(row.className).toContain('opacity-50')
    const rowButtons = row.querySelectorAll('button')
    expect(rowButtons).toHaveLength(0)
  })
})
