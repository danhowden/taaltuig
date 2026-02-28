import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface InsightEditFormProps {
  content: string
  isPending: boolean
  onContentChange: (content: string) => void
  onSave: () => void
  onCancel: () => void
}

export function InsightEditForm({
  content,
  isPending,
  onContentChange,
  onSave,
  onCancel,
}: InsightEditFormProps) {
  return (
    <div className="flex gap-2">
      <Input
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="flex-1 text-sm h-8"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          else if (e.key === 'Escape') onCancel()
        }}
      />
      <Button size="sm" className="h-8" onClick={onSave} disabled={isPending}>
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
