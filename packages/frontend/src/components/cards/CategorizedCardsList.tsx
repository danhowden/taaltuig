import { useMemo } from 'react'
import { CategorySection } from './CategorySection'
import type { Card } from '@/types'
import { categorizeCards, filterCardsBySearch } from '@/utils/cardFilters'

interface CategorizedCardsListProps {
  cards: Card[]
  searchQuery: string
  disabledCategories: string[] | null
  collapsedCategories: Set<string>
  onToggleCategory: (category: string) => void
  onToggleCategoryActive: (category: string) => void
  onRenameCategory: (oldName: string, newName: string) => Promise<void>
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
  onGenerateInsights?: (cardIds: string[]) => Promise<void>
  generatingInsightsCategory?: string | null
  // Selection props
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  onSelectAll?: (cardIds: string[]) => void
  onDeselectAll?: () => void
}

export function CategorizedCardsList({
  cards,
  searchQuery,
  disabledCategories,
  collapsedCategories,
  onToggleCategory,
  onToggleCategoryActive,
  onRenameCategory,
  onUpdateCard,
  onDeleteCard,
  onGenerateInsights,
  generatingInsightsCategory,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: CategorizedCardsListProps) {
  const categorizedCards = useMemo(() => {
    const filtered = filterCardsBySearch(cards, searchQuery)
    return categorizeCards(filtered)
  }, [cards, searchQuery])

  if (categorizedCards.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {searchQuery
          ? 'No cards found'
          : 'No cards yet. Create your first card or import an Anki deck!'}
      </div>
    )
  }

  return (
    <div className="bg-background">
      {categorizedCards.map(([category, categoryCards]) => {
        const isCollapsed = collapsedCategories.has(category)
        const isActive =
          disabledCategories === null ||
          !disabledCategories.includes(category)

        return (
          <CategorySection
            key={category}
            category={category}
            cards={categoryCards}
            isCollapsed={isCollapsed}
            isActive={isActive}
            onToggleCollapse={() => onToggleCategory(category)}
            onToggleActive={() => onToggleCategoryActive(category)}
            onRenameCategory={(newName) => onRenameCategory(category, newName)}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onGenerateInsights={onGenerateInsights}
            isGeneratingInsights={generatingInsightsCategory === category}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
        )
      })}
    </div>
  )
}
