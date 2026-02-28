import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaaltuigDynamoDBClient } from './client'
import { DEFAULT_SETTINGS } from './types'

// Mock DynamoDB DocumentClient
const mockSend = vi.fn()

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: vi.fn((params) => params),
  GetCommand: vi.fn((params) => params),
  PutCommand: vi.fn((params) => params),
  UpdateCommand: vi.fn((params) => params),
  DeleteCommand: vi.fn((params) => params),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}))

describe('TaaltuigDynamoDBClient', () => {
  let client: TaaltuigDynamoDBClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new TaaltuigDynamoDBClient('test-table')
  })

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  describe('getUser', () => {
    it('should return user when found', async () => {
      const mockUser = {
        PK: 'USER#google-123',
        SK: 'PROFILE',
        google_sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
      }

      mockSend.mockResolvedValue({ Item: mockUser })

      const result = await client.getUser('google-123')

      expect(result).toEqual(mockUser)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Key: {
            PK: 'USER#google-123',
            SK: 'PROFILE',
          },
        })
      )
    })

    it('should return null when user not found', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.getUser('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('createUser', () => {
    it('should create user with all fields', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.createUser(
        'google-123',
        'test@example.com',
        'Test User',
        'https://example.com/photo.jpg'
      )

      expect(result.google_sub).toBe('google-123')
      expect(result.email).toBe('test@example.com')
      expect(result.name).toBe('Test User')
      expect(result.picture_url).toBe('https://example.com/photo.jpg')
      expect(result.created_at).toBeDefined()
      expect(result.last_login).toBeDefined()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Item: expect.objectContaining({
            PK: 'USER#google-123',
            SK: 'PROFILE',
            google_sub: 'google-123',
            email: 'test@example.com',
            name: 'Test User',
          }),
        })
      )
    })

    it('should create user without picture URL', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.createUser(
        'google-123',
        'test@example.com',
        'Test User'
      )

      expect(result.picture_url).toBeUndefined()
    })
  })

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockSend.mockResolvedValue({})

      await client.updateLastLogin('google-123')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Key: {
            PK: 'USER#google-123',
            SK: 'PROFILE',
          },
          UpdateExpression: 'SET last_login = :now',
        })
      )
    })
  })

  describe('getOrCreateUser', () => {
    it('should return existing user', async () => {
      const existingUser = {
        PK: 'USER#google-123',
        SK: 'PROFILE',
        google_sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T00:00:00Z',
      }

      mockSend.mockResolvedValueOnce({ Item: existingUser })
      mockSend.mockResolvedValueOnce({})

      const result = await client.getOrCreateUser(
        'google-123',
        'test@example.com',
        'Test User'
      )

      expect(result).toEqual(existingUser)
      expect(mockSend).toHaveBeenCalledTimes(2) // getUser + updateLastLogin
    })

    it('should create new user when not found', async () => {
      mockSend.mockResolvedValueOnce({}) // getUser returns null
      mockSend.mockResolvedValueOnce({}) // createUser
      mockSend.mockResolvedValueOnce({}) // createDefaultSettings

      const result = await client.getOrCreateUser(
        'google-123',
        'test@example.com',
        'Test User',
        'https://example.com/photo.jpg'
      )

      expect(result.google_sub).toBe('google-123')
      expect(mockSend).toHaveBeenCalledTimes(3) // getUser + createUser + createDefaultSettings
    })
  })

  // ==========================================================================
  // SETTINGS OPERATIONS
  // ==========================================================================

  describe('getSettings', () => {
    it('should return settings when found', async () => {
      const mockSettings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        user_id: 'user-123',
        ...DEFAULT_SETTINGS,
      }

      mockSend.mockResolvedValue({ Item: mockSettings })

      const result = await client.getSettings('user-123')

      expect(result).toEqual(mockSettings)
    })

    it('should return null when settings not found', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.getSettings('user-123')

      expect(result).toBeNull()
    })
  })

  describe('createDefaultSettings', () => {
    it('should create settings with defaults', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.createDefaultSettings('user-123')

      expect(result.user_id).toBe('user-123')
      expect(result.new_cards_per_day).toBe(DEFAULT_SETTINGS.new_cards_per_day)
      expect(result.learning_steps).toEqual(DEFAULT_SETTINGS.learning_steps)
      expect(result.starting_ease).toBe(DEFAULT_SETTINGS.starting_ease)
      expect(result.updated_at).toBeDefined()
    })
  })

  describe('updateSettings', () => {
    it('should update single setting field', async () => {
      const updatedSettings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        user_id: 'user-123',
        ...DEFAULT_SETTINGS,
        new_cards_per_day: 15,
      }

      mockSend.mockResolvedValueOnce({}) // UpdateCommand
      mockSend.mockResolvedValueOnce({ Item: updatedSettings }) // getSettings

      const result = await client.updateSettings('user-123', {
        new_cards_per_day: 15,
      })

      expect(result.new_cards_per_day).toBe(15)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.stringContaining('SET'),
        })
      )
    })

    it('should update multiple setting fields', async () => {
      const updatedSettings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        user_id: 'user-123',
        ...DEFAULT_SETTINGS,
        new_cards_per_day: 15,
        starting_ease: 2.8,
      }

      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({ Item: updatedSettings })

      const result = await client.updateSettings('user-123', {
        new_cards_per_day: 15,
        starting_ease: 2.8,
      })

      expect(result.new_cards_per_day).toBe(15)
      expect(result.starting_ease).toBe(2.8)
    })

    it('should throw error if settings not found after update', async () => {
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({}) // getSettings returns null

      await expect(
        client.updateSettings('user-123', { new_cards_per_day: 15 })
      ).rejects.toThrow('Failed to fetch updated settings')
    })
  })

  // ==========================================================================
  // CARD OPERATIONS
  // ==========================================================================

  describe('createCard', () => {
    it('should create card with all fields and review items', async () => {
      const mockSettings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        user_id: 'user-123',
        starting_ease: 2.5,
      }

      mockSend.mockResolvedValueOnce({}) // PutCommand for card
      mockSend.mockResolvedValueOnce({ Item: mockSettings }) // getSettings
      mockSend.mockResolvedValueOnce({}) // forward ReviewItem
      mockSend.mockResolvedValueOnce({}) // reverse ReviewItem

      const result = await client.createCard(
        'user-123',
        'hallo',
        'hello',
        'Common greeting',
        ['greetings'],
        'manual',
        'Basics'
      )

      expect(result.card.front).toBe('hallo')
      expect(result.card.back).toBe('hello')
      expect(result.card.explanation).toBe('Common greeting')
      expect(result.card.tags).toEqual(['greetings'])
      expect(result.card.source).toBe('manual')
      expect(result.card.category).toBe('Basics')
      expect(result.reviewItems).toHaveLength(2)
      expect(result.reviewItems[0].direction).toBe('forward')
      expect(result.reviewItems[1].direction).toBe('reverse')
    })

    it('should create card with minimal fields', async () => {
      const mockSettings = {
        user_id: 'user-123',
        starting_ease: 2.5,
      }

      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({ Item: mockSettings })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})

      const result = await client.createCard('user-123', 'hallo', 'hello')

      expect(result.card.front).toBe('hallo')
      expect(result.card.back).toBe('hello')
      expect(result.card.tags).toEqual([])
      expect(result.card.source).toBe('manual')
    })

    it('should throw error if settings not found', async () => {
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({}) // getSettings returns null

      await expect(
        client.createCard('user-123', 'front', 'back')
      ).rejects.toThrow('User settings not found')
    })
  })

  describe('listCards', () => {
    it('should return all cards for user', async () => {
      const mockCards = [
        { card_id: 'c1', front: 'hallo', back: 'hello' },
        { card_id: 'c2', front: 'goedemorgen', back: 'good morning' },
      ]

      mockSend.mockResolvedValue({ Items: mockCards })

      const result = await client.listCards('user-123')

      expect(result).toEqual(mockCards)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': 'USER#user-123',
            ':sk': 'CARD#',
          },
        })
      )
    })

    it('should return empty array when no cards', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.listCards('user-123')

      expect(result).toEqual([])
    })
  })

  describe('getCard', () => {
    it('should return card when found', async () => {
      const mockCard = {
        PK: 'USER#user-123',
        SK: 'CARD#c-123',
        card_id: 'c-123',
        front: 'hallo',
        back: 'hello',
      }

      mockSend.mockResolvedValue({ Item: mockCard })

      const result = await client.getCard('user-123', 'c-123')

      expect(result).toEqual(mockCard)
    })

    it('should return null when card not found', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.getCard('user-123', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateCard', () => {
    it('should update card with single field', async () => {
      const updatedCard = {
        card_id: 'c-123',
        front: 'hallo',
        back: 'hi',
      }

      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: [] }) // Query review items
      mockSend.mockResolvedValueOnce({ Item: updatedCard }) // getCard

      const result = await client.updateCard('user-123', 'c-123', {
        back: 'hi',
      })

      expect(result.back).toBe('hi')
    })

    it('should update card with multiple fields', async () => {
      const updatedCard = {
        card_id: 'c-123',
        front: 'hey',
        back: 'hi',
        explanation: 'Informal greeting',
      }

      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Item: updatedCard })

      const result = await client.updateCard('user-123', 'c-123', {
        front: 'hey',
        back: 'hi',
        explanation: 'Informal greeting',
      })

      expect(result.front).toBe('hey')
      expect(result.back).toBe('hi')
      expect(result.explanation).toBe('Informal greeting')
    })

    it('should update denormalized data in review items when front/back changes', async () => {
      const reviewItems = [
        {
          PK: 'USER#user-123',
          SK: 'REVIEWITEM#ri-1',
          direction: 'forward',
          card_id: 'c-123',
        },
        {
          PK: 'USER#user-123',
          SK: 'REVIEWITEM#ri-2',
          direction: 'reverse',
          card_id: 'c-123',
        },
      ]

      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // Query review items
      mockSend.mockResolvedValueOnce({}) // Update forward review item
      mockSend.mockResolvedValueOnce({}) // Update reverse review item
      mockSend.mockResolvedValueOnce({ Item: { card_id: 'c-123' } }) // getCard

      await client.updateCard('user-123', 'c-123', {
        front: 'new-front',
      })

      // Should update both review items
      expect(mockSend).toHaveBeenCalledTimes(5)
    })

    it('should update denormalized review items when only back is updated', async () => {
      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-1', direction: 'forward' },
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-2', direction: 'reverse' },
      ]

      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // Query review items
      mockSend.mockResolvedValueOnce({}) // Update forward review item
      mockSend.mockResolvedValueOnce({}) // Update reverse review item
      mockSend.mockResolvedValueOnce({ Item: { card_id: 'c-123' } }) // getCard

      await client.updateCard('user-123', 'c-123', {
        back: 'new-back',
      })

      // Should update both review items (back field on forward, front field on reverse)
      expect(mockSend).toHaveBeenCalledTimes(5)
    })

    it('should update denormalized review items when only explanation is updated', async () => {
      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-1', direction: 'forward' },
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-2', direction: 'reverse' },
      ]

      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // Query review items
      mockSend.mockResolvedValueOnce({}) // Update forward review item
      mockSend.mockResolvedValueOnce({}) // Update reverse review item
      mockSend.mockResolvedValueOnce({ Item: { card_id: 'c-123' } }) // getCard

      await client.updateCard('user-123', 'c-123', {
        explanation: 'new-explanation',
      })

      // Should update both review items with new explanation
      expect(mockSend).toHaveBeenCalledTimes(5)
    })

    it('should throw error when card not found after update', async () => {
      // Mock successful update but card disappears before getCard
      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: [] }) // Query review items (none to update)
      mockSend.mockResolvedValueOnce({}) // getCard returns no Item

      await expect(
        client.updateCard('user-123', 'c-123', { back: 'new-back' })
      ).rejects.toThrow('Card not found after update')
    })
  })

  describe('deleteCard', () => {
    it('should delete card and its review items', async () => {
      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-1' },
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-2' },
      ]

      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // Query review items
      mockSend.mockResolvedValueOnce({}) // Delete first review item
      mockSend.mockResolvedValueOnce({}) // Delete second review item
      mockSend.mockResolvedValueOnce({}) // Delete card

      await client.deleteCard('user-123', 'c-123')

      expect(mockSend).toHaveBeenCalledTimes(4) // Query + 2 deletes + 1 delete card
    })

    it('should delete card even when no review items exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({})

      await client.deleteCard('user-123', 'c-123')

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  // ==========================================================================
  // REVIEW ITEM OPERATIONS
  // ==========================================================================

  describe('getReviewItem', () => {
    it('should return review item when found', async () => {
      const mockReviewItem = {
        PK: 'USER#user-123',
        SK: 'REVIEWITEM#ri-123',
        review_item_id: 'ri-123',
        state: 'REVIEW',
      }

      mockSend.mockResolvedValue({ Item: mockReviewItem })

      const result = await client.getReviewItem('user-123', 'ri-123')

      expect(result).toEqual(mockReviewItem)
    })

    it('should return null when review item not found', async () => {
      mockSend.mockResolvedValue({})

      const result = await client.getReviewItem('user-123', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateReviewItem', () => {
    it('should update review item with new state and schedule', async () => {
      mockSend.mockResolvedValue({})

      await client.updateReviewItem('user-123', 'ri-123', {
        state: 'REVIEW',
        interval: 7,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: '2024-01-22T00:00:00Z',
        last_reviewed: '2024-01-15T00:00:00Z',
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Key: {
            PK: 'USER#user-123',
            SK: 'REVIEWITEM#ri-123',
          },
          UpdateExpression: expect.stringContaining('SET'),
          ExpressionAttributeValues: expect.objectContaining({
            ':state': 'REVIEW',
            ':interval': 7,
            ':ease_factor': 2.5,
          }),
        })
      )
    })
  })

  describe('createReviewHistory', () => {
    it('should create review history entry', async () => {
      mockSend.mockResolvedValue({})

      await client.createReviewHistory(
        'user-123',
        'ri-123',
        3, // grade
        1500, // duration_ms
        'LEARNING', // state_before
        'REVIEW', // state_after
        1, // interval_before
        7, // interval_after
        2.5, // ease_factor_before
        2.6 // ease_factor_after
      )

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            user_id: 'user-123',
            review_item_id: 'ri-123',
            grade: 3,
            duration_ms: 1500,
            state_before: 'LEARNING',
            state_after: 'REVIEW',
            interval_before: 1,
            interval_after: 7,
            ease_factor_before: 2.5,
            ease_factor_after: 2.6,
          }),
        })
      )
    })
  })

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  describe('resetDailyReviews', () => {
    it('should delete history entries from today', async () => {
      const mockSettings = {
        user_id: 'user-123',
        starting_ease: 2.5,
      }

      const todayHistory = [
        { PK: 'USER#user-123', SK: 'HISTORY#2024-01-15T10:00:00Z', review_item_id: 'ri-1' },
        { PK: 'USER#user-123', SK: 'HISTORY#2024-01-15T11:00:00Z', review_item_id: 'ri-1' },
      ]

      mockSend.mockResolvedValueOnce({ Items: todayHistory }) // Query history
      mockSend.mockResolvedValueOnce({ Item: mockSettings }) // getSettings
      mockSend.mockResolvedValueOnce({ Item: { review_item_id: 'ri-1' } }) // getReviewItem
      mockSend.mockResolvedValueOnce({}) // Update review item
      mockSend.mockResolvedValueOnce({}) // Delete first history
      mockSend.mockResolvedValueOnce({}) // Delete second history

      const deletedCount = await client.resetDailyReviews('user-123')

      expect(deletedCount).toBe(2)
    })

    it('should return 0 when no history entries exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }) // Query history (empty)
      mockSend.mockResolvedValueOnce({ Item: { starting_ease: 2.5 } }) // getSettings

      const deletedCount = await client.resetDailyReviews('user-123')

      expect(deletedCount).toBe(0)
    })

    it('should throw error when settings not found', async () => {
      const todayHistory = [
        { PK: 'USER#user-123', SK: 'HISTORY#2024-01-15T10:00:00Z', review_item_id: 'ri-1' },
      ]

      mockSend.mockResolvedValueOnce({ Items: todayHistory }) // Query history
      mockSend.mockResolvedValueOnce({}) // getSettings returns no Item

      await expect(client.resetDailyReviews('user-123')).rejects.toThrow(
        'User settings not found'
      )
    })
  })

  describe('renameCategory', () => {
    it('should rename category across cards, review items, and settings', async () => {
      const cards = [
        { PK: 'USER#user-123', SK: 'CARD#c1', card_id: 'c1', category: 'Food' },
        { PK: 'USER#user-123', SK: 'CARD#c2', card_id: 'c2', category: 'Food' },
      ]

      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri1', category: 'Food' },
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri2', category: 'Food' },
      ]

      const settings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        disabled_categories: ['Food', 'Travel'],
      }

      const updatedSettings = {
        ...settings,
        disabled_categories: ['Cuisine', 'Travel'],
      }

      mockSend.mockResolvedValueOnce({ Items: cards }) // listCards
      mockSend.mockResolvedValueOnce({}) // Update c1
      mockSend.mockResolvedValueOnce({}) // Update c2
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // listAllReviewItems
      mockSend.mockResolvedValueOnce({}) // Update ri1
      mockSend.mockResolvedValueOnce({}) // Update ri2
      mockSend.mockResolvedValueOnce({ Item: settings }) // getSettings
      mockSend.mockResolvedValueOnce({}) // updateSettings UpdateCommand
      mockSend.mockResolvedValueOnce({ Item: updatedSettings }) // updateSettings getSettings

      const result = await client.renameCategory('user-123', 'Food', 'Cuisine')

      expect(result.cardsUpdated).toBe(2)
      expect(result.reviewItemsUpdated).toBe(2)
      expect(result.settingsUpdated).toBe(true)
    })

    it('should handle missing category in settings', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }) // listCards
      mockSend.mockResolvedValueOnce({ Items: [] }) // listAllReviewItems
      mockSend.mockResolvedValueOnce({}) // getSettings returns null

      const result = await client.renameCategory('user-123', 'Food', 'Cuisine')

      expect(result.cardsUpdated).toBe(0)
      expect(result.reviewItemsUpdated).toBe(0)
      expect(result.settingsUpdated).toBe(false)
    })

    it('should handle settings without disabled_categories', async () => {
      const cards = [
        { PK: 'USER#user-123', SK: 'CARD#c1', card_id: 'c1', category: 'Food' },
      ]

      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri1', category: 'Food' },
      ]

      const settings = {
        PK: 'USER#user-123',
        SK: 'SETTINGS',
        // No disabled_categories field
      }

      mockSend.mockResolvedValueOnce({ Items: cards }) // listCards
      mockSend.mockResolvedValueOnce({}) // Update c1
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // listAllReviewItems
      mockSend.mockResolvedValueOnce({}) // Update ri1
      mockSend.mockResolvedValueOnce({ Item: settings }) // getSettings

      const result = await client.renameCategory('user-123', 'Food', 'Cuisine')

      expect(result.cardsUpdated).toBe(1)
      expect(result.reviewItemsUpdated).toBe(1)
      expect(result.settingsUpdated).toBe(false)
    })
  })

  // ==========================================================================
  // REVIEW QUEUE OPERATIONS
  // ==========================================================================

  describe('getReviewQueue', () => {
    it('should shuffle ALL NEW items and take up to daily limit', async () => {
      const userId = 'test-user'

      // Mock settings (limit 3 new cards per day)
      mockSend.mockResolvedValueOnce({
        Item: {
          new_cards_per_day: 3,
          learning_steps: [1, 10],
        },
      })

      // Mock review items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock learning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock relearning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock today's history count
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock NEW items - 6 total (forward/reverse pairs)
      // Since we shuffle, we should only get 3 out of the 6
      const newItems = [
        { review_item_id: '1-forward', card_id: '1', direction: 'forward', state: 'NEW' },
        { review_item_id: '1-reverse', card_id: '1', direction: 'reverse', state: 'NEW' },
        { review_item_id: '2-forward', card_id: '2', direction: 'forward', state: 'NEW' },
        { review_item_id: '2-reverse', card_id: '2', direction: 'reverse', state: 'NEW' },
        { review_item_id: '3-forward', card_id: '3', direction: 'forward', state: 'NEW' },
        { review_item_id: '3-reverse', card_id: '3', direction: 'reverse', state: 'NEW' },
      ]
      mockSend.mockResolvedValueOnce({ Items: newItems })

      const result = await client.getReviewQueue(userId)

      // Should only have 3 items (limited by new_cards_per_day)
      expect(result.queue).toHaveLength(3)
      expect(result.stats.new_count).toBe(3)

      // All items should be from the original pool
      const queueIds = result.queue.map((item) => item.review_item_id)
      const allPossibleIds = [
        '1-forward',
        '1-reverse',
        '2-forward',
        '2-reverse',
        '3-forward',
        '3-reverse',
      ]
      queueIds.forEach((id) => {
        expect(allPossibleIds).toContain(id)
      })
    })

    it('should handle empty NEW items array', async () => {
      const userId = 'test-user'

      // Mock settings
      mockSend.mockResolvedValueOnce({
        Item: {
          new_cards_per_day: 20,
          learning_steps: [1, 10],
        },
      })

      // Mock all queries returning empty
      mockSend.mockResolvedValueOnce({ Items: [] }) // REVIEW items
      mockSend.mockResolvedValueOnce({ Items: [] }) // LEARNING items
      mockSend.mockResolvedValueOnce({ Items: [] }) // RELEARNING items
      mockSend.mockResolvedValueOnce({ Items: [] }) // Today's history
      mockSend.mockResolvedValueOnce({ Items: [] }) // NEW items

      const result = await client.getReviewQueue(userId)

      expect(result.queue).toHaveLength(0)
      expect(result.stats.new_count).toBe(0)
    })

    it('should combine shuffled NEW items with due items', async () => {
      const userId = 'test-user'

      // Mock settings
      mockSend.mockResolvedValueOnce({
        Item: {
          new_cards_per_day: 20,
          learning_steps: [1, 10],
        },
      })

      // Mock review items (2 items)
      mockSend.mockResolvedValueOnce({
        Items: [
          { review_item_id: 'review-1', state: 'REVIEW' },
          { review_item_id: 'review-2', state: 'REVIEW' },
        ],
      })

      // Mock learning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock relearning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock today's history count
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock NEW items
      mockSend.mockResolvedValueOnce({
        Items: [
          { review_item_id: 'new-1', state: 'NEW' },
          { review_item_id: 'new-2', state: 'NEW' },
        ],
      })

      const result = await client.getReviewQueue(userId)

      // Should have 4 items total (2 review + 2 new)
      expect(result.queue).toHaveLength(4)
      expect(result.stats.due_count).toBe(2)
      expect(result.stats.new_count).toBe(2)

      const queueIds = result.queue.map((item) => item.review_item_id)
      expect(queueIds).toContain('review-1')
      expect(queueIds).toContain('review-2')
      expect(queueIds).toContain('new-1')
      expect(queueIds).toContain('new-2')
    })

    it('should return early when no new cards remaining today', async () => {
      const userId = 'test-user'

      // Mock settings
      mockSend.mockResolvedValueOnce({
        Item: {
          new_cards_per_day: 5,
          learning_steps: [1, 10],
        },
      })

      // Mock review items
      mockSend.mockResolvedValueOnce({
        Items: [{ review_item_id: 'review-1', state: 'REVIEW' }],
      })

      // Mock learning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })
      // Mock relearning items (empty)
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock today's history count - already did 5 new cards today
      mockSend.mockResolvedValueOnce({
        Items: [
          { review_item_id: 'h1' },
          { review_item_id: 'h2' },
          { review_item_id: 'h3' },
          { review_item_id: 'h4' },
          { review_item_id: 'h5' },
        ],
      })

      // Should NOT query for NEW items since remainingNew = 0

      const result = await client.getReviewQueue(userId)

      // Should only have review items, no new items
      expect(result.queue).toHaveLength(1)
      expect(result.stats.new_count).toBe(0)
      expect(result.stats.new_remaining_today).toBe(0)
    })

    it('should throw error when settings not found', async () => {
      mockSend.mockResolvedValueOnce({}) // getSettings returns no Item

      await expect(client.getReviewQueue('user-123')).rejects.toThrow(
        'User settings not found'
      )
    })

    it('should filter out disabled categories from NEW cards', async () => {
      const userId = 'test-user'

      // Mock settings with disabled categories
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: userId,
          new_cards_per_day: 10,
          disabled_categories: ['grammar', 'verbs'],
          learning_steps: [1, 10],
          graduating_interval: 1,
          easy_interval: 4,
          starting_ease: 2.5,
          easy_bonus: 1.3,
          interval_modifier: 1.0,
          maximum_interval: 36500,
          relearning_steps: [10],
        },
      })

      // Mock empty queues for REVIEW, LEARNING, RELEARNING
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock history (0 new cards today)
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock NEW items with different categories
      const newItems = [
        { review_item_id: '1', state: 'NEW', category: 'grammar' }, // Should be filtered
        { review_item_id: '2', state: 'NEW', category: 'vocabulary' }, // Should be included
        { review_item_id: '3', state: 'NEW', category: 'verbs' }, // Should be filtered
        { review_item_id: '4', state: 'NEW', category: null }, // Should be included (no category)
        { review_item_id: '5', state: 'NEW' }, // Should be included (undefined category)
      ]
      mockSend.mockResolvedValueOnce({ Items: newItems })

      const result = await client.getReviewQueue(userId)

      // Should only include items NOT in disabled_categories
      expect(result.queue.length).toBeLessThanOrEqual(3) // Max 3 items (vocabulary, null, undefined)
      expect(result.queue.every(item =>
        !item.category || !['grammar', 'verbs'].includes(item.category)
      )).toBe(true)
    })

    it('should not filter when disabled_categories is empty', async () => {
      const userId = 'test-user'

      // Mock settings with empty disabled_categories
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: userId,
          new_cards_per_day: 10,
          disabled_categories: [],
          learning_steps: [1, 10],
          graduating_interval: 1,
          easy_interval: 4,
          starting_ease: 2.5,
          easy_bonus: 1.3,
          interval_modifier: 1.0,
          maximum_interval: 36500,
          relearning_steps: [10],
        },
      })

      // Mock empty queues
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Items: [] })

      // Mock NEW items
      const newItems = [
        { review_item_id: '1', state: 'NEW', category: 'grammar' },
        { review_item_id: '2', state: 'NEW', category: 'verbs' },
      ]
      mockSend.mockResolvedValueOnce({ Items: newItems })

      const result = await client.getReviewQueue(userId)

      // Should include all items (no filtering)
      expect(result.queue).toHaveLength(2)
    })
  })

  // ==========================================================================
  // INSIGHT OPERATIONS
  // ==========================================================================

  describe('updateCardInsights', () => {
    it('should update card with insights', async () => {
      const insights = [
        {
          type: 'compound' as const,
          content: 'aardappel = aard (earth) + appel (apple)',
          status: 'pending' as const,
          generated_at: '2024-01-15T10:00:00Z',
        },
      ]

      const updatedCard = {
        card_id: 'c-123',
        front: 'aardappel',
        back: 'potato',
        insights,
        insights_generated_at: '2024-01-15T10:00:00Z',
      }

      mockSend.mockResolvedValueOnce({}) // UpdateCommand
      mockSend.mockResolvedValueOnce({ Item: updatedCard }) // getCard

      const result = await client.updateCardInsights('user-123', 'c-123', insights)

      expect(result.insights).toEqual(insights)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.stringContaining('insights'),
        })
      )
    })

    it('should throw error if card not found after update', async () => {
      mockSend.mockResolvedValueOnce({}) // UpdateCommand
      mockSend.mockResolvedValueOnce({}) // getCard returns null

      await expect(
        client.updateCardInsights('user-123', 'c-123', [])
      ).rejects.toThrow('Card not found after update')
    })
  })

  describe('getCardsByIds', () => {
    it('should return cards for given IDs', async () => {
      const card1 = { card_id: 'c-1', front: 'hallo' }
      const card2 = { card_id: 'c-2', front: 'goedemorgen' }

      mockSend.mockResolvedValueOnce({ Item: card1 })
      mockSend.mockResolvedValueOnce({ Item: card2 })

      const result = await client.getCardsByIds('user-123', ['c-1', 'c-2'])

      expect(result).toHaveLength(2)
      expect(result[0].card_id).toBe('c-1')
      expect(result[1].card_id).toBe('c-2')
    })

    it('should skip cards that are not found', async () => {
      const card1 = { card_id: 'c-1', front: 'hallo' }

      mockSend.mockResolvedValueOnce({ Item: card1 })
      mockSend.mockResolvedValueOnce({}) // c-2 not found

      const result = await client.getCardsByIds('user-123', ['c-1', 'c-2'])

      expect(result).toHaveLength(1)
      expect(result[0].card_id).toBe('c-1')
    })
  })

  describe('getCardsWithInsightsForReview', () => {
    it('should filter cards with pending insights', async () => {
      const cards = [
        {
          card_id: 'c-1',
          insights: [
            { type: 'compound', status: 'pending', reviewed_by: undefined },
          ],
        },
        {
          card_id: 'c-2',
          insights: [
            { type: 'root', status: 'approved', reviewed_by: 'human' },
          ],
        },
        { card_id: 'c-3' }, // No insights
      ]

      mockSend.mockResolvedValueOnce({ Items: cards })

      const result = await client.getCardsWithInsightsForReview('user-123', 'pending')

      expect(result).toHaveLength(1)
      expect(result[0].card_id).toBe('c-1')
    })

    it('should filter cards with AI-approved insights', async () => {
      const cards = [
        {
          card_id: 'c-1',
          insights: [
            { type: 'compound', status: 'approved', reviewed_by: 'ai' },
          ],
        },
        {
          card_id: 'c-2',
          insights: [
            { type: 'root', status: 'approved', reviewed_by: 'human' },
          ],
        },
      ]

      mockSend.mockResolvedValueOnce({ Items: cards })

      const result = await client.getCardsWithInsightsForReview('user-123', 'ai_approved')

      expect(result).toHaveLength(1)
      expect(result[0].card_id).toBe('c-1')
    })

    it('should return all cards with insights when filter is all', async () => {
      const cards = [
        {
          card_id: 'c-1',
          insights: [{ type: 'compound', status: 'pending' }],
        },
        {
          card_id: 'c-2',
          insights: [{ type: 'root', status: 'approved' }],
        },
        { card_id: 'c-3' }, // No insights
      ]

      mockSend.mockResolvedValueOnce({ Items: cards })

      const result = await client.getCardsWithInsightsForReview('user-123', 'all')

      expect(result).toHaveLength(2)
    })

    it('should return cards needing review by default (pending or AI-approved)', async () => {
      const cards = [
        {
          card_id: 'c-1',
          insights: [{ type: 'compound', status: 'pending' }],
        },
        {
          card_id: 'c-2',
          insights: [{ type: 'root', status: 'approved', reviewed_by: 'ai' }],
        },
        {
          card_id: 'c-3',
          insights: [{ type: 'verb_forms', status: 'approved', reviewed_by: 'human' }],
        },
      ]

      mockSend.mockResolvedValueOnce({ Items: cards })

      const result = await client.getCardsWithInsightsForReview('user-123')

      expect(result).toHaveLength(2)
      expect(result.map(c => c.card_id)).toContain('c-1')
      expect(result.map(c => c.card_id)).toContain('c-2')
    })
  })

  describe('updateInsightStatus', () => {
    it('should update insight status for human review', async () => {
      const card = {
        card_id: 'c-123',
        insights: [
          { type: 'compound', content: 'test', status: 'pending', generated_at: '2024-01-15T10:00:00Z' },
        ],
      }

      const updatedCard = {
        ...card,
        insights: [
          {
            ...card.insights[0],
            status: 'approved',
            reviewed_by: 'human',
            reviewed_at: expect.any(String),
          },
        ],
      }

      mockSend.mockResolvedValueOnce({ Item: card }) // getCard
      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: [] }) // Query review items for sync
      mockSend.mockResolvedValueOnce({ Item: updatedCard }) // getCard after update

      const result = await client.updateInsightStatus('user-123', 'c-123', 0, {
        status: 'approved',
        reviewed_by: 'human',
      })

      expect(result.insights?.[0].status).toBe('approved')
      expect(result.insights?.[0].reviewed_by).toBe('human')
    })

    it('should allow editing content during review', async () => {
      const card = {
        card_id: 'c-123',
        insights: [
          { type: 'compound', content: 'original', status: 'pending', generated_at: '2024-01-15T10:00:00Z' },
        ],
      }

      const updatedCard = {
        ...card,
        insights: [
          {
            ...card.insights[0],
            content: 'edited content',
            status: 'approved',
            reviewed_by: 'human',
          },
        ],
      }

      mockSend.mockResolvedValueOnce({ Item: card })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({ Item: updatedCard })

      const result = await client.updateInsightStatus('user-123', 'c-123', 0, {
        status: 'approved',
        reviewed_by: 'human',
        content: 'edited content',
      })

      expect(result.insights?.[0].content).toBe('edited content')
    })

    it('should throw error if card not found', async () => {
      mockSend.mockResolvedValueOnce({}) // getCard returns null

      await expect(
        client.updateInsightStatus('user-123', 'c-123', 0, {
          status: 'approved',
          reviewed_by: 'human',
        })
      ).rejects.toThrow('Card not found')
    })

    it('should throw error if insight index out of bounds', async () => {
      const card = { card_id: 'c-123', insights: [] }
      mockSend.mockResolvedValueOnce({ Item: card })

      await expect(
        client.updateInsightStatus('user-123', 'c-123', 5, {
          status: 'approved',
          reviewed_by: 'human',
        })
      ).rejects.toThrow('Insight not found')
    })

    it('should sync approved insights to review items', async () => {
      const card = {
        card_id: 'c-123',
        insights: [
          { type: 'compound', content: 'test', status: 'pending', generated_at: '2024-01-15T10:00:00Z' },
        ],
      }

      const reviewItems = [
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-1', direction: 'forward' },
        { PK: 'USER#user-123', SK: 'REVIEWITEM#ri-2', direction: 'reverse' },
      ]

      mockSend.mockResolvedValueOnce({ Item: card }) // getCard
      mockSend.mockResolvedValueOnce({}) // UpdateCommand for card
      mockSend.mockResolvedValueOnce({ Items: reviewItems }) // Query review items
      mockSend.mockResolvedValueOnce({}) // Update ri-1
      mockSend.mockResolvedValueOnce({}) // Update ri-2
      mockSend.mockResolvedValueOnce({ Item: { ...card, insights: [{ ...card.insights[0], status: 'approved' }] } })

      await client.updateInsightStatus('user-123', 'c-123', 0, {
        status: 'approved',
        reviewed_by: 'human',
      })

      // Should have called update on both review items
      expect(mockSend).toHaveBeenCalledTimes(6)
    })
  })

  describe('bulkUpdateInsightsStatus', () => {
    it('should update multiple insights at once', async () => {
      const card = {
        card_id: 'c-123',
        insights: [
          { type: 'compound', content: 'test1', status: 'pending', generated_at: '2024-01-15T10:00:00Z' },
          { type: 'root', content: 'test2', status: 'pending', generated_at: '2024-01-15T10:00:00Z' },
        ],
      }

      const updatedCard = {
        ...card,
        insights: [
          { ...card.insights[0], status: 'approved', reviewed_by: 'ai' },
          { ...card.insights[1], status: 'rejected', reviewed_by: 'ai', rejection_reason: 'Inaccurate' },
        ],
      }

      mockSend.mockResolvedValueOnce({ Item: card }) // getCard
      mockSend.mockResolvedValueOnce({}) // UpdateCommand
      mockSend.mockResolvedValueOnce({ Items: [] }) // Query review items for sync
      mockSend.mockResolvedValueOnce({ Item: updatedCard }) // getCard after update

      const result = await client.bulkUpdateInsightsStatus('user-123', 'c-123', [
        { index: 0, status: 'approved' },
        { index: 1, status: 'rejected', rejection_reason: 'Inaccurate' },
      ])

      expect(result.insights?.[0].status).toBe('approved')
      expect(result.insights?.[1].status).toBe('rejected')
      expect(result.insights?.[1].rejection_reason).toBe('Inaccurate')
    })

    it('should throw error if card not found', async () => {
      mockSend.mockResolvedValueOnce({}) // getCard returns null

      await expect(
        client.bulkUpdateInsightsStatus('user-123', 'c-123', [{ index: 0, status: 'approved' }])
      ).rejects.toThrow('Card not found')
    })

    it('should throw error if card has no insights', async () => {
      mockSend.mockResolvedValueOnce({ Item: { card_id: 'c-123' } }) // Card without insights

      await expect(
        client.bulkUpdateInsightsStatus('user-123', 'c-123', [{ index: 0, status: 'approved' }])
      ).rejects.toThrow('Card has no insights')
    })
  })

  describe('getReviewItemsByCardId', () => {
    it('should return review items for a card', async () => {
      const reviewItems = [
        { review_item_id: 'ri-1', card_id: 'c-123', direction: 'forward' },
        { review_item_id: 'ri-2', card_id: 'c-123', direction: 'reverse' },
      ]

      mockSend.mockResolvedValueOnce({ Items: reviewItems })

      const result = await client.getReviewItemsByCardId('user-123', 'c-123')

      expect(result).toHaveLength(2)
      expect(result[0].direction).toBe('forward')
      expect(result[1].direction).toBe('reverse')
    })

    it('should return empty array when no review items found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await client.getReviewItemsByCardId('user-123', 'c-123')

      expect(result).toEqual([])
    })
  })
})
