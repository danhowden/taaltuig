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
import type { SelectionProps } from '@/types/selection'
import { useSelectionState } from '@/types/selection'
import { useState, memo } from 'react'

interface CardsTableProps extends SelectionProps {
  cards: Card[]
  onUpdateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDeleteCard: (cardId: string) => Promise<void>
}

export const CardsTable = memo(function CardsTable({
  cards,
  onUpdateCard,
  onDeleteCard,
  ...selectionProps
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

  const { hasSelection, allSelected, isIndeterminate, handleSelectAllChange } =
    useSelectionState(cards, selectionProps)

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
            <TableHead className="w-[70px] py-1.5">Exercises</TableHead>
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
              isSelected={hasSelection ? selectionProps.selectedIds!.has(card.card_id) : undefined}
              onToggleSelect={hasSelection ? () => selectionProps.onToggleSelect!(card.card_id) : undefined}
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
