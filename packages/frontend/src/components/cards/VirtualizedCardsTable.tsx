import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { InsightBadges, InsightHoverContent } from '@/components/cards/InsightBadges'
import { CardExercisesPopover } from '@/components/cards/CardExercisesPopover'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import type { Card } from '@/types'
import type { SelectionProps } from '@/types/selection'
import { useSelectionState } from '@/types/selection'

interface VirtualizedCardsTableProps extends SelectionProps {
  cards: Card[]
  onDeleteCard: (cardId: string) => Promise<void>
}

export function VirtualizedCardsTable({
  cards,
  onDeleteCard,
  ...selectionProps
}: VirtualizedCardsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  })

  const { hasSelection, allSelected, isIndeterminate, handleSelectAllChange } =
    useSelectionState(cards, selectionProps)

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div className="flex items-center bg-muted/50 text-xs font-medium text-muted-foreground border-b h-8 px-2">
        {hasSelection && (
          <div className="w-8 flex-shrink-0">
            <Checkbox
              checked={isIndeterminate ? 'indeterminate' : allSelected}
              onCheckedChange={handleSelectAllChange}
              aria-label="Select all cards"
            />
          </div>
        )}
        <div className="w-[200px] flex-shrink-0 px-2">Front</div>
        <div className="w-[200px] flex-shrink-0 px-2">Back</div>
        <div className="w-[120px] flex-shrink-0 px-2">Category</div>
        <div className="w-[100px] flex-shrink-0 px-2">Insights</div>
        <div className="w-[70px] flex-shrink-0 px-2">Exercises</div>
        <div className="w-[80px] flex-shrink-0 px-2">Source</div>
        <div className="w-[70px] flex-shrink-0 px-2">Actions</div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="h-[calc(100vh-200px)] overflow-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const card = cards[virtualRow.index]
            const isSelected = hasSelection && selectionProps.selectedIds!.has(card.card_id)

            return (
              <div
                key={card.card_id}
                className="absolute top-0 left-0 w-full flex items-center h-9 text-xs border-b hover:bg-muted/30 px-2"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {hasSelection && (
                  <div className="w-8 flex-shrink-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => selectionProps.onToggleSelect!(card.card_id)}
                    />
                  </div>
                )}
                <div className="w-[200px] flex-shrink-0 px-2 truncate" title={card.front}>
                  {card.front}
                </div>
                <div className="w-[200px] flex-shrink-0 px-2 truncate" title={card.back}>
                  {card.back}
                </div>
                <div className="w-[120px] flex-shrink-0 px-2 truncate text-muted-foreground" title={card.category}>
                  {card.category || '-'}
                </div>
                <div className="w-[100px] flex-shrink-0 px-2">
                  {card.insights && card.insights.length > 0 ? (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div className="flex gap-1 cursor-pointer">
                          <InsightBadges insights={card.insights} />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72" align="start">
                        <InsightHoverContent insights={card.insights} />
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div className="w-[70px] flex-shrink-0 px-2">
                  <CardExercisesPopover cardId={card.card_id} />
                </div>
                <div className="w-[80px] flex-shrink-0 px-2 text-muted-foreground">
                  {card.source || 'manual'}
                </div>
                <div className="w-[70px] flex-shrink-0 px-2 flex gap-0.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Edit card">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onDeleteCard(card.card_id)}
                    aria-label="Delete card"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
