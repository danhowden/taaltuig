import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkCardCreator } from './BulkCardCreator'

describe('BulkCardCreator', () => {
  it('should not render when isCreating is false', () => {
    render(
      <BulkCardCreator
        isCreating={false}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText('Add New Cards')).not.toBeInTheDocument()
  })

  it('should render when isCreating is true', () => {
    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Add New Cards')).toBeInTheDocument()
  })

  it('should render one card row by default', () => {
    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const frontInputs = screen.getAllByPlaceholderText('Dutch text (front)')
    expect(frontInputs).toHaveLength(1)
  })

  it('should add new row when Add Row button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const addButton = screen.getByText('Add Row')
    await user.click(addButton)

    const frontInputs = screen.getAllByPlaceholderText('Dutch text (front)')
    expect(frontInputs).toHaveLength(2)
  })

  it('should remove row when X button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Add a second row
    const addButton = screen.getByText('Add Row')
    await user.click(addButton)

    expect(screen.getAllByPlaceholderText('Dutch text (front)')).toHaveLength(2)

    // Remove the second row
    const removeButtons = screen.getAllByRole('button', { name: '' })
    const secondRemoveButton = removeButtons.find((btn) =>
      btn.querySelector('.lucide-x')
    )
    if (secondRemoveButton) {
      await user.click(secondRemoveButton)
    }

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Dutch text (front)')).toHaveLength(1)
    })
  })

  it('should disable remove button when only one row exists', () => {
    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const removeButtons = screen.getAllByRole('button')
    const removeButton = removeButtons.find((btn) =>
      btn.querySelector('.lucide-x')
    )

    expect(removeButton).toBeDisabled()
  })

  it('should update card values when inputs change', async () => {
    const user = userEvent.setup()
    const onCreateCards = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={onCreateCards}
        onCancel={vi.fn()}
      />
    )

    // Fill in the form
    const frontInput = screen.getByPlaceholderText('Dutch text (front)')
    const backInput = screen.getByPlaceholderText('English text (back)')
    const explanationInput = screen.getByPlaceholderText('Explanation (optional)')

    await user.type(frontInput, 'hallo')
    await user.type(backInput, 'hello')
    await user.type(explanationInput, 'A greeting')

    // Save
    const saveButton = screen.getByText('Save All')
    await user.click(saveButton)

    expect(onCreateCards).toHaveBeenCalledWith([
      {
        front: 'hallo',
        back: 'hello',
        explanation: 'A greeting',
        tags: [],
      },
    ])
  })

  it('should parse tags from comma-separated input', async () => {
    const user = userEvent.setup()
    const onCreateCards = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={onCreateCards}
        onCancel={vi.fn()}
      />
    )

    const frontInput = screen.getByPlaceholderText('Dutch text (front)')
    const backInput = screen.getByPlaceholderText('English text (back)')
    const tagsInput = screen.getByPlaceholderText('tag1,tag2')

    await user.type(frontInput, 'hallo')
    await user.type(backInput, 'hello')
    // Type the tags with commas and spaces
    await user.type(tagsInput, 'basic,common,greeting')

    const saveButton = screen.getByText('Save All')
    await user.click(saveButton)

    expect(onCreateCards).toHaveBeenCalledWith([
      expect.objectContaining({
        tags: ['basic', 'common', 'greeting'],
      }),
    ])
  })

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should reset form after successful save', async () => {
    const user = userEvent.setup()
    const onCreateCards = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={onCreateCards}
        onCancel={vi.fn()}
      />
    )

    // Fill in the form
    const frontInput = screen.getByPlaceholderText('Dutch text (front)')
    await user.type(frontInput, 'hallo')

    // Save
    const saveButton = screen.getByText('Save All')
    await user.click(saveButton)

    // Form should be reset
    await waitFor(() => {
      expect(frontInput).toHaveValue('')
    })
  })

  it('should handle multiple cards', async () => {
    const user = userEvent.setup()
    const onCreateCards = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCardCreator
        isCreating={true}
        onCreateCards={onCreateCards}
        onCancel={vi.fn()}
      />
    )

    // Add a second row
    const addButton = screen.getByText('Add Row')
    await user.click(addButton)

    // Fill in both rows
    const frontInputs = screen.getAllByPlaceholderText('Dutch text (front)')
    const backInputs = screen.getAllByPlaceholderText('English text (back)')

    await user.type(frontInputs[0], 'hallo')
    await user.type(backInputs[0], 'hello')
    await user.type(frontInputs[1], 'kat')
    await user.type(backInputs[1], 'cat')

    // Save
    const saveButton = screen.getByText('Save All')
    await user.click(saveButton)

    expect(onCreateCards).toHaveBeenCalledWith([
      {
        front: 'hallo',
        back: 'hello',
        explanation: '',
        tags: [],
      },
      {
        front: 'kat',
        back: 'cat',
        explanation: '',
        tags: [],
      },
    ])
  })
})
