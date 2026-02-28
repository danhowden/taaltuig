import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockGetCardsByIds = vi.fn()
const mockUpdateCardInsights = vi.fn()
const mockGetSettings = vi.fn()
const mockBedrockSend = vi.fn()

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    getCardsByIds: mockGetCardsByIds,
    updateCardInsights: mockUpdateCardInsights,
    getSettings: mockGetSettings,
  })),
  DEFAULT_SETTINGS: {
    proficiency_level: 'beginner',
  },
}))

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: mockBedrockSend,
  })),
  InvokeModelCommand: vi.fn((params) => params),
}))

// Import handler AFTER mocking
const { handler } = await import('./index')

describe('generate-insights Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    // Default mock for getSettings
    mockGetSettings.mockResolvedValue({ proficiency_level: 'beginner' })
  })

  const createEvent = (
    body: unknown,
    userId?: string
  ): APIGatewayProxyEventV2 =>
    ({
      body: JSON.stringify(body),
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: userId || 'test-user-123',
            },
          },
        },
      },
    }) as unknown as APIGatewayProxyEventV2

  it('should return 401 when unauthorized', async () => {
    const event = {
      body: JSON.stringify({ card_ids: ['c-1'] }),
      requestContext: { authorizer: {} },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
  })

  it('should return 400 when body is missing', async () => {
    const event = {
      requestContext: {
        authorizer: { jwt: { claims: { sub: 'test-user' } } },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
  })

  it('should return 400 when card_ids is missing', async () => {
    const event = createEvent({})
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('card_ids')
  })

  it('should return 400 when card_ids exceeds 20', async () => {
    const cardIds = Array.from({ length: 21 }, (_, i) => `c-${i}`)
    const event = createEvent({ card_ids: cardIds })

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('Maximum 20')
  })

  it('should return 400 when no valid cards found', async () => {
    mockGetCardsByIds.mockResolvedValue([])
    const event = createEvent({ card_ids: ['c-1'] })

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('No valid cards')
  })

  it('should generate insights successfully', async () => {
    const cards = [
      { card_id: 'c-1', front: 'aardappel', back: 'potato' },
      { card_id: 'c-2', front: 'schrijven', back: 'to write' },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    // Mock Bedrock response (without leading [ due to assistant prefill)
    const bedrockResponse = [
      {
        card_id: 'c-1',
        insights: [
          { type: 'compound', content: 'aard (earth) + appel (apple)' },
        ],
      },
      {
        card_id: 'c-2',
        insights: [
          { type: 'verb_forms', content: 'schreef, geschreven' },
          { type: 'pronunciation', content: 'sch = s+ch sound' },
        ],
      },
    ]
    // Response continues from the '[' prefill
    const responseWithoutBracket = JSON.stringify(bedrockResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: responseWithoutBracket }],
        })
      ),
    })

    mockUpdateCardInsights.mockResolvedValue({})

    const event = createEvent({ card_ids: ['c-1', 'c-2'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.generated).toHaveLength(2)
    expect(body.generated[0].card_id).toBe('c-1')
    expect(body.generated[0].insights_count).toBe(1)
    expect(body.generated[1].card_id).toBe('c-2')
    expect(body.generated[1].insights_count).toBe(2)

    // Verify insights were saved with pending status
    expect(mockUpdateCardInsights).toHaveBeenCalledTimes(2)
    expect(mockUpdateCardInsights).toHaveBeenCalledWith(
      'test-user-123',
      'c-1',
      expect.arrayContaining([
        expect.objectContaining({
          type: 'compound',
          status: 'pending',
        }),
      ])
    )
  })

  it('should handle markdown-wrapped JSON response', async () => {
    const cards = [{ card_id: 'c-1', front: 'huis', back: 'house' }]

    mockGetCardsByIds.mockResolvedValue(cards)

    // Mock Bedrock response with markdown wrapper (without leading [ due to prefill)
    const bedrockResponse = [
      { card_id: 'c-1', insights: [{ type: 'pronunciation', content: 'ui = ow sound' }] },
    ]
    // Response text should NOT include leading [ since we use assistant prefill with '['
    const responseWithoutBracket = JSON.stringify(bedrockResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: '```json\n' + responseWithoutBracket + '\n```',
            },
          ],
        })
      ),
    })

    mockUpdateCardInsights.mockResolvedValue({})

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.generated).toHaveLength(1)
  })

  it('should report failed card updates', async () => {
    const cards = [
      { card_id: 'c-1', front: 'test1', back: 'test1' },
      { card_id: 'c-2', front: 'test2', back: 'test2' },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    const bedrockResponse = [
      { card_id: 'c-1', insights: [{ type: 'root', content: 'test' }] },
      { card_id: 'c-2', insights: [{ type: 'root', content: 'test' }] },
    ]
    // Response continues from the '[' prefill
    const responseWithoutBracket = JSON.stringify(bedrockResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: responseWithoutBracket }],
        })
      ),
    })

    // First card succeeds, second fails
    mockUpdateCardInsights
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB error'))

    const event = createEvent({ card_ids: ['c-1', 'c-2'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.generated).toHaveLength(1)
    expect(body.failed).toContain('c-2')
  })

  it('should return 500 on invalid JSON response from model', async () => {
    const cards = [{ card_id: 'c-1', front: 'test', back: 'test' }]
    mockGetCardsByIds.mockResolvedValue(cards)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: 'This is not valid JSON' }],
        })
      ),
    })

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })

  it('should return 500 when model returns no text content', async () => {
    const cards = [{ card_id: 'c-1', front: 'test', back: 'test' }]
    mockGetCardsByIds.mockResolvedValue(cards)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [],
        })
      ),
    })

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })
})
