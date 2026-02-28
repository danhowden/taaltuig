import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

function renderEmptyState(onContinue?: (extraCards: number) => void, loadingExtraCards?: number | null) {
  return render(
    <EmptyState onContinue={onContinue} loadingExtraCards={loadingExtraCards} />,
  )
}

describe('EmptyState', () => {
  it('renders empty state message in Dutch', () => {
    renderEmptyState()

    expect(screen.getByText('Geen kaarten')).toBeInTheDocument()
  })

  it('shows extra cards section when onContinue is provided', () => {
    const mockOnContinue = vi.fn()
    renderEmptyState(mockOnContinue)

    expect(screen.getByText(/don't want to wait/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+25' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+50' })).toBeInTheDocument()
  })

  it('does not show extra cards section when onContinue is not provided', () => {
    renderEmptyState()

    expect(screen.queryByText(/don't want to wait/i)).not.toBeInTheDocument()
  })

  it('calls onContinue with 10 when +10 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderEmptyState(mockOnContinue)

    const button = screen.getByRole('button', { name: '+10' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(10)
  })

  it('calls onContinue with 25 when +25 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderEmptyState(mockOnContinue)

    const button = screen.getByRole('button', { name: '+25' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(25)
  })

  it('calls onContinue with 50 when +50 button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnContinue = vi.fn()
    renderEmptyState(mockOnContinue)

    const button = screen.getByRole('button', { name: '+50' })
    await user.click(button)

    expect(mockOnContinue).toHaveBeenCalledWith(50)
  })

  it('disables buttons when loading extra cards', () => {
    const mockOnContinue = vi.fn()
    renderEmptyState(mockOnContinue, 25)

    expect(screen.getByRole('button', { name: '+3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+10' })).toBeDisabled()
    // +25 shows spinner when loading
    expect(screen.getAllByRole('button')[2]).toBeDisabled()
    expect(screen.getByRole('button', { name: '+50' })).toBeDisabled()
  })
})
