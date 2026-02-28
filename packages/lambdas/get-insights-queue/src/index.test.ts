import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockGetCardsWithInsightsForReview = vi.fn()

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    getCardsWithInsightsForReview: mockGetCardsWithInsightsForReview,
  })),
}))

// Import handler AFTER mocking
const { handler } = await import('./index')

describe('get-insights-queue Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const createEvent = (
    queryParams?: Record<string, string>,
    userId?: string
  ): APIGatewayProxyEventV2 =>
    ({
      queryStringParameters: queryParams || {},
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
      queryStringParameters: {},
      requestContext: { authorizer: {} },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
  })

  it('should return empty queue when no cards need review', async () => {
    mockGetCardsWithInsightsForReview.mockResolvedValue([])

    const event = createEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.cards).toEqual([])
    expect(body.total).toBe(0)
  })

  it('should return cards needing review', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'aardappel',
        back: 'potato',
        category: 'Food',
        insights: [
          { type: 'compound', content: 'test', status: 'pending' },
        ],
      },
      {
        card_id: 'c-2',
        front: 'schrijven',
        back: 'to write',
        insights: [
          { type: 'verb_forms', content: 'schreef, geschreven', status: 'approved', reviewed_by: 'ai' },
        ],
      },
    ]

    mockGetCardsWithInsightsForReview.mockResolvedValue(cards)

    const event = createEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.cards).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.cards[0].card_id).toBe('c-1')
    expect(body.cards[0].front).toBe('aardappel')
    expect(body.cards[0].back).toBe('potato')
    expect(body.cards[0].category).toBe('Food')
    expect(body.cards[0].insights).toHaveLength(1)
  })

  it('should pass status filter to database query', async () => {
    mockGetCardsWithInsightsForReview.mockResolvedValue([])

    const event = createEvent({ status: 'pending' })
    await handler(event)

    expect(mockGetCardsWithInsightsForReview).toHaveBeenCalledWith(
      'test-user-123',
      'pending'
    )
  })

  it('should handle ai_approved filter', async () => {
    mockGetCardsWithInsightsForReview.mockResolvedValue([])

    const event = createEvent({ status: 'ai_approved' })
    await handler(event)

    expect(mockGetCardsWithInsightsForReview).toHaveBeenCalledWith(
      'test-user-123',
      'ai_approved'
    )
  })

  it('should handle all filter', async () => {
    mockGetCardsWithInsightsForReview.mockResolvedValue([])

    const event = createEvent({ status: 'all' })
    await handler(event)

    expect(mockGetCardsWithInsightsForReview).toHaveBeenCalledWith(
      'test-user-123',
      'all'
    )
  })

  it('should call without filter when status not provided', async () => {
    mockGetCardsWithInsightsForReview.mockResolvedValue([])

    const event = createEvent()
    await handler(event)

    expect(mockGetCardsWithInsightsForReview).toHaveBeenCalledWith(
      'test-user-123',
      undefined
    )
  })

  it('should handle cards without insights gracefully', async () => {
    const cards = [
      {
        card_id: 'c-1',
        front: 'test',
        back: 'test',
        // No insights field
      },
    ]

    mockGetCardsWithInsightsForReview.mockResolvedValue(cards)

    const event = createEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.cards[0].insights).toEqual([])
  })

  it('should return 500 on database error', async () => {
    mockGetCardsWithInsightsForReview.mockRejectedValue(new Error('DB error'))

    const event = createEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })
})
