import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockGetCard = vi.fn()
const mockUpdateCard = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getCard: mockGetCard,
      updateCard: mockUpdateCard,
    })),
  }
})

// Mock lambda-utils with all exports including sanitize functions
vi.mock('@taaltuig/lambda-utils', async () => {
  const actual = await vi.importActual<typeof import('@taaltuig/lambda-utils')>('@taaltuig/lambda-utils')
  return {
    ...actual,
    // Pass-through sanitize functions (identity for simple strings in tests)
    sanitizeText: (input: string | undefined | null) => input?.trim() || undefined,
    sanitizeTags: (tags: string[] | undefined | null) => tags?.map(t => t.trim()).filter(t => t) || undefined,
  }
})

const { handler } = await import('./index')

describe('update-card handler', () => {
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

  it('should update a card successfully', async () => {
    mockGetCard.mockResolvedValue(mockExistingCard)
    mockUpdateCard.mockResolvedValue({
      ...mockExistingCard,
      front: 'goedemorgen',
      back: 'good morning',
      updated_at: '2024-01-16T10:00:00Z',
    })

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
      body: JSON.stringify({
        front: 'goedemorgen',
        back: 'good morning',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body.card.front).toBe('goedemorgen')
    expect(body.card.back).toBe('good morning')
    expect(body.card.card_id).toBe('c-123')

    expect(mockGetCard).toHaveBeenCalledWith('google-123', 'c-123')
    expect(mockUpdateCard).toHaveBeenCalledWith('google-123', 'c-123', {
      front: 'goedemorgen',
      back: 'good morning',
    })
  })

  it('should support partial updates', async () => {
    mockGetCard.mockResolvedValue(mockExistingCard)
    mockUpdateCard.mockResolvedValue({
      ...mockExistingCard,
      explanation: 'Updated explanation',
      updated_at: '2024-01-16T10:00:00Z',
    })

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
      body: JSON.stringify({
        explanation: 'Updated explanation',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.card.explanation).toBe('Updated explanation')
    expect(mockUpdateCard).toHaveBeenCalledWith('google-123', 'c-123', {
      explanation: 'Updated explanation',
    })
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      pathParameters: { card_id: 'c-123' },
      body: JSON.stringify({ front: 'test' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockGetCard).not.toHaveBeenCalled()
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
      body: JSON.stringify({ front: 'test' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'card_id is required',
      code: 'MISSING_PARAMETER',
    })
  })

  it('should return 400 for malformed JSON body', async () => {
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
      body: 'not valid json{',
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    })
    expect(mockGetCard).not.toHaveBeenCalled()
  })

  it('should return 400 when body is missing', async () => {
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

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
      code: 'MISSING_BODY',
    })
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
      body: JSON.stringify({
        front: 'test',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Card not found',
      code: 'NOT_FOUND',
    })
    expect(mockUpdateCard).not.toHaveBeenCalled()
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
      body: JSON.stringify({
        front: 'test',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })
})
