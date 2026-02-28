import type { Card } from '@/types'
import type { NewCardForm } from '@/types/cards'

/**
 * Groups cards by category, sorting categories alphabetically
 */
export function categorizeCards(cards: Card[]): [string, Card[]][] {
  const grouped = new Map<string, Card[]>()

  cards.forEach((card) => {
    const category = card.category || 'Uncategorized'
    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(card)
  })

  // Sort categories alphabetically
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Filters cards by search query (searches front, back, explanation, category, tags)
 */
export function filterCardsBySearch(cards: Card[], query: string): Card[] {
  const trimmedQuery = query.trim()

  if (trimmedQuery === '') {
    return cards
  }

  const lowerQuery = trimmedQuery.toLowerCase()

  return cards.filter(
    (card) =>
      card.front.toLowerCase().includes(lowerQuery) ||
      card.back.toLowerCase().includes(lowerQuery) ||
      card.explanation?.toLowerCase().includes(lowerQuery) ||
      card.category?.toLowerCase().includes(lowerQuery) ||
      card.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Parses TSV (tab-separated values) into card forms
 * Format: front\tback\texplanation\ttag1,tag2
 */
export function parseTSVCards(tsv: string): NewCardForm[] {
  const lines = tsv.trim().split('\n')

  return lines
    .map((line) => {
      const parts = line.split('\t')
      const [front = '', back = '', explanation = '', tagsStr = ''] = parts

      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      return {
        front: front.trim(),
        back: back.trim(),
        explanation: explanation.trim(),
        tags,
      }
    })
    .filter((card) => card.front && card.back) // Only include cards with both front and back
}
