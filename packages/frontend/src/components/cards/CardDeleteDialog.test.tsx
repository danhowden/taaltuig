import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardDeleteDialog } from './CardDeleteDialog'
import type { Card } from '@/types'

const mockCard: Card = {
  id: 'CARD#123',
  card_id: '123',
  user_id: 'user1',
  front: 'hallo',
  back: 'hello',
  explanation: 'A greeting',
  category: 'Greetings',
  created_at: '2024-01-01T00:00:00Z',
}

describe('CardDeleteDialog', () => {
  it('should render when open', () => {
    render(
      <CardDeleteDialog
        isOpen={true}
        card={mockCard}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Delete Card')).toBeInTheDocument()
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <CardDeleteDialog
        isOpen={false}
        card={mockCard}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText('Delete Card')).not.toBeInTheDocument()
  })

  it('should display card details', () => {
    render(
      <CardDeleteDialog
        isOpen={true}
        card={mockCard}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('hallo')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('should call onConfirm when Delete button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <CardDeleteDialog
        isOpen={true}
        card={mockCard}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <CardDeleteDialog
        isOpen={true}
        card={mockCard}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should handle null card gracefully', () => {
    render(
      <CardDeleteDialog
        isOpen={true}
        card={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Delete Card')).toBeInTheDocument()
    expect(screen.queryByText('Card to delete:')).not.toBeInTheDocument()
  })
})
