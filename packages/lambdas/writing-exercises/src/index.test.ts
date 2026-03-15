import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockGetExercisesForCard, mockGetAllExercises, mockClearIncompleteExercises } = vi.hoisted(() => ({
  mockGetExercisesForCard: vi.fn(),
  mockGetAllExercises: vi.fn(),
  mockClearIncompleteExercises: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getExercisesForCard: mockGetExercisesForCard,
      getAllExercises: mockGetAllExercises,
      clearIncompleteExercises: mockClearIncompleteExercises,
    })),
  }
})

const { handler } = await import('./index')

describe('writing-exercises handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const makeEvent = (
    userId?: string,
    queryParams?: Record<string, string>,
    method?: string
  ): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId
          ? { jwt: { claims: { sub: userId } } }
          : {},
        http: { method: method || 'GET' },
      },
      queryStringParameters: queryParams || null,
    }) as unknown as APIGatewayProxyEventV2

  it('should return exercises for a specific card', async () => {
    mockGetExercisesForCard.mockResolvedValue([
      {
        exercise_id: 'ex-1',
        exercise_type: 'translation',
        exercise_status: 'pending',
        prompt: 'I walk to the store',
        generated_at: '2026-03-15T12:00:00Z',
      },
    ])

    const result = await handler(makeEvent('user-123', { card_id: 'card-1' }))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body).toHaveLength(1)
    expect(body[0].exercise_id).toBe('ex-1')
    expect(mockGetExercisesForCard).toHaveBeenCalledWith('user-123', 'card-1')
  })

  it('should return all exercises when no card_id', async () => {
    mockGetAllExercises.mockResolvedValue([
      { exercise_id: 'ex-1', status: 'pending' },
      { exercise_id: 'ex-2', status: 'completed' },
    ])

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body).toHaveLength(2)
    expect(mockGetAllExercises).toHaveBeenCalledWith('user-123')
  })

  it('should clear incomplete exercises on DELETE', async () => {
    mockClearIncompleteExercises.mockResolvedValue({ deleted: 15 })

    const result = await handler(makeEvent('user-123', undefined, 'DELETE'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.deleted).toBe(15)
    expect(mockClearIncompleteExercises).toHaveBeenCalledWith('user-123')
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(makeEvent())
    expect(result.statusCode).toBe(401)
  })

  it('should return 500 on error', async () => {
    mockGetAllExercises.mockRejectedValue(new Error('DB error'))

    const result = await handler(makeEvent('user-123'))
    expect(result.statusCode).toBe(500)
  })
})
