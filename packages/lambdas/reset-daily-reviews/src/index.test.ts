import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockResetDailyReviews = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      resetDailyReviews: mockResetDailyReviews,
    })),
  }
})

const { handler } = await import('./index')

describe('reset-daily-reviews handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('should reset daily reviews successfully', async () => {
    mockResetDailyReviews.mockResolvedValue(15)

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
    expect(body).toEqual({
      message: 'Daily reviews reset successfully',
      deleted_count: 15,
    })

    expect(mockResetDailyReviews).toHaveBeenCalledWith('google-123')
  })

  it('should handle zero deletions', async () => {
    mockResetDailyReviews.mockResolvedValue(0)

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
    expect(body.deleted_count).toBe(0)
  })

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
    expect(mockResetDailyReviews).not.toHaveBeenCalled()
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
    expect(mockResetDailyReviews).not.toHaveBeenCalled()
  })

  it('should return 500 on database error', async () => {
    mockResetDailyReviews.mockRejectedValue(new Error('Database error'))

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
})
