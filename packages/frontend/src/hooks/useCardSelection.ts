import { useState, useCallback, useMemo } from 'react'

/**
 * Hook for managing card selection state
 *
 * Provides checkbox-style selection with support for:
 * - Toggle individual cards
 * - Select/deselect all visible cards
 * - Clear selection
 * - Track selected count
 */
export function useCardSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleCard = useCallback((cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((cardIds: string[]) => {
    setSelectedIds(new Set(cardIds))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (cardId: string) => selectedIds.has(cardId),
    [selectedIds]
  )

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])

  const selectedCardIds = useMemo(() => Array.from(selectedIds), [selectedIds])

  return {
    selectedIds,
    selectedCardIds,
    selectedCount,
    isSelected,
    toggleCard,
    selectAll,
    deselectAll,
    clearSelection,
  }
}
