import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { BrowserRouter } from 'react-router-dom'
import * as AuthContext from '@/contexts/AuthContext'
import * as LoadingContext from '@/contexts/LoadingContext'
import { apiClient } from '@/lib/api'
import type { QueueResponse } from '@/types'

const mockNavigate = vi.fn()
const mockStartLoading = vi.fn()
const mockStopLoading = vi.fn()
const mockToast = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/api', () => ({
  apiClient: {
    getReviewQueue: vi.fn(),
    resetDailyReviews: vi.fn(),
    clearInsights: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}))

const mockQueueResponse: QueueResponse = {
  queue: [],
  stats: {
    due_count: 5,
    new_count: 10,
    learning_count: 3,
    total_count: 18,
    new_remaining_today: 15,
  },
}

const mockSettings = {
  user_id: 'user-1',
  new_cards_per_day: 20,
  max_reviews_per_day: null,
  learning_steps: [1, 10],
  relearning_steps: [10],
  graduating_interval: 1,
  easy_interval: 4,
  starting_ease: 2.5,
  easy_bonus: 1.3,
  interval_modifier: 1.0,
  maximum_interval: 36500,
  lapse_new_interval: 0,
  disabled_categories: null,
  updated_at: '2024-01-01T00:00:00Z',
}

function renderSettingsPage() {
  return render(
    <BrowserRouter>
      <SettingsPage />
    </BrowserRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        google_sub: 'google-123',
        email: 'test@example.com',
        name: 'John Doe',
        picture_url: 'https://example.com/pic.jpg',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-20T00:00:00Z',
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })

    vi.spyOn(LoadingContext, 'useLoading').mockReturnValue({
      isLoading: false,
      startLoading: mockStartLoading,
      stopLoading: mockStopLoading,
    })

    mockNavigate.mockClear()
    mockStartLoading.mockClear()
    mockStopLoading.mockClear()
    mockToast.mockClear()
    vi.mocked(apiClient.getReviewQueue).mockClear()
    vi.mocked(apiClient.resetDailyReviews).mockClear()
    vi.mocked(apiClient.clearInsights).mockClear()
    vi.mocked(apiClient.getSettings).mockClear()
    vi.mocked(apiClient.updateSettings).mockClear()

    // Default mock for getSettings - always resolve to prevent loading state issues
    vi.mocked(apiClient.getSettings).mockResolvedValue(mockSettings)
  })

  describe('rendering', () => {
    it('renders page title', () => {
      renderSettingsPage()

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders page header', () => {
      renderSettingsPage()

      // Page uses PageLayout which shows Settings as header
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders SRS Settings tabs', async () => {
      renderSettingsPage()

      // Tabs for settings
      expect(screen.getByRole('tab', { name: /limits/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /learning/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /reviews/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /lapses/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /debug/i })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('New cards per day')).toBeInTheDocument()
      })
    })

    it('renders Debug tab', () => {
      renderSettingsPage()

      expect(screen.getByRole('tab', { name: /debug/i })).toBeInTheDocument()
    })
  })

  describe('SRS settings', () => {
    it('loads and displays current settings', async () => {
      renderSettingsPage()

      await waitFor(() => {
        expect(apiClient.getSettings).toHaveBeenCalledWith('valid-token')
      })

      // Check that settings are displayed
      await waitFor(() => {
        const input = screen.getByLabelText(/new cards per day/i)
        expect(input).toHaveValue(20)
      })
    })

    it('shows lapse new interval slider', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Lapses tab
      await user.click(screen.getByRole('tab', { name: /lapses/i }))

      await waitFor(() => {
        expect(screen.getByText(/new interval after lapse/i)).toBeInTheDocument()
      })

      // Check that the slider value is displayed (0% for lapse_new_interval)
      expect(screen.getByText('0%')).toBeInTheDocument()
      // Check that slider is present
      const sliders = screen.getAllByRole('slider')
      expect(sliders.length).toBeGreaterThan(0)
    })

    it('enables save button when settings are changed', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/new cards per day/i)
      await user.clear(input)
      await user.type(input, '15')

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      expect(saveButton).not.toBeDisabled()
    })

    it('saves settings when save button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.updateSettings).mockResolvedValue({
        ...mockSettings,
        new_cards_per_day: 15,
      })

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/new cards per day/i)
      await user.clear(input)
      await user.type(input, '15')

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(apiClient.updateSettings).toHaveBeenCalledWith('valid-token', expect.objectContaining({
          new_cards_per_day: 15,
          lapse_new_interval: 0,
        }))
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Settings saved',
          description: 'Your SRS settings have been updated',
        })
      })
    })

    it('handles error when loading settings fails', async () => {
      vi.mocked(apiClient.getSettings).mockRejectedValue(new Error('API Error'))

      renderSettingsPage()

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        })
      })
    })

    it('handles error when saving settings fails', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.updateSettings).mockRejectedValue(new Error('API Error'))

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/new cards per day/i)
      await user.clear(input)
      await user.type(input, '15')

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to save settings',
          variant: 'destructive',
        })
      })
    })

    it('shows max reviews per day toggle and input', async () => {
      vi.mocked(apiClient.getSettings).mockResolvedValue({
        ...mockSettings,
        max_reviews_per_day: 150,
      })

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByRole('switch', { name: /maximum reviews per day/i })).toBeInTheDocument()
      })

      // Toggle should be checked when max_reviews_per_day is set
      const toggle = screen.getByRole('switch', { name: /maximum reviews per day/i })
      expect(toggle).toBeChecked()

      // Input should show the value (use id selector since label is on switch)
      const input = document.getElementById('max-reviews-per-day') as HTMLInputElement
      expect(input).toHaveValue(150)
    })

    it('shows learning steps input with loaded values', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Learning tab
      await user.click(screen.getByRole('tab', { name: /learning/i }))

      await waitFor(() => {
        expect(screen.getByText('Learning steps (minutes)')).toBeInTheDocument()
      })

      const input = document.getElementById('learning-steps') as HTMLInputElement
      expect(input).toHaveValue('1, 10')
    })

    it('shows relearning steps input with loaded values', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Lapses tab
      await user.click(screen.getByRole('tab', { name: /lapses/i }))

      await waitFor(() => {
        expect(screen.getByText('Relearning steps (minutes)')).toBeInTheDocument()
      })

      const input = document.getElementById('relearning-steps') as HTMLInputElement
      expect(input).toHaveValue('10')
    })

    it('shows graduating interval input with loaded value', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Learning tab
      await user.click(screen.getByRole('tab', { name: /learning/i }))

      await waitFor(() => {
        expect(screen.getByText('Graduating interval')).toBeInTheDocument()
      })

      const input = document.getElementById('graduating-interval') as HTMLInputElement
      expect(input).toHaveValue(1)
    })

    it('shows easy interval input with loaded value', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Learning tab
      await user.click(screen.getByRole('tab', { name: /learning/i }))

      await waitFor(() => {
        expect(screen.getByText('Easy interval')).toBeInTheDocument()
      })

      const input = document.getElementById('easy-interval') as HTMLInputElement
      expect(input).toHaveValue(4)
    })

    it('shows starting ease slider with value', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Reviews tab
      await user.click(screen.getByRole('tab', { name: /reviews/i }))

      await waitFor(() => {
        expect(screen.getByText(/starting ease/i)).toBeInTheDocument()
      })

      // Value should be displayed as percentage
      expect(screen.getByText('250%')).toBeInTheDocument()
    })

    it('shows easy bonus slider with value', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Reviews tab
      await user.click(screen.getByRole('tab', { name: /reviews/i }))

      await waitFor(() => {
        expect(screen.getByText(/easy bonus/i)).toBeInTheDocument()
      })

      // Value should be displayed as percentage
      expect(screen.getByText('130%')).toBeInTheDocument()
    })

    it('shows interval modifier slider with value', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Reviews tab
      await user.click(screen.getByRole('tab', { name: /reviews/i }))

      await waitFor(() => {
        expect(screen.getByText(/interval modifier/i)).toBeInTheDocument()
      })

      // Value should be displayed as percentage
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('shows maximum interval input', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.getSettings).mockResolvedValue({
        ...mockSettings,
        maximum_interval: 365,
      })

      renderSettingsPage()

      // Click Reviews tab
      await user.click(screen.getByRole('tab', { name: /reviews/i }))

      await waitFor(() => {
        expect(screen.getByText('Maximum interval')).toBeInTheDocument()
      })

      const input = document.getElementById('maximum-interval') as HTMLInputElement
      expect(input).toHaveValue(365)
    })

    it('saves all settings when save button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.updateSettings).mockResolvedValue({
        ...mockSettings,
        new_cards_per_day: 25,
      })

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toBeInTheDocument()
      })

      // Change new cards per day
      const newCardsInput = screen.getByLabelText(/new cards per day/i)
      await user.clear(newCardsInput)
      await user.type(newCardsInput, '25')

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        // Verify all settings are included in the save
        expect(apiClient.updateSettings).toHaveBeenCalledWith('valid-token', expect.objectContaining({
          new_cards_per_day: 25,
          learning_steps: [1, 10],
          relearning_steps: [10],
          graduating_interval: 1,
          easy_interval: 4,
          starting_ease: 2.5,
          easy_bonus: 1.3,
          interval_modifier: 1,
          lapse_new_interval: 0,
        }))
      })
    })

    it('validates learning steps and shows error for empty input', async () => {
      const user = userEvent.setup()

      renderSettingsPage()

      // Click Learning tab
      await user.click(screen.getByRole('tab', { name: /learning/i }))

      await waitFor(() => {
        expect(screen.getByText('Learning steps (minutes)')).toBeInTheDocument()
      })

      const input = document.getElementById('learning-steps') as HTMLInputElement
      await user.clear(input)

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid learning steps',
          description: 'Please enter at least one learning step',
          variant: 'destructive',
        })
      })
    })

    it('validates relearning steps and shows error for empty input', async () => {
      const user = userEvent.setup()

      renderSettingsPage()

      // Click Lapses tab
      await user.click(screen.getByRole('tab', { name: /lapses/i }))

      await waitFor(() => {
        expect(screen.getByText('Relearning steps (minutes)')).toBeInTheDocument()
      })

      const input = document.getElementById('relearning-steps') as HTMLInputElement
      await user.clear(input)

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid relearning steps',
          description: 'Please enter at least one relearning step',
          variant: 'destructive',
        })
      })
    })

    it('resets all settings to defaults when reset button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.getSettings).mockResolvedValue({
        ...mockSettings,
        new_cards_per_day: 50,
        graduating_interval: 5,
        easy_interval: 10,
        starting_ease: 3.0,
      })

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toHaveValue(50)
      })

      const resetButton = screen.getByRole('button', { name: /^reset$/i })
      await user.click(resetButton)

      // Check that Limits tab values are reset to defaults
      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toHaveValue(20)
      })

      // Check Learning tab values
      await user.click(screen.getByRole('tab', { name: /learning/i }))
      const gradInput = document.getElementById('graduating-interval') as HTMLInputElement
      const easyInput = document.getElementById('easy-interval') as HTMLInputElement
      expect(gradInput).toHaveValue(1)
      expect(easyInput).toHaveValue(4)

      // Check Reviews tab values
      await user.click(screen.getByRole('tab', { name: /reviews/i }))
      expect(screen.getByText('250%')).toBeInTheDocument() // starting_ease
    })

    it('shows save button as disabled when no changes made', async () => {
      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/new cards per day/i)).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      expect(saveButton).toBeDisabled()
    })

    it('enables max reviews input when toggle is switched on', async () => {
      const user = userEvent.setup()

      renderSettingsPage()

      await waitFor(() => {
        expect(screen.getByRole('switch', { name: /maximum reviews per day/i })).toBeInTheDocument()
      })

      const toggle = screen.getByRole('switch', { name: /maximum reviews per day/i })
      expect(toggle).not.toBeChecked()

      // Input should not be visible when toggle is off
      expect(document.getElementById('max-reviews-per-day')).not.toBeInTheDocument()

      // Click toggle
      await user.click(toggle)

      // Now input should be visible with default value
      await waitFor(() => {
        expect(document.getElementById('max-reviews-per-day')).toBeInTheDocument()
      })
      const input = document.getElementById('max-reviews-per-day') as HTMLInputElement
      expect(input).toHaveValue(200)
    })

    it('parses comma-separated learning steps correctly', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.updateSettings).mockResolvedValue(mockSettings)

      renderSettingsPage()

      // Click Learning tab
      await user.click(screen.getByRole('tab', { name: /learning/i }))

      await waitFor(() => {
        expect(screen.getByText('Learning steps (minutes)')).toBeInTheDocument()
      })

      const input = document.getElementById('learning-steps') as HTMLInputElement
      await user.clear(input)
      await user.type(input, '1, 5, 15, 30')

      const saveButton = screen.getByRole('button', { name: /^save$/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(apiClient.updateSettings).toHaveBeenCalledWith('valid-token', expect.objectContaining({
          learning_steps: [1, 5, 15, 30],
        }))
      })
    })
  })

  describe('debug tools - review queue stats', () => {
    it('shows refresh stats button', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      expect(
        screen.getByRole('button', { name: /refresh stats/i }),
      ).toBeInTheDocument()
    })

    it('shows initial message when no data loaded', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      expect(
        screen.getByText(/click "refresh stats" to load/i),
      ).toBeInTheDocument()
    })

    it('loads and displays queue stats when refresh is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.getReviewQueue).mockResolvedValue(mockQueueResponse)

      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      const button = screen.getByRole('button', { name: /refresh stats/i })
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('18')).toBeInTheDocument() // total_count
      })

      expect(screen.getByText('10')).toBeInTheDocument() // new_count
      expect(screen.getByText('5')).toBeInTheDocument() // due_count
      expect(screen.getByText('15')).toBeInTheDocument() // new_remaining_today
    })

    it('handles error when loading queue stats fails', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.getReviewQueue).mockRejectedValue(
        new Error('API Error'),
      )

      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      const button = screen.getByRole('button', { name: /refresh stats/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load debug data',
          variant: 'destructive',
        })
      })
    })

    it('shows loading state when fetching stats', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.getReviewQueue).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockQueueResponse), 100)),
      )

      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      const button = screen.getByRole('button', { name: /refresh stats/i })
      await user.click(button)

      expect(screen.getByText('Loading...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText(/refresh stats/i)).toBeInTheDocument()
      })
    })
  })

  describe('debug tools - reset daily reviews', () => {
    it('shows Reset Reviews button', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      expect(
        screen.getByRole('button', { name: /reset reviews/i }),
      ).toBeInTheDocument()
    })

    it('calls API and shows success message when reset is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.resetDailyReviews).mockResolvedValue({
        message: 'Reset complete',
        deleted_count: 5,
        new_items_added: 20,
      })
      vi.mocked(apiClient.getReviewQueue).mockResolvedValue(mockQueueResponse)

      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      const button = screen.getByRole('button', { name: /reset reviews/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockStartLoading).toHaveBeenCalled()
      })

      await waitFor(
        () => {
          expect(mockToast).toHaveBeenCalledWith({
            title: 'Success',
            description: 'Reset 5 review(s) for today',
          })
        },
        { timeout: 3000 },
      )

      await waitFor(
        () => {
          expect(mockStopLoading).toHaveBeenCalled()
        },
        { timeout: 3000 },
      )
    })

    it('handles error when reset fails', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.resetDailyReviews).mockRejectedValue(
        new Error('API Error'),
      )

      renderSettingsPage()

      // Click Debug tab to show debug content
      await user.click(screen.getByRole('tab', { name: /debug/i }))

      const button = screen.getByRole('button', { name: /reset reviews/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to reset daily reviews',
          variant: 'destructive',
        })
      })

      expect(mockStopLoading).toHaveBeenCalled()
    })
  })
})
