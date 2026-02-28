import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardRow } from './CardRow'
import type { Card } from '@/types'

const mockCard: Card = {
  id: 'CARD#123',
  card_id: '123',
  user_id: 'user1',
  front: 'hallo',
  back: 'hello',
  explanation: 'A greeting',
  category: 'Greetings',
  tags: ['basic', 'common'],
  source: 'manual',
  created_at: '2024-01-01T00:00:00Z',
}

const mockCardWithInsights: Card = {
  ...mockCard,
  id: 'CARD#124',
  card_id: '124',
  insights: [
    {
      type: 'compound',
      content: 'Test insight',
      status: 'approved',
      generated_at: '2024-01-01T00:00:00Z',
    },
    {
      type: 'verb_forms',
      content: 'Another insight',
      status: 'pending',
      generated_at: '2024-01-01T00:00:00Z',
    },
  ],
}

describe('CardRow', () => {
  it('should render card in view mode by default', () => {
    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    expect(screen.getByText('hallo')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('A greeting')).toBeInTheDocument()
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('should show edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    const row = screen.getByRole('row')
    const buttons = within(row).getAllByRole('button')
    const editButton = buttons[0] // First button is edit
    await user.click(editButton)

    // Should show input fields (front, back, explanation - tags column removed, insights added)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(3)
  })

  it('should allow editing card values', async () => {
    const user = userEvent.setup()

    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    // Click edit button
    const row = screen.getByRole('row')
    const buttons = within(row).getAllByRole('button')
    const editButton = buttons[0] // First button is edit
    await user.click(editButton)

    // Edit front text
    const inputs = screen.getAllByRole('textbox')
    const frontInput = inputs[0]
    await user.clear(frontInput)
    await user.type(frontInput, 'hoi')

    expect(frontInput).toHaveValue('hoi')
  })

  it('should call onUpdate when save button is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn().mockResolvedValue(undefined)

    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={onUpdate} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    // Click edit button
    const row = screen.getByRole('row')
    const buttons = within(row).getAllByRole('button')
    const editButton = buttons[0]
    await user.click(editButton)

    // Edit front text
    const inputs = screen.getAllByRole('textbox')
    await user.clear(inputs[0])
    await user.type(inputs[0], 'hoi')

    // Click save button (first button after entering edit mode)
    const saveButton = within(row).getAllByRole('button')[0]
    await user.click(saveButton)

    expect(onUpdate).toHaveBeenCalledWith('CARD#123', expect.objectContaining({
      front: 'hoi',
    }))
  })

  it('should cancel editing when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    // Click edit button
    const row = screen.getByRole('row')
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[0])

    // Verify we're in edit mode (3 fields: front, back, explanation)
    expect(screen.getAllByRole('textbox')).toHaveLength(3)

    // Click cancel button (second button in edit mode)
    const cancelButton = within(row).getAllByRole('button')[1]
    await user.click(cancelButton)

    // Should be back in view mode
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('hallo')).toBeInTheDocument()
  })

  it('should call onDelete when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={onDelete} />
        </tbody>
      </table>
    )

    // Click delete button (second button in view mode)
    const row = screen.getByRole('row')
    const buttons = within(row).getAllByRole('button')
    const deleteButton = buttons[1]
    await user.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith(mockCard)
  })

  it('should handle cards without optional fields', () => {
    const minimalCard: Card = {
      id: 'CARD#456',
      card_id: '456',
      user_id: 'user1',
      front: 'kat',
      back: 'cat',
      created_at: '2024-01-01T00:00:00Z',
    }

    render(
      <table>
        <tbody>
          <CardRow card={minimalCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    expect(screen.getByText('kat')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    // Should show '-' for empty fields (explanation and insights)
    expect(screen.getAllByText('-')).toHaveLength(2)
  })

  it('should display insight badges when card has insights', () => {
    render(
      <table>
        <tbody>
          <CardRow card={mockCardWithInsights} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    // Should show approved and pending badges
    expect(screen.getByText('1 approved')).toBeInTheDocument()
    expect(screen.getByText('1 pending')).toBeInTheDocument()
  })

  it('should show checkbox when selection props are provided', async () => {
    const onToggleSelect = vi.fn()

    render(
      <table>
        <tbody>
          <CardRow
            card={mockCard}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
            isSelected={false}
            onToggleSelect={onToggleSelect}
          />
        </tbody>
      </table>
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('should not show checkbox when selection props are not provided', () => {
    render(
      <table>
        <tbody>
          <CardRow card={mockCard} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
