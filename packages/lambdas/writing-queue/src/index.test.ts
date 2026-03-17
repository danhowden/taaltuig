import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const {
  mockGetSettings,
  mockCountWritingAttemptsToday,
  mockGetExercisePoolCount,
  mockGetExercisePool,
  mockLambdaSend,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockCountWritingAttemptsToday: vi.fn(),
  mockGetExercisePoolCount: vi.fn(),
  mockGetExercisePool: vi.fn(),
  mockLambdaSend: vi.fn().mockResolvedValue({}),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getSettings: mockGetSettings,
      countWritingAttemptsToday: mockCountWritingAttemptsToday,
      getExercisePoolCount: mockGetExercisePoolCount,
      getExercisePool: mockGetExercisePool,
    })),
  }
})

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({ send: mockLambdaSend })),
  InvokeCommand: vi.fn().mockImplementation((input) => input),
}))

const { handler } = await import('./index')

describe('writing-queue handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.GENERATE_FUNCTION_NAME = 'writing-generate-fn'
    mockLambdaSend.mockResolvedValue({})
  })

  const makeEvent = (userId?: string, queryParams?: Record<string, string>): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        authorizer: userId
          ? { jwt: { claims: { sub: userId } } }
          : {},
      },
      queryStringParameters: queryParams || null,
    }) as unknown as APIGatewayProxyEventV2

  const defaultSettings = {
    writing_session_enabled: true,
    writing_exercises_per_day: 10,
  }

  it('should return exercises from pool', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(2)
    mockGetExercisePoolCount.mockResolvedValue(25)
    mockGetExercisePool.mockResolvedValue([
      {
        exercise_id: 'ex-1',
        type: 'translation',
        prompt: 'I walk to the store',
        reference_answer: 'Ik loop naar de winkel',
        alternatives: ['Ik wandel naar de winkel'],
        grammar_focus: 'present tense',
        target_vocabulary: ['card-1', 'card-2'],
        status: 'pending',
        priority: 'normal',
      },
    ])

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(1)
    expect(body.exercises[0].exercise_id).toBe('ex-1')
    expect(body.stats.exercises_remaining).toBe(8)
    expect(body.stats.pool_size).toBe(25)
    expect(body.stats.can_complete_more).toBe(true)
  })

  it('should return empty when writing disabled', async () => {
    mockGetSettings.mockResolvedValue({ ...defaultSettings, writing_session_enabled: false })
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(5)

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(0)
    expect(mockGetExercisePool).not.toHaveBeenCalled()
  })

  it('should return empty when daily limit reached', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(10)
    mockGetExercisePoolCount.mockResolvedValue(5)

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(0)
    expect(body.stats.exercises_remaining).toBe(0)
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(makeEvent())
    expect(result.statusCode).toBe(401)
  })

  it('should return stats only in count mode without side effects', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(3)
    mockGetExercisePoolCount.mockResolvedValue(15)

    const result = await handler(makeEvent('user-123', { mode: 'count' }))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(0)
    expect(body.stats.pool_size).toBe(15)
    expect(body.stats.exercises_remaining).toBe(7)
    expect(mockGetExercisePool).not.toHaveBeenCalled()
  })

  it('should trigger generation when pool is low', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(5) // below threshold
    mockGetExercisePool.mockResolvedValue([])

    await handler(makeEvent('user-123'))

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 0))
    expect(mockLambdaSend).toHaveBeenCalledWith(expect.objectContaining({ InvocationType: 'Event' }))
  })

  it('should not trigger generation when pool is healthy', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(25) // above threshold
    mockGetExercisePool.mockResolvedValue([])

    await handler(makeEvent('user-123'))

    await new Promise((r) => setTimeout(r, 0))
    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('should not trigger generation in count mode', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(0)

    await handler(makeEvent('user-123', { mode: 'count' }))

    await new Promise((r) => setTimeout(r, 0))
    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('should return 500 on error', async () => {
    mockGetSettings.mockRejectedValue(new Error('DB error'))
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(0)

    const result = await handler(makeEvent('user-123'))
    expect(result.statusCode).toBe(500)
  })
})
