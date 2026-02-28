import { describe, it, expect } from 'vitest'
import { categorizeCards, filterCardsBySearch, parseTSVCards } from './cardFilters'
import type { Card } from '@/types'

describe('categorizeCards', () => {
  it('should group cards by category', () => {
    const cards: Card[] = [
      {
        id: '1',
        card_id: '1',
        user_id: 'user1',
        front: 'hallo',
        back: 'hello',
        category: 'Greetings',
        created_at: '2024-01-01',
      },
      {
        id: '2',
        card_id: '2',
        user_id: 'user1',
        front: 'goedemorgen',
        back: 'good morning',
        category: 'Greetings',
        created_at: '2024-01-01',
      },
      {
        id: '3',
        card_id: '3',
        user_id: 'user1',
        front: 'kat',
        back: 'cat',
        category: 'Animals',
        created_at: '2024-01-01',
      },
    ]

    const result = categorizeCards(cards)

    expect(result).toHaveLength(2)
    expect(result[0][0]).toBe('Animals')
    expect(result[0][1]).toHaveLength(1)
    expect(result[1][0]).toBe('Greetings')
    expect(result[1][1]).toHaveLength(2)
  })

  it('should use "Uncategorized" for cards without category', () => {
    const cards: Card[] = [
      {
        id: '1',
        card_id: '1',
        user_id: 'user1',
        front: 'hallo',
        back: 'hello',
        created_at: '2024-01-01',
      },
    ]

    const result = categorizeCards(cards)

    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('Uncategorized')
  })

  it('should sort categories alphabetically', () => {
    const cards: Card[] = [
      {
        id: '1',
        card_id: '1',
        user_id: 'user1',
        front: 'kat',
        back: 'cat',
        category: 'Zebras',
        created_at: '2024-01-01',
      },
      {
        id: '2',
        card_id: '2',
        user_id: 'user1',
        front: 'hallo',
        back: 'hello',
        category: 'Apples',
        created_at: '2024-01-01',
      },
    ]

    const result = categorizeCards(cards)

    expect(result[0][0]).toBe('Apples')
    expect(result[1][0]).toBe('Zebras')
  })

  it('should handle empty array', () => {
    const result = categorizeCards([])
    expect(result).toHaveLength(0)
  })
})

describe('filterCardsBySearch', () => {
  const cards: Card[] = [
    {
      id: '1',
      card_id: '1',
      user_id: 'user1',
      front: 'hallo',
      back: 'hello',
      explanation: 'A greeting',
      category: 'Greetings',
      tags: ['basic', 'common'],
      created_at: '2024-01-01',
    },
    {
      id: '2',
      card_id: '2',
      user_id: 'user1',
      front: 'kat',
      back: 'cat',
      explanation: 'A pet animal',
      category: 'Animals',
      tags: ['animals', 'pets'],
      created_at: '2024-01-01',
    },
    {
      id: '3',
      card_id: '3',
      user_id: 'user1',
      front: 'hond',
      back: 'dog',
      category: 'Animals',
      created_at: '2024-01-01',
    },
  ]

  it('should return all cards for empty query', () => {
    const result = filterCardsBySearch(cards, '')
    expect(result).toHaveLength(3)
  })

  it('should return all cards for whitespace-only query', () => {
    const result = filterCardsBySearch(cards, '   ')
    expect(result).toHaveLength(3)
  })

  it('should filter by front text', () => {
    const result = filterCardsBySearch(cards, 'kat')
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('kat')
  })

  it('should filter by back text', () => {
    const result = filterCardsBySearch(cards, 'hello')
    expect(result).toHaveLength(1)
    expect(result[0].back).toBe('hello')
  })

  it('should filter by explanation', () => {
    const result = filterCardsBySearch(cards, 'greeting')
    expect(result).toHaveLength(1)
    expect(result[0].explanation).toBe('A greeting')
  })

  it('should filter by category', () => {
    const result = filterCardsBySearch(cards, 'animals')
    expect(result).toHaveLength(2)
  })

  it('should filter by tags', () => {
    const result = filterCardsBySearch(cards, 'pets')
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('kat')
  })

  it('should be case-insensitive', () => {
    const result = filterCardsBySearch(cards, 'HALLO')
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('hallo')
  })

  it('should return empty array when no matches', () => {
    const result = filterCardsBySearch(cards, 'xyz123')
    expect(result).toHaveLength(0)
  })
})

describe('parseTSVCards', () => {
  it('should parse basic TSV format', () => {
    const tsv = 'hallo\thello\t\t'
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      front: 'hallo',
      back: 'hello',
      explanation: '',
      tags: [],
    })
  })

  it('should parse TSV with explanation', () => {
    const tsv = 'hallo\thello\tA greeting\t'
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(1)
    expect(result[0].explanation).toBe('A greeting')
  })

  it('should parse TSV with tags', () => {
    const tsv = 'hallo\thello\t\tbasic,common'
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(1)
    expect(result[0].tags).toEqual(['basic', 'common'])
  })

  it('should parse multiple lines', () => {
    const tsv = 'hallo\thello\t\t\nkat\tcat\t\t'
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(2)
    expect(result[0].front).toBe('hallo')
    expect(result[1].front).toBe('kat')
  })

  it('should filter out cards without front or back', () => {
    const tsv = 'hallo\thello\t\t\n\tcat\t\t\nhond\t\t\t'
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('hallo')
  })

  it('should trim whitespace from fields', () => {
    const tsv = '  hallo  \t  hello  \t  greeting  \t  basic , common  '
    const result = parseTSVCards(tsv)

    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('hallo')
    expect(result[0].back).toBe('hello')
    expect(result[0].explanation).toBe('greeting')
    expect(result[0].tags).toEqual(['basic', 'common'])
  })

  it('should handle empty input', () => {
    const result = parseTSVCards('')
    expect(result).toHaveLength(0)
  })

  it('should handle complex tags', () => {
    const tsv = 'hallo\thello\t\ttag1, tag2 , tag3'
    const result = parseTSVCards(tsv)

    expect(result[0].tags).toEqual(['tag1', 'tag2', 'tag3'])
  })
})
