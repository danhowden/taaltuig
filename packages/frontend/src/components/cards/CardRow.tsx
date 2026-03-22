import { useState, memo } from 'react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { InsightBadges, InsightHoverContent } from '@/components/cards/InsightBadges'
import { CardExercisesPopover } from '@/components/cards/CardExercisesPopover'
import type { Card } from '@/types'

interface CardRowProps {
  card: Card
  onUpdate: (cardId: string, updates: Partial<Card>) => Promise<void>
  onDelete: (card: Card) => void
  isSelected?: boolean
  onToggleSelect?: () => void
}

export const CardRow = memo(function CardRow({
  card,
  onUpdate,
  onDelete,
  isSelected,
  onToggleSelect,
}: CardRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Partial<Card>>({})

  const startEditing = () => {
    setIsEditing(true)
    setEditValues({
      front: card.front,
      back: card.back,
      explanation: card.explanation,
      category: card.category,
      tags: card.tags,
    })
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditValues({})
  }

  const saveEdit = async () => {
    await onUpdate(card.id, editValues)
    setIsEditing(false)
    setEditValues({})
  }

  const hasInsights = card.insights && card.insights.length > 0
  const hasSelection = isSelected !== undefined && onToggleSelect !== undefined

  return (
    <TableRow className="h-9">
      {hasSelection && (
        <TableCell className="py-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select card: ${card.front}`}
          />
        </TableCell>
      )}
      <TableCell className="py-1">
        {isEditing ? (
          <Input
            className="h-7 text-xs"
            value={editValues.front || ''}
            onChange={(e) =>
              setEditValues((prev) => ({
                ...prev,
                front: e.target.value,
              }))
            }
          />
        ) : (
          <div className="max-w-[200px] truncate" title={card.front}>
            {card.front}
          </div>
        )}
      </TableCell>
      <TableCell className="py-1">
        {isEditing ? (
          <Input
            className="h-7 text-xs"
            value={editValues.back || ''}
            onChange={(e) =>
              setEditValues((prev) => ({
                ...prev,
                back: e.target.value,
              }))
            }
          />
        ) : (
          <div className="max-w-[200px] truncate" title={card.back}>
            {card.back}
          </div>
        )}
      </TableCell>
      <TableCell className="py-1">
        {isEditing ? (
          <Input
            className="h-7 text-xs"
            value={editValues.explanation || ''}
            onChange={(e) =>
              setEditValues((prev) => ({
                ...prev,
                explanation: e.target.value,
              }))
            }
          />
        ) : (
          <div className="max-w-[150px] truncate" title={card.explanation}>
            {card.explanation || '-'}
          </div>
        )}
      </TableCell>
      <TableCell className="py-1">
        {hasInsights ? (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="flex flex-wrap gap-1 cursor-pointer">
                <InsightBadges insights={card.insights!} />
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" align="start">
              <InsightHoverContent insights={card.insights!} />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="py-1">
        <CardExercisesPopover cardId={card.card_id} />
      </TableCell>
      <TableCell className="py-1 text-xs">{card.source || 'manual'}</TableCell>
      <TableCell className="py-1">
        <div className="text-[10px] text-muted-foreground">
          {new Date(card.created_at).toLocaleDateString()}
        </div>
      </TableCell>
      <TableCell className="py-1">
        {isEditing ? (
          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-green-600 hover:text-green-600 hover:bg-green-50"
              onClick={saveEdit}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={cancelEditing}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={startEditing}
              aria-label="Edit card"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(card)}
              aria-label="Delete card"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
})
