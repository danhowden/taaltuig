import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ExtraCardsCard } from './ExtraCardsCard'

function renderExtraCardsCard(
  onContinue: (extraCards: number) => void,
  loadingExtraCards?: number | null
) {
  return render(
    <ExtraCardsCard onContinue={onContinue} loadingExtraCards={loadingExtraCards} />,
  )
}

describe('ExtraCardsCard', () => {
  it('renders the title', () => {
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    expect(screen.getByText(/don't want to wait/i)).toBeInTheDocument()
  })

  it('renders description text', () => {
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    expect(screen.getByText(/study extra new cards now/i)).toBeInTheDocument()
  })

  it('renders all four card count buttons', () => {
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    expect(screen.getByRole('button', { name: '+3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+25' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+50' })).toBeInTheDocument()
  })

  it('calls onContinue with 3 when +3 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    await user.click(screen.getByRole('button', { name: '+3' }))

    expect(mockOnContinue).toHaveBeenCalledWith(3)
  })

  it('calls onContinue with 10 when +10 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    await user.click(screen.getByRole('button', { name: '+10' }))

    expect(mockOnContinue).toHaveBeenCalledWith(10)
  })

  it('calls onContinue with 25 when +25 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    await user.click(screen.getByRole('button', { name: '+25' }))

    expect(mockOnContinue).toHaveBeenCalledWith(25)
  })

  it('calls onContinue with 50 when +50 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue)

    await user.click(screen.getByRole('button', { name: '+50' }))

    expect(mockOnContinue).toHaveBeenCalledWith(50)
  })

  it('disables all buttons when loadingExtraCards is set', () => {
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue, 10)

    expect(screen.getByRole('button', { name: '+3' })).toBeDisabled()
    // +10 button shows spinner when loading, so query differently
    expect(screen.getAllByRole('button')[1]).toBeDisabled()
    expect(screen.getByRole('button', { name: '+25' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+50' })).toBeDisabled()
  })

  it('shows loading spinner on the button being loaded', () => {
    const mockOnContinue = vi.fn()
    renderExtraCardsCard(mockOnContinue, 25)

    // The +25 button should have a loader (button at index 2)
    const buttons = screen.getAllByRole('button')
    expect(buttons[2].querySelector('.animate-spin')).toBeInTheDocument()
  })
})
