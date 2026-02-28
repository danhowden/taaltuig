import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockGetReviewQueue = vi.fn()
const mockListAllReviewItems = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getReviewQueue: mockGetReviewQueue,
      listAllReviewItems: mockListAllReviewItems,
    })),
  }
})

const { handler } = await import('./index')

describe('get-review-queue handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('should return review queue with items and stats', async () => {
    const mockQueue = [
      {
        review_item_id: 'ri-1',
        card_id: 'c-1',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'REVIEW' as const,
        interval: 10,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: '2024-01-15T00:00:00Z',
        last_reviewed: '2024-01-05T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        front: 'hallo',
        back: 'hello',
        explanation: 'Common greeting',
      },
      {
        review_item_id: 'ri-2',
        card_id: 'c-2',
        user_id: 'google-123',
        direction: 'reverse' as const,
        state: 'NEW' as const,
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: '2024-01-15T12:00:00Z',
        last_reviewed: null,
        created_at: '2024-01-15T00:00:00Z',
        front: 'goodbye',
        back: 'dag',
        explanation: null,
      },
    ]

    const mockStats = {
      due_count: 5,
      new_count: 15,
      learning_count: 3,
      review_count: 2,
    }

    mockGetReviewQueue.mockResolvedValue({
      queue: mockQueue,
      stats: mockStats,
    })

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
    expect(body.queue).toHaveLength(2)
    expect(body.queue[0]).toEqual({
      id: 'ri-1',
      review_item_id: 'ri-1',
      card_id: 'c-1',
      user_id: 'google-123',
      direction: 'forward',
      state: 'REVIEW',
      interval: 10,
      ease_factor: 2.5,
      repetitions: 3,
      step_index: 0,
      due_date: '2024-01-15T00:00:00Z',
      last_reviewed: '2024-01-05T12:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      front: 'hallo',
      back: 'hello',
      explanation: 'Common greeting',
    })

    expect(body.stats).toEqual(mockStats)
    expect(mockGetReviewQueue).toHaveBeenCalledWith('google-123', { extraNew: 0 })
  })

  it('should return empty queue when no items are due', async () => {
    mockGetReviewQueue.mockResolvedValue({
      queue: [],
      stats: {
        due_count: 0,
        new_count: 0,
        learning_count: 0,
        review_count: 0,
      },
    })

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
    expect(body.queue).toEqual([])
    expect(body.stats.due_count).toBe(0)
  })

  it('should pass extra_new parameter when provided in query string', async () => {
    const mockQueue = [
      {
        review_item_id: 'ri-1',
        card_id: 'c-1',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'NEW' as const,
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: '2024-01-15T12:00:00Z',
        last_reviewed: null,
        created_at: '2024-01-15T00:00:00Z',
        front: 'extra card',
        back: 'extra kaart',
        explanation: null,
      },
    ]

    mockGetReviewQueue.mockResolvedValue({
      queue: mockQueue,
      stats: {
        due_count: 0,
        new_count: 1,
        learning_count: 0,
        total_count: 1,
        new_remaining_today: 0,
      },
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
        extra_new: '25',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(mockGetReviewQueue).toHaveBeenCalledWith('google-123', { extraNew: 25 })
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
    expect(mockGetReviewQueue).not.toHaveBeenCalled()
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
    expect(mockGetReviewQueue).not.toHaveBeenCalled()
  })

  it('should return 500 on database error', async () => {
    mockGetReviewQueue.mockRejectedValue(new Error('Database error'))

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

  it('should handle queue with only new cards', async () => {
    const mockQueue = [
      {
        review_item_id: 'ri-new-1',
        card_id: 'c-new-1',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'NEW' as const,
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: '2024-01-15T12:00:00Z',
        last_reviewed: null,
        created_at: '2024-01-15T00:00:00Z',
        front: 'new card',
        back: 'nieuwe kaart',
        explanation: null,
      },
    ]

    mockGetReviewQueue.mockResolvedValue({
      queue: mockQueue,
      stats: {
        due_count: 1,
        new_count: 1,
        learning_count: 0,
        review_count: 0,
      },
    })

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
    expect(body.queue[0].state).toBe('NEW')
    expect(body.queue[0].last_reviewed).toBeNull()
  })

  it('should include denormalized card data in response', async () => {
    const mockQueue = [
      {
        review_item_id: 'ri-1',
        card_id: 'c-1',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'LEARNING' as const,
        interval: 0.007,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 1,
        due_date: '2024-01-15T12:10:00Z',
        last_reviewed: '2024-01-15T12:00:00Z',
        created_at: '2024-01-15T00:00:00Z',
        front: 'goedemorgen',
        back: 'good morning',
        explanation: 'Formal morning greeting',
      },
    ]

    mockGetReviewQueue.mockResolvedValue({
      queue: mockQueue,
      stats: { due_count: 1, new_count: 0, learning_count: 1, review_count: 0 },
    })

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

    const body = JSON.parse(result.body)
    expect(body.queue[0].front).toBe('goedemorgen')
    expect(body.queue[0].back).toBe('good morning')
    expect(body.queue[0].explanation).toBe('Formal morning greeting')
  })

  it('should return all review items when all=true query param is set', async () => {
    const now = new Date('2024-01-15T12:00:00Z').toISOString()
    const mockAllItems = [
      {
        review_item_id: 'ri-1',
        card_id: 'c-1',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'REVIEW' as const,
        interval: 10,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: '2024-01-15T00:00:00Z', // Due
        last_reviewed: '2024-01-05T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        front: 'hallo',
        back: 'hello',
        explanation: 'Common greeting',
        category: 'Greetings',
      },
      {
        review_item_id: 'ri-2',
        card_id: 'c-1',
        user_id: 'google-123',
        direction: 'reverse' as const,
        state: 'NEW' as const,
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: now,
        last_reviewed: null,
        created_at: '2024-01-01T00:00:00Z',
        front: 'hello',
        back: 'hallo',
        explanation: 'Common greeting',
        category: 'Greetings',
      },
      {
        review_item_id: 'ri-3',
        card_id: 'c-2',
        user_id: 'google-123',
        direction: 'forward' as const,
        state: 'LEARNING' as const,
        interval: 0.007,
        ease_factor: 2.5,
        repetitions: 1,
        step_index: 1,
        due_date: '2024-01-15T10:00:00Z', // Due
        last_reviewed: '2024-01-15T09:50:00Z',
        created_at: '2024-01-10T00:00:00Z',
        front: 'goedemorgen',
        back: 'good morning',
        explanation: null,
        category: null,
      },
    ]

    mockListAllReviewItems.mockResolvedValue(mockAllItems)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      queryStringParameters: {
        all: 'true',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    expect(body.queue).toHaveLength(3)
    expect(body.stats.total_count).toBe(3)
    expect(body.stats.due_count).toBe(2) // REVIEW + LEARNING items due
    expect(body.stats.new_count).toBe(1) // One NEW item
    expect(body.stats.learning_count).toBe(1) // One LEARNING item
    expect(mockListAllReviewItems).toHaveBeenCalledWith('google-123')
    expect(mockGetReviewQueue).not.toHaveBeenCalled()
  })

  it('should handle empty all items list', async () => {
    mockListAllReviewItems.mockResolvedValue([])

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      queryStringParameters: {
        all: 'true',
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    expect(body.queue).toEqual([])
    expect(body.stats.total_count).toBe(0)
    expect(body.stats.due_count).toBe(0)
    expect(body.stats.new_count).toBe(0)
  })
})
