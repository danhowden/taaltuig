import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockGetExercise, mockMarkExerciseCompleted, mockBedrockSend } = vi.hoisted(() => ({
  mockGetExercise: vi.fn(),
  mockMarkExerciseCompleted: vi.fn(),
  mockBedrockSend: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    getExercise: mockGetExercise,
    markExerciseCompleted: mockMarkExerciseCompleted,
  })),
}))

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockBedrockSend })),
  InvokeModelCommand: vi.fn().mockImplementation((input) => input),
}))

const { handler } = await import('./index')

const makeBedrockResponse = (result: { correct: boolean; feedback: string }) => ({
  body: new TextEncoder().encode(
    JSON.stringify({ content: [{ text: JSON.stringify(result) }] })
  ),
})

const mockExercise = {
  exercise_id: 'ex-1',
  type: 'word_reorder',
  prompt: 'maandag / eet / ik / soep / op',
  reference_answer: 'Op maandag eet ik soep',
  alternatives: ['Ik eet soep op maandag'],
}

const makeEvent = (body: object, userId = 'user-1'): APIGatewayProxyEventV2 =>
  ({
    requestContext: { authorizer: { jwt: { claims: { sub: userId } } } },
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as APIGatewayProxyEventV2

describe('writing-challenge handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('returns correct=true and marks completed when AI agrees', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)
    mockBedrockSend.mockResolvedValue(makeBedrockResponse({ correct: true, feedback: 'Valid alternative word order' }))
    mockMarkExerciseCompleted.mockResolvedValue(undefined)

    const result = await handler(makeEvent({ exercise_id: 'ex-1', user_answer: 'ik eet soep op maandag' }))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(true)
    expect(body.feedback).toBe('Valid alternative word order')
    expect(mockMarkExerciseCompleted).toHaveBeenCalledWith('user-1', 'ex-1')
  })

  it('returns correct=false and does not mark completed when AI disagrees', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)
    mockBedrockSend.mockResolvedValue(makeBedrockResponse({ correct: false, feedback: 'Wrong word order' }))

    const result = await handler(makeEvent({ exercise_id: 'ex-1', user_answer: 'soep eet ik op maandag' }))

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.correct).toBe(false)
    expect(mockMarkExerciseCompleted).not.toHaveBeenCalled()
  })

  it('returns 404 when exercise not found', async () => {
    mockGetExercise.mockResolvedValue(null)

    const result = await handler(makeEvent({ exercise_id: 'missing', user_answer: 'test' }))

    expect(result.statusCode).toBe(404)
  })

  it('returns 401 when unauthorized', async () => {
    const event = { requestContext: { authorizer: {} } } as unknown as APIGatewayProxyEventV2
    expect((await handler(event)).statusCode).toBe(401)
  })

  it('returns 400 when fields missing', async () => {
    const result = await handler(makeEvent({ exercise_id: 'ex-1' }))
    expect(result.statusCode).toBe(400)
  })

  it('returns 500 when AI response is not valid JSON', async () => {
    mockGetExercise.mockResolvedValue(mockExercise)
    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({ content: [{ text: 'not valid json' }] })
      ),
    })

    const result = await handler(makeEvent({ exercise_id: 'ex-1', user_answer: 'test' }))
    expect(result.statusCode).toBe(500)
  })

  it('returns 500 when an unexpected error occurs', async () => {
    mockGetExercise.mockRejectedValue(new Error('DynamoDB error'))

    const result = await handler(makeEvent({ exercise_id: 'ex-1', user_answer: 'test' }))
    expect(result.statusCode).toBe(500)
  })
})
