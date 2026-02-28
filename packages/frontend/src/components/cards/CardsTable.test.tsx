import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardsTable } from './CardsTable'
import type { Card } from '@/types'

const mockCards: Card[] = [
  {
    id: 'CARD#1',
    card_id: '1',
    user_id: 'user1',
    front: 'hallo',
    back: 'hello',
    explanation: 'A greeting',
    category: 'Greetings',
    tags: ['basic'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'CARD#2',
    card_id: '2',
    user_id: 'user1',
    front: 'kat',
    back: 'cat',
    category: 'Animals',
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('CardsTable', () => {
  it('should render table headers', () => {
    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('Front (Dutch)')).toBeInTheDocument()
    expect(screen.getByText('Back (English)')).toBeInTheDocument()
    expect(screen.getByText('Explanation')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('should render all cards', () => {
    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('hallo')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('kat')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
  })

  it('should render empty table when no cards', () => {
    render(
      <CardsTable cards={[]} onUpdateCard={vi.fn()} onDeleteCard={vi.fn()} />
    )

    expect(screen.getByText('Front (Dutch)')).toBeInTheDocument()
    expect(screen.queryByText('hallo')).not.toBeInTheDocument()
  })

  it('should pass onUpdateCard to CardRow', async () => {
    const user = userEvent.setup()
    const onUpdateCard = vi.fn().mockResolvedValue(undefined)

    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={onUpdateCard}
        onDeleteCard={vi.fn()}
      />
    )

    // Find first card row's edit button and click it
    const rows = screen.getAllByRole('row')
    const firstCardRow = rows[1] // Skip header row
    const editButton = firstCardRow.querySelectorAll('button')[0]
    await user.click(editButton)

    // Edit and save
    const inputs = screen.getAllByRole('textbox')
    await user.clear(inputs[0])
    await user.type(inputs[0], 'hoi')

    const saveButton = firstCardRow.querySelectorAll('button')[0]
    await user.click(saveButton)

    expect(onUpdateCard).toHaveBeenCalledWith('CARD#1', expect.objectContaining({
      front: 'hoi',
    }))
  })

  it('should show delete dialog when delete is clicked', async () => {
    const user = userEvent.setup()

    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Click delete button on first card
    const rows = screen.getAllByRole('row')
    const firstCardRow = rows[1]
    const deleteButton = firstCardRow.querySelectorAll('button')[1]
    await user.click(deleteButton)

    // Delete dialog should be visible
    expect(screen.getByText('Delete Card')).toBeInTheDocument()
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
  })

  it('should call onDeleteCard when delete is confirmed', async () => {
    const user = userEvent.setup()
    const onDeleteCard = vi.fn().mockResolvedValue(undefined)

    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={vi.fn()}
        onDeleteCard={onDeleteCard}
      />
    )

    // Click delete button
    const rows = screen.getAllByRole('row')
    const firstCardRow = rows[1]
    const deleteButton = firstCardRow.querySelectorAll('button')[1]
    await user.click(deleteButton)

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(onDeleteCard).toHaveBeenCalledWith('CARD#1')
    })
  })

  it('should close delete dialog when cancel is clicked', async () => {
    const user = userEvent.setup()

    render(
      <CardsTable
        cards={mockCards}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Open delete dialog
    const rows = screen.getAllByRole('row')
    const firstCardRow = rows[1]
    const deleteButton = firstCardRow.querySelectorAll('button')[1]
    await user.click(deleteButton)

    expect(screen.getByText('Delete Card')).toBeInTheDocument()

    // Cancel deletion
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(screen.queryByText('Delete Card')).not.toBeInTheDocument()
  })
})
