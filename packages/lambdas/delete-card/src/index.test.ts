import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockGetCard = vi.fn()
const mockDeleteCard = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getCard: mockGetCard,
      deleteCard: mockDeleteCard,
    })),
  }
})

const { handler } = await import('./index')

describe('delete-card handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockExistingCard = {
    card_id: 'c-123',
    user_id: 'google-123',
    front: 'hallo',
    back: 'hello',
    explanation: 'Common greeting',
    source: 'manual',
    tags: ['greetings'],
    created_at: '2024-01-15T12:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  }

  it('should delete a card successfully', async () => {
    mockGetCard.mockResolvedValue(mockExistingCard)
    mockDeleteCard.mockResolvedValue(undefined)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {
        card_id: 'c-123',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(204)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(result.body).toBe('')

    expect(mockGetCard).toHaveBeenCalledWith('google-123', 'c-123')
    expect(mockDeleteCard).toHaveBeenCalledWith('google-123', 'c-123')
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      pathParameters: { card_id: 'c-123' },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockGetCard).not.toHaveBeenCalled()
    expect(mockDeleteCard).not.toHaveBeenCalled()
  })

  it('should return 400 when card_id is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {},
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'card_id is required',
      code: 'MISSING_PARAMETER',
    })
    expect(mockDeleteCard).not.toHaveBeenCalled()
  })

  it('should return 404 when card not found', async () => {
    mockGetCard.mockResolvedValue(null)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {
        card_id: 'nonexistent',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Card not found',
      code: 'NOT_FOUND',
    })
    expect(mockDeleteCard).not.toHaveBeenCalled()
  })

  it('should return 404 when card belongs to different user', async () => {
    // getCard filters by user_id, so it returns null for cards owned by other users
    mockGetCard.mockResolvedValue(null)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {
        card_id: 'c-123',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    // Since getCard filters by user_id, it will return null for cards owned by other users
    expect(result.statusCode).toBe(404)
    expect(mockDeleteCard).not.toHaveBeenCalled()
  })

  it('should return 500 on database error', async () => {
    mockGetCard.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {
        card_id: 'c-123',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should return 500 if delete operation fails', async () => {
    mockGetCard.mockResolvedValue(mockExistingCard)
    mockDeleteCard.mockRejectedValue(new Error('Delete failed'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      pathParameters: {
        card_id: 'c-123',
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
