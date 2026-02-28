import { Button } from '@/components/ui/button'
import { Check, X, Pencil } from 'lucide-react'

interface InsightActionsProps {
  isPending: boolean
  onApprove: () => void
  onReject: () => void
  onStartEdit: () => void
}

export function InsightActions({
  isPending,
  onApprove,
  onReject,
  onStartEdit,
}: InsightActionsProps) {
  return (
    <div className="flex gap-0.5">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
        onClick={onApprove}
        disabled={isPending}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
        onClick={onReject}
        disabled={isPending}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={onStartEdit}
        disabled={isPending}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
