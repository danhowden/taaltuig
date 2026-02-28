import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryRenameDialog } from './CategoryRenameDialog'

describe('CategoryRenameDialog', () => {
  it('should render when open', () => {
    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Rename Category' })).toBeInTheDocument()
    expect(screen.getByText('Greetings')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <CategoryRenameDialog
        isOpen={false}
        categoryName="Greetings"
        onRename={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Rename Category')).not.toBeInTheDocument()
  })

  it('should initialize input with current category name', () => {
    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Enter new category name')
    expect(input).toHaveValue('Greetings')
  })

  it('should update input value when typing', async () => {
    const user = userEvent.setup()

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Enter new category name')
    await user.clear(input)
    await user.type(input, 'Basic Phrases')

    expect(input).toHaveValue('Basic Phrases')
  })

  it('should call onRename with trimmed new name when Rename button is clicked', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={onRename}
        onClose={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Enter new category name')
    await user.clear(input)
    await user.type(input, '  Basic Phrases  ')

    const renameButton = screen.getByRole('button', { name: 'Rename Category' })
    await user.click(renameButton)

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('Basic Phrases')
    })
  })

  it('should call onRename when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={onRename}
        onClose={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Enter new category name')
    await user.clear(input)
    await user.type(input, 'Basic Phrases{Enter}')

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('Basic Phrases')
    })
  })

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={vi.fn()}
        onClose={onClose}
      />
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should show loading state while renaming', async () => {
    const user = userEvent.setup()
    let resolveRename: () => void
    const onRename = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve
        })
    )

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={onRename}
        onClose={vi.fn()}
      />
    )

    const renameButton = screen.getByRole('button', { name: 'Rename Category' })
    await user.click(renameButton)

    expect(screen.getByText('Renaming...')).toBeInTheDocument()
    expect(renameButton).toBeDisabled()

    resolveRename!()

    await waitFor(() => {
      expect(screen.queryByText('Renaming...')).not.toBeInTheDocument()
    })
  })

  it('should disable buttons while renaming', async () => {
    const user = userEvent.setup()
    let resolveRename: () => void
    const onRename = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve
        })
    )

    render(
      <CategoryRenameDialog
        isOpen={true}
        categoryName="Greetings"
        onRename={onRename}
        onClose={vi.fn()}
      />
    )

    const renameButton = screen.getByRole('button', { name: 'Rename Category' })
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })

    await user.click(renameButton)

    // Buttons should be disabled while renaming
    await waitFor(() => {
      expect(renameButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
    })

    // Resolve the rename
    resolveRename!()

    // Buttons should be enabled again
    await waitFor(() => {
      expect(renameButton).not.toBeDisabled()
      expect(cancelButton).not.toBeDisabled()
    })
  })
})
