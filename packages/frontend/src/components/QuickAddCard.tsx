import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCreateCard } from '@/hooks/useCards'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

export function QuickAddCard() {
  const [isOpen, setIsOpen] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const createCard = useCreateCard()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const frontRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Small delay to let the animation start
      const t = setTimeout(() => frontRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleSubmit = useCallback(async () => {
    const trimmedFront = front.trim()
    const trimmedBack = back.trim()
    if (!trimmedFront || !trimmedBack) return

    try {
      await createCard.mutateAsync({
        front: trimmedFront,
        back: trimmedBack,
        category: 'User Submitted',
        source: 'manual',
      })
      setFront('')
      setBack('')
      frontRef.current?.focus()
      queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] })
      toast({ title: 'Card added', description: `${trimmedFront} → ${trimmedBack}` })
    } catch {
      toast({ title: 'Failed to add card', variant: 'destructive' })
    }
  }, [front, back, createCard, toast, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && front.trim() && back.trim()) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [front, back, handleSubmit]
  )

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-20 md:bottom-8 md:right-8">
        <Button
          size="icon"
          onClick={() => setIsOpen(true)}
          className="h-12 w-12 rounded-full shadow-lg"
          aria-label="Quick add card"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="fixed bottom-4 right-4 z-40 md:bottom-8 md:right-8 w-[calc(100vw-2rem)] max-w-sm">
        <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-black/70">Quick Add Card</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-black/30 hover:text-black/60 text-sm"
            >
              esc
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/60 px-3 py-2">
            <span className="text-base leading-none">🇳🇱</span>
            <input
              ref={frontRef}
              type="text"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Dutch word or phrase"
              autoComplete="off"
              className="flex-1 bg-transparent text-sm placeholder:text-black/30 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/60 px-3 py-2">
            <span className="text-base leading-none">🇬🇧</span>
            <input
              type="text"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="English translation"
              autoComplete="off"
              className="flex-1 bg-transparent text-sm placeholder:text-black/30 focus:outline-none"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!front.trim() || !back.trim() || createCard.isPending}
            className="w-full rounded-lg"
            size="sm"
          >
            {createCard.isPending ? 'Adding...' : 'Add Card'}
          </Button>
        </div>
      </div>
    </>
  )
}
