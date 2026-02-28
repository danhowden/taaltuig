import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface CategoryRenameDialogProps {
  isOpen: boolean
  categoryName: string
  onRename: (newName: string) => Promise<void>
  onClose: () => void
}

export function CategoryRenameDialog({
  isOpen,
  categoryName,
  onRename,
  onClose,
}: CategoryRenameDialogProps) {
  const [newName, setNewName] = useState(categoryName)
  const [isRenaming, setIsRenaming] = useState(false)

  const handleRename = async () => {
    setIsRenaming(true)
    try {
      await onRename(newName.trim())
    } finally {
      setIsRenaming(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isRenaming) {
      onClose()
      setNewName(categoryName)
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isRenaming) {
      handleRename()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Category</DialogTitle>
          <DialogDescription>
            Enter a new name for this category. All cards and review items will be
            updated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current name:</label>
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {categoryName}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New name:</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new category name"
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={isRenaming}>
            {isRenaming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Renaming...
              </>
            ) : (
              'Rename Category'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
