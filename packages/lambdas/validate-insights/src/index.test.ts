import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockGetCardsByIds = vi.fn()
const mockBulkUpdateInsightsStatus = vi.fn()
const mockDeleteInsight = vi.fn()
const mockBedrockSend = vi.fn()
const mockCloudWatchSend = vi.fn()

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    getCardsByIds: mockGetCardsByIds,
    bulkUpdateInsightsStatus: mockBulkUpdateInsightsStatus,
    deleteInsight: mockDeleteInsight,
  })),
}))

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: mockBedrockSend,
  })),
  InvokeModelCommand: vi.fn((params) => params),
}))

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({
    send: mockCloudWatchSend,
  })),
  PutMetricDataCommand: vi.fn((params) => params),
}))

// Import handler AFTER mocking
const { handler } = await import('./index')

describe('validate-insights Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    // Mock CloudWatch to succeed
    mockCloudWatchSend.mockResolvedValue({})
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

  it('should return 400 when no cards with pending insights found', async () => {
    mockGetCardsByIds.mockResolvedValue([
      {
        card_id: 'c-1',
        insights: [{ type: 'compound', status: 'approved' }],
      },
    ])

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('pending')
  })

  it('should validate insights successfully', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'aardappel',
        back: 'potato',
        insights: [
          {
            type: 'compound',
            content: 'aard (earth) + appel (apple)',
            status: 'pending',
          },
        ],
      },
      {
        card_id: 'c-2',
        front: 'lopen',
        back: 'to walk',
        insights: [
          { type: 'verb_forms', content: 'liep, gelopen', status: 'pending' },
          { type: 'root', content: 'speculation', status: 'pending' },
        ],
      },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    // Mock validation response (without leading [ due to assistant prefill)
    const validationResponse = [
      {
        card_id: 'c-1',
        insights: [{ index: 0, approved: true }],
      },
      {
        card_id: 'c-2',
        insights: [
          { index: 0, approved: true },
          { index: 1, approved: false, reason: 'Speculative etymology' },
        ],
      },
    ]
    const responseWithoutBracket = JSON.stringify(validationResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: responseWithoutBracket }],
        })
      ),
    })

    mockBulkUpdateInsightsStatus.mockResolvedValue({})
    mockDeleteInsight.mockResolvedValue({})

    const event = createEvent({ card_ids: ['c-1', 'c-2'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.validated).toHaveLength(2)
    expect(body.validated[0].card_id).toBe('c-1')
    expect(body.validated[0].approved).toBe(1)
    expect(body.validated[0].deleted).toBe(0)
    expect(body.validated[1].card_id).toBe('c-2')
    expect(body.validated[1].approved).toBe(1)
    expect(body.validated[1].deleted).toBe(1)

    // Verify bulkUpdateInsightsStatus was called for approved insights only
    expect(mockBulkUpdateInsightsStatus).toHaveBeenCalledTimes(2)
    expect(mockBulkUpdateInsightsStatus).toHaveBeenCalledWith(
      'test-user-123',
      'c-2',
      [expect.objectContaining({ index: 0, status: 'approved' })]
    )

    // Verify deleteInsight was called for rejected insights
    expect(mockDeleteInsight).toHaveBeenCalledTimes(1)
    expect(mockDeleteInsight).toHaveBeenCalledWith('test-user-123', 'c-2', 1)
  })

  it('should handle markdown-wrapped JSON response', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'huis',
        back: 'house',
        insights: [
          { type: 'pronunciation', content: 'ui = ow', status: 'pending' },
        ],
      },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    const validationResponse = [
      { card_id: 'c-1', insights: [{ index: 0, approved: true }] },
    ]
    // Response without leading [ due to assistant prefill
    const responseWithoutBracket = JSON.stringify(validationResponse).slice(1)

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

    mockBulkUpdateInsightsStatus.mockResolvedValue({})

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.validated).toHaveLength(1)
  })

  it('should report failed card updates', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'test1',
        back: 'test1',
        insights: [{ type: 'root', content: 'test', status: 'pending' }],
      },
      {
        card_id: 'c-2',
        front: 'test2',
        back: 'test2',
        insights: [{ type: 'root', content: 'test', status: 'pending' }],
      },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    const validationResponse = [
      { card_id: 'c-1', insights: [{ index: 0, approved: true }] },
      { card_id: 'c-2', insights: [{ index: 0, approved: true }] },
    ]
    const responseWithoutBracket = JSON.stringify(validationResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: responseWithoutBracket }],
        })
      ),
    })

    // First card succeeds, second fails
    mockBulkUpdateInsightsStatus
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB error'))

    const event = createEvent({ card_ids: ['c-1', 'c-2'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.validated).toHaveLength(1)
    expect(body.failed).toContain('c-2')
  })

  it('should filter out non-pending insights', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'test',
        back: 'test',
        insights: [
          { type: 'compound', content: 'already approved', status: 'approved' },
          { type: 'root', content: 'needs validation', status: 'pending' },
        ],
      },
    ]

    mockGetCardsByIds.mockResolvedValue(cards)

    const validationResponse = [
      { card_id: 'c-1', insights: [{ index: 1, approved: true }] },
    ]
    const responseWithoutBracket = JSON.stringify(validationResponse).slice(1)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: responseWithoutBracket }],
        })
      ),
    })

    mockBulkUpdateInsightsStatus.mockResolvedValue({})

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    // Verify only pending insight was validated
    const body = JSON.parse(result.body as string)
    expect(body.validated[0].approved).toBe(1)
  })

  it('should return 500 on invalid JSON response from model', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'test',
        back: 'test',
        insights: [{ type: 'root', content: 'test', status: 'pending' }],
      },
    ]
    mockGetCardsByIds.mockResolvedValue(cards)

    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          content: [{ type: 'text', text: 'Not valid JSON' }],
        })
      ),
    })

    const event = createEvent({ card_ids: ['c-1'] })
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })
})
