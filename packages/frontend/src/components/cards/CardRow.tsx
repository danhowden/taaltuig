import { useState, useMemo, memo } from 'react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import type { Card, InsightStatus } from '@/types'

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

  // Calculate insight status counts
  const insightCounts = useMemo(() => {
    if (!card.insights || card.insights.length === 0) {
      return null
    }

    const counts: Record<InsightStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    for (const insight of card.insights) {
      counts[insight.status]++
    }

    return counts
  }, [card.insights])

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
        {insightCounts && card.insights && card.insights.length > 0 ? (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="flex flex-wrap gap-1 cursor-pointer">
                {insightCounts.approved > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-800 hover:bg-green-200"
                  >
                    {insightCounts.approved} approved
                  </Badge>
                )}
                {insightCounts.pending > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  >
                    {insightCounts.pending} pending
                  </Badge>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" align="start">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Insights</h4>
                <div className="space-y-2">
                  {card.insights.filter(i => i.status !== 'rejected').map((insight, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 h-4 ${
                            insight.status === 'approved'
                              ? 'border-green-500 text-green-700'
                              : 'border-yellow-500 text-yellow-700'
                          }`}
                        >
                          {insight.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {insight.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground pl-1">{insight.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
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
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(card)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
})
