import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockCreateWritingAttempt, mockGetExercise, mockMarkExerciseCompleted } = vi.hoisted(() => ({
  mockCreateWritingAttempt: vi.fn(),
  mockGetExercise: vi.fn(),
  mockMarkExerciseCompleted: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      createWritingAttempt: mockCreateWritingAttempt,
      getExercise: mockGetExercise,
      markExerciseCompleted: mockMarkExerciseCompleted,
    })),
  }
})

const { handler } = await import('./index')

describe('writing-submit handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const makeEvent = (
    userId: string | undefined,
    body: Record<string, unknown> | null
  ): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId
          ? { jwt: { claims: { sub: userId } } }
          : {},
      },
      body: body ? JSON.stringify(body) : undefined,
    }) as unknown as APIGatewayProxyEventV2

  const mockExercise = {
    exercise_id: 'ex-1',
    type: 'translation',
    status: 'served',
    prompt: 'I walk to the store',
    reference_answer: 'Ik loop naar de winkel',
    alternatives: ['Ik wandel naar de winkel'],
    target_vocabulary: ['card-1', 'card-2'],
  }

  it('should assess and return correct answer result', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)
    mockCreateWritingAttempt.mockResolvedValue({
      score: 3,
      feedback: 'Correct!',
      match_type: 'exact',
    })
    mockMarkExerciseCompleted.mockResolvedValue(undefined)

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'ex-1',
        user_answer: 'Ik loop naar de winkel',
        duration_ms: 5000,
      })
    )

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(true)
    expect(body.grade).toBe(3)
    expect(body.feedback).toBe('Correct!')
    expect(body.match_type).toBe('exact')
    expect(body.reference_answer).toBe('Ik loop naar de winkel')
    expect(mockGetExercise).toHaveBeenCalledWith('user-123', 'ex-1')
    expect(mockCreateWritingAttempt).toHaveBeenCalledWith(
      'user-123',
      'ex-1',
      'translation',
      'Ik loop naar de winkel',
      'Ik loop naar de winkel',
      ['Ik wandel naar de winkel'],
      5000
    )
    expect(mockMarkExerciseCompleted).toHaveBeenCalledWith('user-123', 'ex-1')
  })

  it('should return incorrect answer result', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)
    mockCreateWritingAttempt.mockResolvedValue({
      score: 0,
      feedback: 'The correct answer is: "Ik loop naar de winkel"',
      match_type: 'wrong',
    })
    mockMarkExerciseCompleted.mockResolvedValue(undefined)

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'ex-1',
        user_answer: 'het hond',
        duration_ms: 3000,
      })
    )

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(false)
    expect(body.grade).toBe(0)
  })

  it('should return 404 when exercise not found', async () => {
    mockGetExercise.mockResolvedValue(null)

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'nonexistent',
        user_answer: 'test',
        duration_ms: 1000,
      })
    )

    expect(result.statusCode).toBe(404)
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(makeEvent(undefined, { exercise_id: 'test' }))
    expect(result.statusCode).toBe(401)
  })

  it('should return 400 when body is missing', async () => {
    const result = await handler(makeEvent('user-123', null))
    expect(result.statusCode).toBe(400)
  })

  it('should return 400 for missing required fields', async () => {
    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'test',
        // missing user_answer
      })
    )

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.code).toBe('MISSING_FIELDS')
  })

  it('should return 400 for invalid duration', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'ex-1',
        user_answer: 'answer',
        duration_ms: -1,
      })
    )

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.code).toBe('INVALID_DURATION')
  })

  it('should return 500 on error', async () => {
    mockGetExercise.mockRejectedValue(new Error('DB error'))

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'test',
        user_answer: 'answer',
        duration_ms: 1000,
      })
    )

    expect(result.statusCode).toBe(500)
  })
})
