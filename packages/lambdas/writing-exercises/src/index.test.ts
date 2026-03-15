import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockGetExercisesForCard, mockGetAllExercises, mockClearIncompleteExercises, mockRejectExercise, mockResetExercise, mockGetWritingAttemptsByExercise } = vi.hoisted(() => ({
  mockGetExercisesForCard: vi.fn(),
  mockGetAllExercises: vi.fn(),
  mockClearIncompleteExercises: vi.fn(),
  mockRejectExercise: vi.fn(),
  mockResetExercise: vi.fn(),
  mockGetWritingAttemptsByExercise: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getExercisesForCard: mockGetExercisesForCard,
      getAllExercises: mockGetAllExercises,
      clearIncompleteExercises: mockClearIncompleteExercises,
      rejectExercise: mockRejectExercise,
      resetExercise: mockResetExercise,
      getWritingAttemptsByExercise: mockGetWritingAttemptsByExercise,
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
    method?: string,
    body?: Record<string, unknown>
  ): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId
          ? { jwt: { claims: { sub: userId } } }
          : {},
        http: { method: method || 'GET' },
      },
      queryStringParameters: queryParams || null,
      body: body ? JSON.stringify(body) : undefined,
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

  it('should return all exercises with attempt data when no card_id', async () => {
    mockGetAllExercises.mockResolvedValue([
      { exercise_id: 'ex-1', status: 'pending' },
      { exercise_id: 'ex-2', status: 'completed' },
    ])
    mockGetWritingAttemptsByExercise.mockResolvedValue(
      new Map([['ex-2', { user_answer: 'de kat', score: 3, feedback: 'Correct!', match_type: 'exact', created_at: '2026-03-15T12:00:00Z' }]])
    )

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body).toHaveLength(2)
    expect(body[0].attempt).toBeNull()
    expect(body[1].attempt).toMatchObject({ user_answer: 'de kat', score: 3 })
  })

  it('should clear incomplete exercises on DELETE', async () => {
    mockClearIncompleteExercises.mockResolvedValue({ deleted: 15 })

    const result = await handler(makeEvent('user-123', undefined, 'DELETE'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.deleted).toBe(15)
    expect(mockClearIncompleteExercises).toHaveBeenCalledWith('user-123')
  })

  it('should reject an exercise with a reason on PUT', async () => {
    mockRejectExercise.mockResolvedValue(undefined)

    const result = await handler(makeEvent(
      'user-123',
      undefined,
      'PUT',
      { exercise_id: 'ex-1', reason: 'Unnatural Dutch phrasing' }
    ))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercise_id).toBe('ex-1')
    expect(mockRejectExercise).toHaveBeenCalledWith('user-123', 'ex-1', 'Unnatural Dutch phrasing')
  })

  it('should return 400 when rejecting without reason', async () => {
    const result = await handler(makeEvent(
      'user-123',
      undefined,
      'PUT',
      { exercise_id: 'ex-1' }
    ))

    expect(result.statusCode).toBe(400)
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
