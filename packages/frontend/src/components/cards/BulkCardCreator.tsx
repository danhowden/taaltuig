import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'
import type { NewCardForm } from '@/types/cards'

interface BulkCardCreatorProps {
  isCreating: boolean
  onCreateCards: (cards: NewCardForm[]) => Promise<void>
  onCancel: () => void
}

export function BulkCardCreator({
  isCreating,
  onCreateCards,
  onCancel,
}: BulkCardCreatorProps) {
  const [newCards, setNewCards] = useState<NewCardForm[]>([
    { front: '', back: '', explanation: '', tags: [] },
  ])

  const addNewCardRow = () => {
    setNewCards((prev) => [
      ...prev,
      { front: '', back: '', explanation: '', tags: [] },
    ])
  }

  const removeNewCardRow = (index: number) => {
    setNewCards((prev) => prev.filter((_, i) => i !== index))
  }

  const updateNewCard = (
    index: number,
    field: keyof NewCardForm,
    value: string | string[]
  ) => {
    setNewCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, [field]: value } : card))
    )
  }

  const handleSave = async () => {
    await onCreateCards(newCards)
    // Reset form
    setNewCards([{ front: '', back: '', explanation: '', tags: [] }])
  }

  const handleCancel = () => {
    setNewCards([{ front: '', back: '', explanation: '', tags: [] }])
    onCancel()
  }

  if (!isCreating) {
    return null
  }

  return (
    <div className="border-b bg-muted/50 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add New Cards</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={addNewCardRow}>
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save All
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {newCards.map((card, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr,1fr,1fr,100px,40px] gap-3 items-start bg-background p-3 rounded-md"
          >
            <Input
              placeholder="Dutch text (front)"
              value={card.front}
              onChange={(e) => updateNewCard(index, 'front', e.target.value)}
            />
            <Input
              placeholder="English text (back)"
              value={card.back}
              onChange={(e) => updateNewCard(index, 'back', e.target.value)}
            />
            <Input
              placeholder="Explanation (optional)"
              value={card.explanation}
              onChange={(e) =>
                updateNewCard(index, 'explanation', e.target.value)
              }
            />
            <Input
              placeholder="tag1,tag2"
              onChange={(e) =>
                updateNewCard(
                  index,
                  'tags',
                  e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeNewCardRow(index)}
              disabled={newCards.length === 1}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
