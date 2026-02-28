import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Pencil, Trash2 } from 'lucide-react'
import type { Card } from '@/types'

interface VirtualizedCardsTableProps {
  cards: Card[]
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  onSelectAll?: (cardIds: string[]) => void
  onDeselectAll?: () => void
}

export function VirtualizedCardsTable({
  cards,
  onDeleteCard,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: VirtualizedCardsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  })

  const hasSelection = selectedIds !== undefined && onToggleSelect !== undefined
  const allSelected = hasSelection && cards.length > 0 && cards.every((c) => selectedIds!.has(c.card_id))
  const someSelected = hasSelection && cards.some((c) => selectedIds!.has(c.card_id))
  const isIndeterminate = someSelected && !allSelected

  const handleSelectAllChange = useCallback((checked: boolean) => {
    if (checked) {
      onSelectAll?.(cards.map((c) => c.card_id))
    } else {
      onDeselectAll?.()
    }
  }, [cards, onSelectAll, onDeselectAll])

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
        <div className="w-[180px] flex-shrink-0 px-2">Front</div>
        <div className="w-[180px] flex-shrink-0 px-2">Back</div>
        <div className="w-[120px] flex-shrink-0 px-2">Category</div>
        <div className="w-[100px] flex-shrink-0 px-2">Insights</div>
        <div className="w-[70px] flex-shrink-0 px-2">Source</div>
        <div className="w-[60px] flex-shrink-0 px-2">Actions</div>
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
            const isSelected = hasSelection && selectedIds!.has(card.card_id)
            const hasInsights = card.insights && card.insights.length > 0
            const approvedCount = card.insights?.filter(i => i.status === 'approved').length || 0
            const pendingCount = card.insights?.filter(i => i.status === 'pending').length || 0

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
                      onCheckedChange={() => onToggleSelect!(card.card_id)}
                    />
                  </div>
                )}
                <div className="w-[180px] flex-shrink-0 px-2 truncate" title={card.front}>
                  {card.front}
                </div>
                <div className="w-[180px] flex-shrink-0 px-2 truncate" title={card.back}>
                  {card.back}
                </div>
                <div className="w-[120px] flex-shrink-0 px-2 truncate text-muted-foreground" title={card.category}>
                  {card.category || '-'}
                </div>
                <div className="w-[100px] flex-shrink-0 px-2">
                  {hasInsights ? (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div className="flex gap-1 cursor-pointer">
                          {approvedCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-green-100 text-green-800">
                              {approvedCount}
                            </Badge>
                          )}
                          {pendingCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-yellow-100 text-yellow-800">
                              {pendingCount}
                            </Badge>
                          )}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72" align="start">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Insights</h4>
                          {card.insights?.filter(i => i.status !== 'rejected').map((insight, idx) => (
                            <div key={idx} className="text-xs">
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 mr-1 ${
                                insight.status === 'approved' ? 'border-green-500 text-green-700' : 'border-yellow-500 text-yellow-700'
                              }`}>
                                {insight.type}
                              </Badge>
                              <span className="text-muted-foreground">{insight.content}</span>
                            </div>
                          ))}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div className="w-[70px] flex-shrink-0 px-2 text-muted-foreground">
                  {card.source || 'manual'}
                </div>
                <div className="w-[60px] flex-shrink-0 px-2 flex gap-0.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onDeleteCard(card.card_id)}
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
