import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { CardRow } from './CardRow'
import { CardDeleteDialog } from './CardDeleteDialog'
import type { Card } from '@/types'
import { useState, memo } from 'react'

interface CardsTableProps {
  cards: Card[]
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
  // Selection props
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  onSelectAll?: (cardIds: string[]) => void
  onDeselectAll?: () => void
}

export const CardsTable = memo(function CardsTable({
  cards,
  onUpdateCard,
  onDeleteCard,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: CardsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null)

  const openDeleteDialog = (card: Card) => {
    setCardToDelete(card)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!cardToDelete) return

    await onDeleteCard(cardToDelete.id)
    setDeleteDialogOpen(false)
    setCardToDelete(null)
  }

  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setCardToDelete(null)
  }

  // Selection state
  const hasSelection = selectedIds !== undefined && onToggleSelect !== undefined
  const allSelected = hasSelection && cards.length > 0 && cards.every((c) => selectedIds!.has(c.card_id))
  const someSelected = hasSelection && cards.some((c) => selectedIds!.has(c.card_id))
  const isIndeterminate = someSelected && !allSelected

  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      onSelectAll?.(cards.map((c) => c.card_id))
    } else {
      onDeselectAll?.()
    }
  }

  return (
    <>
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="h-8">
            {hasSelection && (
              <TableHead className="w-[40px] py-1.5">
                <Checkbox
                  checked={isIndeterminate ? 'indeterminate' : allSelected}
                  onCheckedChange={handleSelectAllChange}
                  aria-label="Select all cards"
                />
              </TableHead>
            )}
            <TableHead className="w-[200px] py-1.5">Front (Dutch)</TableHead>
            <TableHead className="w-[200px] py-1.5">Back (English)</TableHead>
            <TableHead className="w-[150px] py-1.5">Explanation</TableHead>
            <TableHead className="w-[100px] py-1.5">Insights</TableHead>
            <TableHead className="w-[80px] py-1.5">Source</TableHead>
            <TableHead className="w-[80px] py-1.5">Created</TableHead>
            <TableHead className="w-[70px] py-1.5">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={openDeleteDialog}
              isSelected={hasSelection ? selectedIds!.has(card.card_id) : undefined}
              onToggleSelect={hasSelection ? () => onToggleSelect!(card.card_id) : undefined}
            />
          ))}
        </TableBody>
      </Table>

      <CardDeleteDialog
        isOpen={deleteDialogOpen}
        card={cardToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  )
})
