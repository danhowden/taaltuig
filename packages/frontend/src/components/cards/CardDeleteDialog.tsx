import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Card } from '@/types'

interface CardDeleteDialogProps {
  isOpen: boolean
  card: Card | null
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export function CardDeleteDialog({
  isOpen,
  card,
  onConfirm,
  onCancel,
}: CardDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Card</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this card? This will also delete the
            associated review items (bidirectional). This action cannot be undone.
          </AlertDialogDescription>
          {card && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <div className="font-medium">Card to delete:</div>
              <div className="mt-2 text-sm">
                <div>
                  <strong>Front:</strong> {card.front}
                </div>
                <div>
                  <strong>Back:</strong> {card.back}
                </div>
              </div>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
