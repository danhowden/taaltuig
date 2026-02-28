import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockCreateCard = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      createCard: mockCreateCard,
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

describe('create-card handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockCardResult = {
    card: {
      card_id: 'c-123',
      user_id: 'google-123',
      front: 'hallo',
      back: 'hello',
      explanation: 'Common greeting',
      source: 'manual',
      tags: ['greetings'],
      created_at: '2024-01-15T12:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    },
    reviewItems: [
      { review_item_id: 'ri-forward', direction: 'forward' },
      { review_item_id: 'ri-reverse', direction: 'reverse' },
    ],
  }

  it('should create a card with all fields', async () => {
    mockCreateCard.mockResolvedValue(mockCardResult)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        front: 'hallo',
        back: 'hello',
        explanation: 'Common greeting',
        tags: ['greetings'],
        source: 'manual',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(201)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body.card).toEqual({
      id: 'c-123',
      card_id: 'c-123',
      user_id: 'google-123',
      front: 'hallo',
      back: 'hello',
      explanation: 'Common greeting',
      source: 'manual',
      tags: ['greetings'],
      created_at: '2024-01-15T12:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    })

    expect(mockCreateCard).toHaveBeenCalledWith(
      'google-123',
      'hallo',
      'hello',
      'Common greeting',
      ['greetings'],
      'manual',
      undefined
    )
  })

  it('should create a card with minimal fields', async () => {
    mockCreateCard.mockResolvedValue({
      card: {
        ...mockCardResult.card,
        explanation: null,
        tags: [],
      },
      reviewItems: mockCardResult.reviewItems,
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        front: 'hallo',
        back: 'hello',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(201)
    const body = JSON.parse(result.body)
    expect(body.card.front).toBe('hallo')
    expect(body.card.back).toBe('hello')

    expect(mockCreateCard).toHaveBeenCalledWith(
      'google-123',
      'hallo',
      'hello',
      undefined,
      undefined,
      'manual',
      undefined
    )
  })

  it('should default source to "manual" when not provided', async () => {
    mockCreateCard.mockResolvedValue(mockCardResult)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        front: 'hallo',
        back: 'hello',
      }),
    } as unknown as APIGatewayProxyEventV2

    await handler(event)

    expect(mockCreateCard).toHaveBeenCalledWith(
      'google-123',
      'hallo',
      'hello',
      undefined,
      undefined,
      'manual',
      undefined
    )
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({ front: 'hallo', back: 'hello' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockCreateCard).not.toHaveBeenCalled()
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
      body: 'not valid json{',
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    })
    expect(mockCreateCard).not.toHaveBeenCalled()
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
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
      code: 'MISSING_BODY',
    })
  })

  it('should return 400 when front is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        back: 'hello',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'front and back are required',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should return 400 when back is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        front: 'hallo',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'front and back are required',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should return 500 on database error', async () => {
    mockCreateCard.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        front: 'hallo',
        back: 'hello',
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
