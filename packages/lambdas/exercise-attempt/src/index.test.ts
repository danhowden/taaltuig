import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({ send: mockSend }),
  },
  PutCommand: vi.fn().mockImplementation((input) => input),
}))

const { handler } = await import('./index')

function makeEvent(
  body: object,
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      authorizer: {
        jwt: { claims: { sub: 'user-1' } },
      },
    },
    body: JSON.stringify(body),
    ...overrides,
  } as unknown as APIGatewayProxyEventV2
}

describe('exercise-attempt handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EXERCISE_PROGRESS_TABLE_NAME = 'test-progress'
    mockSend.mockResolvedValue({})
  })

  it('returns 401 when unauthorized', async () => {
    const event = makeEvent(
      { exercise_id: 'ex-1', topic_id: 'a1.grammar.negation', result: 'correct' },
      { requestContext: { authorizer: {} } as APIGatewayProxyEventV2['requestContext'] }
    )
    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  it('returns 400 when body fields are missing', async () => {
    const result = await handler(makeEvent({ exercise_id: 'ex-1' }))
    expect(result.statusCode).toBe(400)
  })

  it('returns 400 for invalid result value', async () => {
    const result = await handler(makeEvent({
      exercise_id: 'ex-1', topic_id: 'a1.grammar.negation', result: 'wrong',
    }))
    expect(result.statusCode).toBe(400)
  })

  it('writes progress and returns ok for correct', async () => {
    const result = await handler(makeEvent({
      exercise_id: 'ex-1', topic_id: 'a1.grammar.negation', result: 'correct',
    }))
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body as string)).toEqual({ ok: true })
    const item = mockSend.mock.calls[0][0].Item
    expect(item.last_result).toBe('correct')
    expect(item.due_date).toBe('9999-12-31')
  })

  it('sets due_date to tomorrow for incorrect', async () => {
    const result = await handler(makeEvent({
      exercise_id: 'ex-1', topic_id: 'a1.grammar.negation', result: 'incorrect',
    }))
    expect(result.statusCode).toBe(200)
    const item = mockSend.mock.calls[0][0].Item
    expect(item.last_result).toBe('incorrect')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(item.due_date).toBe(tomorrow.toISOString().slice(0, 10))
  })

  it('sets due_date to far future for skipped', async () => {
    const result = await handler(makeEvent({
      exercise_id: 'ex-1', topic_id: 'a1.grammar.negation', result: 'skipped',
    }))
    expect(result.statusCode).toBe(200)
    const item = mockSend.mock.calls[0][0].Item
    expect(item.last_result).toBe('skipped')
    expect(item.due_date).toBe('9999-12-31')
  })
})
