import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ChevronDown, ChevronRight, Pencil, Sparkles, Loader2 } from 'lucide-react'
import { CardsTable } from './CardsTable'
import { CategoryRenameDialog } from './CategoryRenameDialog'
import type { Card } from '@/types'
import { useState, useMemo, memo } from 'react'

interface CategorySectionProps {
  category: string
  cards: Card[]
  isCollapsed: boolean
  isActive: boolean
  onToggleCollapse: () => void
  onToggleActive: () => void
  onRenameCategory: (newName: string) => Promise<void>
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
  onGenerateInsights?: (cardIds: string[]) => Promise<void>
  isGeneratingInsights?: boolean
  // Selection props
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  onSelectAll?: (cardIds: string[]) => void
  onDeselectAll?: () => void
}

export const CategorySection = memo(function CategorySection({
  category,
  cards,
  isCollapsed,
  isActive,
  onToggleCollapse,
  onToggleActive,
  onRenameCategory,
  onUpdateCard,
  onDeleteCard,
  onGenerateInsights,
  isGeneratingInsights = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: CategorySectionProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // Count cards without insights in this category
  const cardsWithoutInsights = useMemo(() => {
    return cards.filter((card) => !card.insights || card.insights.length === 0)
  }, [cards])

  const handleRename = async (newName: string) => {
    await onRenameCategory(newName)
    setRenameDialogOpen(false)
  }

  return (
    <>
      <Collapsible
        open={!isCollapsed}
        onOpenChange={onToggleCollapse}
        className="border-b"
      >
        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <h2 className="text-sm font-semibold">{category}</h2>
            <span className="text-xs text-muted-foreground">
              ({cards.length})
            </span>
          </CollapsibleTrigger>
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {onGenerateInsights && cardsWithoutInsights.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateInsights(cardsWithoutInsights.map((c) => c.card_id))}
                disabled={isGeneratingInsights}
                className="h-7 px-2"
                title={`Generate insights for ${cardsWithoutInsights.length} cards`}
              >
                {isGeneratingInsights ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                <span className="text-xs">Insights ({cardsWithoutInsights.length})</span>
              </Button>
            )}
            {category !== 'Uncategorized' && (
              <>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`category-active-${category}`}
                    checked={isActive}
                    onCheckedChange={onToggleActive}
                    className="scale-75"
                  />
                  <label
                    htmlFor={`category-active-${category}`}
                    className="text-xs cursor-pointer whitespace-nowrap"
                    title="When enabled, new cards from this category will appear in reviews. Existing progress is not affected."
                  >
                    New cards
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenameDialogOpen(true)}
                  className="h-7 px-2"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  <span className="text-xs">Rename</span>
                </Button>
              </>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <CardsTable
            cards={cards}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
        </CollapsibleContent>
      </Collapsible>

      {category !== 'Uncategorized' && (
        <CategoryRenameDialog
          isOpen={renameDialogOpen}
          categoryName={category}
          onRename={handleRename}
          onClose={() => setRenameDialogOpen(false)}
        />
      )}
    </>
  )
})
