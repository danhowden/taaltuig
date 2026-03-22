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
  QueryCommand: vi.fn().mockImplementation((input) => input),
}))

const { handler } = await import('./index')

function makeEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      authorizer: { jwt: { claims: { sub: 'user-1' } } },
      http: { method: 'GET' },
    },
    queryStringParameters: { topic: 'a1.grammar.negation' },
    ...overrides,
  } as unknown as APIGatewayProxyEventV2
}

const mockItem = {
  PK: 'TOPIC#a1.grammar.negation',
  SK: 'fill_blank#a1.grammar.negation-0',
  GSI1PK: 'LEVEL#A1',
  GSI1SK: 'fill_blank#a1.grammar.negation#a1.grammar.negation-0',
  exercise_id: 'a1.grammar.negation-0',
  type: 'fill_blank',
  topic_id: 'a1.grammar.negation',
  cefr_level: 'A1',
  prompt: 'Ik heb ___ boek.',
  reference_answer: 'geen',
  alternatives: [],
  grammar_focus: 'geen with het-nouns',
  seeded_at: '2026-03-22T00:00:00Z',
}

describe('exercise-catalog handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EXERCISES_TABLE_NAME = 'test-exercises'
  })

  it('returns 401 when unauthorized', async () => {
    const event = makeEvent({
      requestContext: { authorizer: {} } as APIGatewayProxyEventV2['requestContext'],
    })
    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  it('returns 400 when no topic or level provided', async () => {
    const event = makeEvent({ queryStringParameters: {} })
    const result = await handler(event)
    expect(result.statusCode).toBe(400)
  })

  it('queries by topic PK', async () => {
    mockSend.mockResolvedValue({ Items: [mockItem] })

    const event = makeEvent()
    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.count).toBe(1)
    expect(body.exercises[0].exercise_id).toBe('a1.grammar.negation-0')
    expect(body.exercises[0].prompt).toBe('Ik heb ___ boek.')
    // Should not include DynamoDB keys
    expect(body.exercises[0].PK).toBeUndefined()
    expect(body.exercises[0].SK).toBeUndefined()
  })

  it('queries by topic with type filter', async () => {
    mockSend.mockResolvedValue({ Items: [mockItem] })

    const event = makeEvent({
      queryStringParameters: { topic: 'a1.grammar.negation', type: 'fill_blank' },
    })
    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.count).toBe(1)
  })

  it('queries by level via GSI1', async () => {
    mockSend.mockResolvedValue({ Items: [mockItem] })

    const event = makeEvent({
      queryStringParameters: { level: 'A1' },
    })
    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.count).toBe(1)
  })

  it('queries by level with type filter', async () => {
    mockSend.mockResolvedValue({ Items: [mockItem] })

    const event = makeEvent({
      queryStringParameters: { level: 'a1', type: 'fill_blank' },
    })
    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })

  it('returns 400 for invalid level', async () => {
    const event = makeEvent({
      queryStringParameters: { level: 'X9' },
    })
    const result = await handler(event)
    expect(result.statusCode).toBe(400)
  })

  it('returns empty array when no exercises found', async () => {
    mockSend.mockResolvedValue({ Items: [] })

    const event = makeEvent()
    const result = await handler(event)
    const body = JSON.parse(result.body as string)
    expect(body.exercises).toEqual([])
    expect(body.count).toBe(0)
  })
})
