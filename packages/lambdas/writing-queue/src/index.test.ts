import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const {
  mockGetSettings,
  mockCountWritingAttemptsToday,
  mockGetExercisePoolCount,
  mockGetExercisePool,
  mockMarkExercisesServed,
  mockLambdaSend,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockCountWritingAttemptsToday: vi.fn(),
  mockGetExercisePoolCount: vi.fn(),
  mockGetExercisePool: vi.fn(),
  mockMarkExercisesServed: vi.fn(),
  mockLambdaSend: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getSettings: mockGetSettings,
      countWritingAttemptsToday: mockCountWritingAttemptsToday,
      getExercisePoolCount: mockGetExercisePoolCount,
      getExercisePool: mockGetExercisePool,
      markExercisesServed: mockMarkExercisesServed,
    })),
  }
})

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({
    send: mockLambdaSend,
  })),
  InvokeCommand: vi.fn((params) => params),
}))

const { handler } = await import('./index')

describe('writing-queue handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.GENERATE_FUNCTION_NAME = 'taaltuig-writing-generate'
    mockLambdaSend.mockResolvedValue({})
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
    mockMarkExercisesServed.mockResolvedValue(undefined)

    const result = await handler(makeEvent('user-123'))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toHaveLength(1)
    expect(body.exercises[0].exercise_id).toBe('ex-1')
    expect(body.stats.exercises_remaining).toBe(8)
    expect(body.stats.pool_size).toBe(25)
    expect(body.stats.can_complete_more).toBe(true)
    expect(mockMarkExercisesServed).toHaveBeenCalledWith('user-123', ['ex-1'])
  })

  it('should trigger generation when pool is low', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(5) // below threshold of 20
    mockGetExercisePool.mockResolvedValue([])

    await handler(makeEvent('user-123'))

    expect(mockLambdaSend).toHaveBeenCalledOnce()
    expect(mockLambdaSend).toHaveBeenCalledWith(
      expect.objectContaining({
        FunctionName: 'taaltuig-writing-generate',
        InvocationType: 'Event',
      })
    )
  })

  it('should not trigger generation when pool is sufficient', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(25) // above threshold
    mockGetExercisePool.mockResolvedValue([])

    await handler(makeEvent('user-123'))

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('should not fail if generation trigger errors', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(5)
    mockGetExercisePool.mockResolvedValue([])
    mockLambdaSend.mockRejectedValue(new Error('Lambda invoke failed'))

    const result = await handler(makeEvent('user-123'))

    // Should still return 200 — generation failure is non-blocking
    expect(result.statusCode).toBe(200)
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

  it('should not mark served when pool is empty', async () => {
    mockGetSettings.mockResolvedValue(defaultSettings)
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(0)
    mockGetExercisePool.mockResolvedValue([])

    await handler(makeEvent('user-123'))

    expect(mockMarkExercisesServed).not.toHaveBeenCalled()
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(makeEvent())
    expect(result.statusCode).toBe(401)
  })

  it('should return 500 on error', async () => {
    mockGetSettings.mockRejectedValue(new Error('DB error'))
    mockCountWritingAttemptsToday.mockResolvedValue(0)
    mockGetExercisePoolCount.mockResolvedValue(0)

    const result = await handler(makeEvent('user-123'))
    expect(result.statusCode).toBe(500)
  })
})
