import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategorizedCardsList } from './CategorizedCardsList'
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
  {
    id: 'CARD#3',
    card_id: '3',
    user_id: 'user1',
    front: 'kat',
    back: 'cat',
    category: 'Animals',
    created_at: '2024-01-03T00:00:00Z',
  },
]

describe('CategorizedCardsList', () => {
  it('should render categories in alphabetical order', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery=""
        disabledCategories={[]}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    const categoryHeaders = screen.getAllByRole('button', { name: /Animals|Greetings/ })
    expect(categoryHeaders[0]).toHaveTextContent('Animals')
    expect(categoryHeaders[1]).toHaveTextContent('Greetings')
  })

  it('should show card counts for each category', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery=""
        disabledCategories={[]}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('(1)')).toBeInTheDocument() // Animals
    expect(screen.getByText('(2)')).toBeInTheDocument() // Greetings
  })

  it('should filter cards by search query', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery="kat"
        disabledCategories={[]}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Only Animals category should be visible
    expect(screen.getByText('Animals')).toBeInTheDocument()
    expect(screen.queryByText('Greetings')).not.toBeInTheDocument()
  })

  it('should show empty state when no cards', () => {
    render(
      <CategorizedCardsList
        cards={[]}
        searchQuery=""
        disabledCategories={[]}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText(/No cards yet/)).toBeInTheDocument()
  })

  it('should show "No cards found" when search has no results', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery="xyz123"
        disabledCategories={[]}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    expect(screen.getByText('No cards found')).toBeInTheDocument()
  })

  it('should respect collapsed categories', () => {
    const collapsedCategories = new Set(['Animals'])

    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery=""
        disabledCategories={[]}
        collapsedCategories={collapsedCategories}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Animals category should be collapsed - card not visible
    expect(screen.queryByText('kat')).not.toBeInTheDocument()

    // Greetings category should be expanded - cards visible
    expect(screen.getByText('hallo')).toBeInTheDocument()
  })

  it('should mark categories as inactive based on disabled categories', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery=""
        disabledCategories={['Animals']}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // Both categories should be rendered
    expect(screen.getByText('Animals')).toBeInTheDocument()
    expect(screen.getByText('Greetings')).toBeInTheDocument()

    // The switch for Animals should be unchecked (inactive)
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).not.toBeChecked() // Animals
    expect(switches[1]).toBeChecked() // Greetings
  })

  it('should handle null disabled_categories', () => {
    render(
      <CategorizedCardsList
        cards={mockCards}
        searchQuery=""
        disabledCategories={null}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onToggleCategoryActive={vi.fn()}
        onRenameCategory={vi.fn()}
        onUpdateCard={vi.fn()}
        onDeleteCard={vi.fn()}
      />
    )

    // All categories should be active when disabled_categories is null
    const switches = screen.getAllByRole('switch')
    switches.forEach((switchEl) => {
      expect(switchEl).toBeChecked()
    })
  })
})
