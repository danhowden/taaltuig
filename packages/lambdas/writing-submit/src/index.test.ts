import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const mockCreateWritingAttempt = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      createWritingAttempt: mockCreateWritingAttempt,
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

  it('should assess and return correct answer result', async () => {
    mockCreateWritingAttempt.mockResolvedValue({
      score: 3,
      feedback: 'Correct!',
      match_type: 'exact',
    })

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'card-linked:c1:translation',
        exercise_type: 'translation',
        user_answer: 'de kat',
        reference_answer: 'de kat',
        alternatives: [],
        duration_ms: 5000,
        card_id: 'c1',
      })
    )

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(true)
    expect(body.grade).toBe(3)
    expect(body.feedback).toBe('Correct!')
    expect(body.match_type).toBe('exact')
    expect(mockCreateWritingAttempt).toHaveBeenCalledWith(
      'user-123',
      'card-linked:c1:translation',
      'translation',
      'de kat',
      'de kat',
      [],
      5000,
      'c1'
    )
  })

  it('should return incorrect answer result', async () => {
    mockCreateWritingAttempt.mockResolvedValue({
      score: 0,
      feedback: 'The correct answer is: "de kat"',
      match_type: 'wrong',
    })

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'card-linked:c1:translation',
        exercise_type: 'translation',
        user_answer: 'het hond',
        reference_answer: 'de kat',
        alternatives: [],
        duration_ms: 3000,
      })
    )

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(false)
    expect(body.grade).toBe(0)
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
        // missing exercise_type, user_answer, reference_answer
      })
    )

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.code).toBe('MISSING_FIELDS')
  })

  it('should return 400 for invalid exercise type', async () => {
    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'test',
        exercise_type: 'invalid_type',
        user_answer: 'answer',
        reference_answer: 'ref',
        duration_ms: 1000,
      })
    )

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.code).toBe('INVALID_EXERCISE_TYPE')
  })

  it('should return 400 for invalid duration', async () => {
    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'test',
        exercise_type: 'translation',
        user_answer: 'answer',
        reference_answer: 'ref',
        duration_ms: -1,
      })
    )

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.code).toBe('INVALID_DURATION')
  })

  it('should return 500 on error', async () => {
    mockCreateWritingAttempt.mockRejectedValue(new Error('DB error'))

    const result = await handler(
      makeEvent('user-123', {
        exercise_id: 'test',
        exercise_type: 'translation',
        user_answer: 'de kat',
        reference_answer: 'de kat',
        duration_ms: 1000,
      })
    )

    expect(result.statusCode).toBe(500)
  })
})
