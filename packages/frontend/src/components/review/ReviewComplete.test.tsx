import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ReviewComplete } from './ReviewComplete'

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

function renderReviewComplete(onContinue?: (extraCards: number) => void, loadingExtraCards?: number | null) {
  return render(
    <ReviewComplete onContinue={onContinue} loadingExtraCards={loadingExtraCards} />,
  )
}

describe('ReviewComplete', () => {
  it('renders a Dutch celebration phrase', () => {
    renderReviewComplete()

    // Should display one of the Dutch phrases
    const dutchPhrases = ['Goed gedaan!', 'Prima werk!', 'Uitstekend!', 'Fantastisch!', 'Geweldig!']
    const foundPhrase = dutchPhrases.some(phrase => screen.queryByText(phrase))
    expect(foundPhrase).toBe(true)
  })

  it('shows extra cards section when onContinue is provided', () => {
    const mockOnContinue = vi.fn()
    renderReviewComplete(mockOnContinue)

    expect(screen.getByText(/don't want to wait/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+25' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+50' })).toBeInTheDocument()
  })

  it('does not show extra cards section when onContinue is not provided', () => {
    renderReviewComplete()

    expect(screen.queryByText(/don't want to wait/i)).not.toBeInTheDocument()
  })

  it('calls onContinue with 10 when +10 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderReviewComplete(mockOnContinue)

    const button = screen.getByRole('button', { name: '+10' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(10)
  })

  it('calls onContinue with 25 when +25 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderReviewComplete(mockOnContinue)

    const button = screen.getByRole('button', { name: '+25' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(25)
  })

  it('calls onContinue with 50 when +50 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderReviewComplete(mockOnContinue)

    const button = screen.getByRole('button', { name: '+50' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(50)
  })

  it('disables buttons when loading extra cards', () => {
    const mockOnContinue = vi.fn()
    renderReviewComplete(mockOnContinue, 10)

    expect(screen.getByRole('button', { name: '+3' })).toBeDisabled()
    // +10 shows spinner when loading
    expect(screen.getAllByRole('button')[1]).toBeDisabled()
    expect(screen.getByRole('button', { name: '+25' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+50' })).toBeDisabled()
  })
})
