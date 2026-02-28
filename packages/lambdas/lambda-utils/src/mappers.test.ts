import { describe, it, expect } from 'vitest'
import { mapCardToResponse } from './mappers'

describe('mapCardToResponse', () => {
  it('should map card data to API response format', () => {
    const card = {
      card_id: 'card-123',
      user_id: 'user-456',
      front: 'hallo',
      back: 'hello',
      explanation: 'greeting',
      category: 'Dutch/Basics',
      source: 'manual',
      tags: ['greeting', 'common'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const result = mapCardToResponse(card)

    expect(result).toEqual({
      id: 'card-123',
      card_id: 'card-123',
      user_id: 'user-456',
      front: 'hallo',
      back: 'hello',
      explanation: 'greeting',
      category: 'Dutch/Basics',
      source: 'manual',
      tags: ['greeting', 'common'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    })
  })

  it('should handle optional fields', () => {
    const card = {
      card_id: 'card-123',
      user_id: 'user-456',
      front: 'hallo',
      back: 'hello',
      source: 'anki',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const result = mapCardToResponse(card)

    expect(result.explanation).toBeUndefined()
    expect(result.category).toBeUndefined()
    expect(result.tags).toBeUndefined()
  })
})
