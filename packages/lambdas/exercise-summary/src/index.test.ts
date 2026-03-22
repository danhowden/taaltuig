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
      authorizer: {
        jwt: { claims: { sub: 'user-1' } },
      },
    },
    queryStringParameters: { level: 'A1' },
    ...overrides,
  } as unknown as APIGatewayProxyEventV2
}

describe('exercise-summary handler', () => {
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

  it('returns 400 when level is missing', async () => {
    const event = makeEvent({ queryStringParameters: {} })
    const result = await handler(event)
    expect(result.statusCode).toBe(400)
  })

  it('returns 400 when level is invalid', async () => {
    const event = makeEvent({ queryStringParameters: { level: 'X9' } })
    const result = await handler(event)
    expect(result.statusCode).toBe(400)
  })

  it('returns aggregated counts per topic', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { topic_id: 'a1.grammar.negation', type: 'fill_blank' },
        { topic_id: 'a1.grammar.negation', type: 'fill_blank' },
        { topic_id: 'a1.grammar.negation', type: 'translation' },
        { topic_id: 'a1.grammar.nouns.de_het', type: 'fill_blank' },
      ],
    })

    const event = makeEvent()
    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.level).toBe('A1')
    expect(body.counts['a1.grammar.negation']).toEqual({
      total: 3,
      by_type: { fill_blank: 2, translation: 1 },
    })
    expect(body.counts['a1.grammar.nouns.de_het']).toEqual({
      total: 1,
      by_type: { fill_blank: 1 },
    })
  })

  it('returns empty counts when no exercises exist', async () => {
    mockSend.mockResolvedValue({ Items: [] })

    const event = makeEvent({ queryStringParameters: { level: 'C2' } })
    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.level).toBe('C2')
    expect(body.counts).toEqual({})
  })

  it('handles case-insensitive level parameter', async () => {
    mockSend.mockResolvedValue({ Items: [] })

    const event = makeEvent({ queryStringParameters: { level: 'a1' } })
    const result = await handler(event)
    expect(result.statusCode).toBe(200)
  })
})
