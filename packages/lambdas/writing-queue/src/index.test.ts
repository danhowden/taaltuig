import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const mockGetWritingQueue = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getWritingQueue: mockGetWritingQueue,
    })),
  }
})

const { handler } = await import('./index')

describe('writing-queue handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const makeEvent = (userId?: string): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId
          ? { jwt: { claims: { sub: userId } } }
          : {},
      },
      queryStringParameters: null,
    }) as unknown as APIGatewayProxyEventV2

  it('should return writing exercises and stats', async () => {
    mockGetWritingQueue.mockResolvedValue({
      exercises: [
        {
          exercise_id: 'card-linked:c1:translation',
          type: 'translation',
          prompt: 'the cat',
          reference_answer: 'de kat',
          alternatives: [],
          card_id: 'c1',
        },
      ],
      stats: {
        total_available: 5,
        exercises_today: 2,
        exercises_remaining: 8,
      },
    })

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(1)
    expect(body.exercises[0].type).toBe('translation')
    expect(body.stats.exercises_remaining).toBe(8)
    expect(mockGetWritingQueue).toHaveBeenCalledWith('user-123')
  })

  it('should return empty queue when no exercises available', async () => {
    mockGetWritingQueue.mockResolvedValue({
      exercises: [],
      stats: { total_available: 0, exercises_today: 0, exercises_remaining: 0 },
    })

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(0)
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(makeEvent())
    expect(result.statusCode).toBe(401)
  })

  it('should return 500 on error', async () => {
    mockGetWritingQueue.mockRejectedValue(new Error('DB error'))

    const result = await handler(makeEvent('user-123'))
    expect(result.statusCode).toBe(500)
  })
})
