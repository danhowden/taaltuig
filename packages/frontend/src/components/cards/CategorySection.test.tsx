import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategorySection } from './CategorySection'
import type { Card } from '@/types'

const mockCards: Card[] = [
  {
    id: 'CARD#1',
    card_id: '1',
    user_id: 'user1',
    front: 'hallo',
    back: 'hello',
    category: 'Greetings',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'CARD#2',
    card_id: '2',
    user_id: 'user1',
    front: 'goedemorgen',
    back: 'good morning',
    category: 'Greetings',
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('CategorySection', () => {
  it('should render category header with name and count', () => {
    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('Greetings')).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('should show collapsed icon when collapsed', () => {
    const { container } = render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={true}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // ChevronRight should be visible when collapsed
    expect(container.querySelector('.lucide-chevron-right')).toBeInTheDocument()
  })

  it('should show expanded icon when not collapsed', () => {
    const { container } = render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // ChevronDown should be visible when expanded
    expect(container.querySelector('.lucide-chevron-down')).toBeInTheDocument()
  })

  it('should call onToggleCollapse when header is clicked', async () => {
    const user = userEvent.setup()
    const onToggleCollapse = vi.fn()

    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={onToggleCollapse}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    const header = screen.getByText('Greetings').closest('button')
    await user.click(header!)

    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it('should show active switch for non-Uncategorized categories', () => {
    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByLabelText('New cards')).toBeInTheDocument()
  })

  it('should not show active switch for Uncategorized', () => {
    render(
      <CategorySection
        category="Uncategorized"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('New cards')).not.toBeInTheDocument()
  })

  it('should call onToggleActive when switch is toggled', async () => {
    const user = userEvent.setup()
    const onToggleActive = vi.fn()

    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={onToggleActive}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    const toggle = screen.getByRole('switch')
    await user.click(toggle)

    expect(onToggleActive).toHaveBeenCalledTimes(1)
  })

  it('should show rename button for non-Uncategorized categories', () => {
    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('Rename')).toBeInTheDocument()
  })

  it('should not show rename button for Uncategorized', () => {
    render(
      <CategorySection
        category="Uncategorized"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.queryByText('Rename')).not.toBeInTheDocument()
  })

  it('should open rename dialog when rename button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    const renameButton = screen.getByText('Rename')
    await user.click(renameButton)

    expect(screen.getByRole('heading', { name: 'Rename Category' })).toBeInTheDocument()
  })

  it('should call onRenameCategory when rename is confirmed', async () => {
    const user = userEvent.setup()
    const onRenameCategory = vi.fn().mockResolvedValue(undefined)

    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={onRenameCategory}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Open rename dialog
    const renameButton = screen.getByText('Rename')
    await user.click(renameButton)

    // Change name
    const input = screen.getByPlaceholderText('Enter new category name')
    await user.clear(input)
    await user.type(input, 'Basic Phrases')

    // Confirm rename
    const confirmButton = screen.getByRole('button', { name: 'Rename Category' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(onRenameCategory).toHaveBeenCalledWith('Basic Phrases')
    })
  })

  it('should render cards table when expanded', () => {
    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={false}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Table headers should be visible
    expect(screen.getByText('Front (Dutch)')).toBeInTheDocument()
    expect(screen.getByText('Back (English)')).toBeInTheDocument()

    // Cards should be visible
    expect(screen.getByText('hallo')).toBeInTheDocument()
    expect(screen.getByText('goedemorgen')).toBeInTheDocument()
  })

  it('should not render cards table when collapsed', () => {
    render(
      <CategorySection
        category="Greetings"
        cards={mockCards}
        isCollapsed={true}
        isActive={true}
        onToggleCollapse={vi.fn()}
        onToggleActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Cards should not be visible when collapsed
    expect(screen.queryByText('hallo')).not.toBeInTheDocument()
  })
})
