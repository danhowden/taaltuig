import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockListCards = vi.fn()
const mockListCardsPaginated = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      listCards: mockListCards,
      listCardsPaginated: mockListCardsPaginated,
    })),
  }
})

const { handler } = await import('./index')

describe('list-cards handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  describe('legacy mode (no pagination params)', () => {
    it('should return list of cards', async () => {
      const mockCards = [
        {
          card_id: 'c-1',
          user_id: 'google-123',
          front: 'hallo',
          back: 'hello',
          explanation: 'Common greeting',
          source: 'manual',
          tags: ['greetings'],
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z',
        },
        {
          card_id: 'c-2',
          user_id: 'google-123',
          front: 'dag',
          back: 'goodbye',
          explanation: null,
          source: 'manual',
          tags: [],
          created_at: '2024-01-14T10:00:00Z',
          updated_at: '2024-01-14T10:00:00Z',
        },
      ]

      mockListCards.mockResolvedValue(mockCards)

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

      const body = JSON.parse(result.body)
      expect(body.cards).toHaveLength(2)
      expect(body.cards[0]).toEqual({
        id: 'c-1',
        card_id: 'c-1',
        user_id: 'google-123',
        front: 'hallo',
        back: 'hello',
        explanation: 'Common greeting',
        source: 'manual',
        tags: ['greetings'],
        created_at: '2024-01-15T12:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
      })
      expect(body.cards[1].card_id).toBe('c-2')
      // Legacy mode should not include pagination
      expect(body.pagination).toBeUndefined()

      expect(mockListCards).toHaveBeenCalledWith('google-123')
    })

    it('should return empty array when user has no cards', async () => {
      mockListCards.mockResolvedValue([])

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.cards).toEqual([])
    })
  })

  describe('paginated mode', () => {
    it('should use paginated query when limit param is provided', async () => {
      const mockCards = [
        {
          card_id: 'c-1',
          user_id: 'google-123',
          front: 'hallo',
          back: 'hello',
          source: 'manual',
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z',
        },
      ]

      mockListCardsPaginated.mockResolvedValue({
        cards: mockCards,
        cursor: 'next-page-cursor',
        hasMore: true,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          limit: '10',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.cards).toHaveLength(1)
      expect(body.pagination).toEqual({
        cursor: 'next-page-cursor',
        hasMore: true,
        pageSize: 10,
      })

      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 10,
        cursor: undefined,
        category: undefined,
        insightStatus: undefined,
        search: undefined,
      })
    })

    it('should use paginated query when cursor param is provided', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          cursor: 'some-cursor',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.pagination).toEqual({
        cursor: null,
        hasMore: false,
        pageSize: 50, // default
      })

      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 50,
        cursor: 'some-cursor',
        category: undefined,
        insightStatus: undefined,
        search: undefined,
      })
    })

    it('should apply category filter', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          category: 'Verbs',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 50,
        cursor: undefined,
        category: 'Verbs',
        insightStatus: undefined,
        search: undefined,
      })
    })

    it('should apply insight_status filter', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          insight_status: 'pending',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 50,
        cursor: undefined,
        category: undefined,
        insightStatus: 'pending',
        search: undefined,
      })
    })

    it('should ignore invalid insight_status values', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          insight_status: 'invalid_value',
          limit: '10',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 10,
        cursor: undefined,
        category: undefined,
        insightStatus: undefined,
        search: undefined,
      })
    })

    it('should apply search filter', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          search: 'hallo',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 50,
        cursor: undefined,
        category: undefined,
        insightStatus: undefined,
        search: 'hallo',
      })
    })

    it('should cap limit at 200', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          limit: '500',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 200,
        cursor: undefined,
        category: undefined,
        insightStatus: undefined,
        search: undefined,
      })
    })

    it('should handle invalid limit gracefully', async () => {
      mockListCardsPaginated.mockResolvedValue({
        cards: [],
        cursor: null,
        hasMore: false,
      })

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          limit: 'invalid',
          search: 'test', // Need another param to trigger paginated mode
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      expect(mockListCardsPaginated).toHaveBeenCalledWith('google-123', {
        limit: 50, // Falls back to default
        cursor: undefined,
        category: undefined,
        insightStatus: undefined,
        search: 'test',
      })
    })
  })

  describe('authorization', () => {
    it('should return 401 when unauthorized', async () => {
      const event = {
        requestContext: {
          authorizer: {},
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(401)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      })
      expect(mockListCards).not.toHaveBeenCalled()
    })

    it('should return 401 when JWT claims are missing', async () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {},
          },
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(401)
      expect(mockListCards).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      mockListCards.mockRejectedValue(new Error('Database error'))

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      })
    })

    it('should return 500 on paginated query error', async () => {
      mockListCardsPaginated.mockRejectedValue(new Error('Database error'))

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        queryStringParameters: {
          limit: '10',
        },
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      })
    })
  })
})
