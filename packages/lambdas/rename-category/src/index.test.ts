import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockRenameCategory = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      renameCategory: mockRenameCategory,
    })),
  }
})

const { handler } = await import('./index')

describe('rename-category handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockRenameResult = {
    cardsUpdated: 5,
    reviewItemsUpdated: 10,
    settingsUpdated: true,
  }

  it('should rename category successfully', async () => {
    mockRenameCategory.mockResolvedValue(mockRenameResult)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        oldCategory: 'Food',
        newCategory: 'Cuisine',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body).toEqual({
      success: true,
      cardsUpdated: 5,
      reviewItemsUpdated: 10,
      settingsUpdated: true,
    })

    expect(mockRenameCategory).toHaveBeenCalledWith('google-123', 'Food', 'Cuisine')
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({
        oldCategory: 'Food',
        newCategory: 'Cuisine',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockRenameCategory).not.toHaveBeenCalled()
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
    expect(mockRenameCategory).not.toHaveBeenCalled()
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

  it('should return 400 when oldCategory is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        newCategory: 'Cuisine',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'oldCategory and newCategory are required',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should return 400 when newCategory is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        oldCategory: 'Food',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'oldCategory and newCategory are required',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should return 400 when old and new categories are the same', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        oldCategory: 'Food',
        newCategory: 'Food',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Old and new category names must be different',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should return 500 on database error', async () => {
    mockRenameCategory.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        oldCategory: 'Food',
        newCategory: 'Cuisine',
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
