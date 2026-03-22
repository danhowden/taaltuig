export interface SelectionProps {
  selectedIds?: Set<string>
  onToggleSelect?: (cardId: string) => void
  onSelectAll?: (cardIds: string[]) => void
  onDeselectAll?: () => void
}

export function useSelectionState(
  cards: { card_id: string }[],
  props: SelectionProps
) {
  const { selectedIds, onToggleSelect, onSelectAll, onDeselectAll } = props
  const hasSelection = selectedIds !== undefined && onToggleSelect !== undefined
  const allSelected =
    hasSelection &&
    cards.length > 0 &&
    cards.every((c) => selectedIds!.has(c.card_id))
  const someSelected =
    hasSelection && cards.some((c) => selectedIds!.has(c.card_id))
  const isIndeterminate = someSelected && !allSelected

  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      onSelectAll?.(cards.map((c) => c.card_id))
    } else {
      onDeselectAll?.()
    }
  }

  return { hasSelection, allSelected, isIndeterminate, handleSelectAllChange }
}
