import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const mockClearAllInsights = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      clearAllInsights: mockClearAllInsights,
    })),
  }
})

const { handler } = await import('./index')

describe('clear-insights handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const createEvent = (userId?: string): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId ? { jwt: { claims: { sub: userId } } } : {},
      },
    }) as APIGatewayProxyEventV2

  it('should return 401 when unauthorized', async () => {
    const event = createEvent()
    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  it('should clear all insights successfully', async () => {
    mockClearAllInsights.mockResolvedValue({
      clearedCards: 5,
      clearedReviewItems: 10,
    })

    const event = createEvent('user-123')
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body as string)).toEqual({
      message: 'All insights cleared successfully',
      cleared_cards: 5,
      cleared_review_items: 10,
    })
    expect(mockClearAllInsights).toHaveBeenCalledWith('user-123')
  })

  it('should return 500 on error', async () => {
    mockClearAllInsights.mockRejectedValue(new Error('DB error'))

    const event = createEvent('user-123')
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })
})
