import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockGetCard = vi.fn()
const mockUpdateInsightStatus = vi.fn()
const mockDeleteInsight = vi.fn()

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    getCard: mockGetCard,
    updateInsightStatus: mockUpdateInsightStatus,
    deleteInsight: mockDeleteInsight,
  })),
}))

// Import handler AFTER mocking
const { handler } = await import('./index')

describe('review-insight Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const createEvent = (
    cardId: string,
    body: unknown,
    userId?: string
  ): APIGatewayProxyEventV2 =>
    ({
      body: JSON.stringify(body),
      pathParameters: { card_id: cardId },
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
      body: JSON.stringify({ insight_index: 0, action: 'approve' }),
      pathParameters: { card_id: 'c-1' },
      requestContext: { authorizer: {} },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
  })

  it('should return 400 when card_id is missing', async () => {
    const event = {
      body: JSON.stringify({ insight_index: 0, action: 'approve' }),
      pathParameters: {},
      requestContext: {
        authorizer: { jwt: { claims: { sub: 'test-user' } } },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('card_id')
  })

  it('should return 400 when body is missing', async () => {
    const event = {
      pathParameters: { card_id: 'c-1' },
      requestContext: {
        authorizer: { jwt: { claims: { sub: 'test-user' } } },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
  })

  it('should return 400 when insight_index is invalid', async () => {
    const event = createEvent('c-1', { insight_index: -1, action: 'approve' })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('insight_index')
  })

  it('should return 400 when action is invalid', async () => {
    const event = createEvent('c-1', { insight_index: 0, action: 'invalid' })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('action')
  })

  it('should return 400 when content is missing for edit action', async () => {
    const event = createEvent('c-1', { insight_index: 0, action: 'edit' })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body as string).error).toContain('content')
  })

  it('should return 404 when card not found', async () => {
    mockGetCard.mockResolvedValue(null)

    const event = createEvent('c-1', { insight_index: 0, action: 'approve' })
    const result = await handler(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body as string).error).toContain('Card')
  })

  it('should return 404 when insight index out of bounds', async () => {
    mockGetCard.mockResolvedValue({
      card_id: 'c-1',
      front: 'test',
      back: 'test',
      insights: [],
    })

    mockUpdateInsightStatus.mockRejectedValue(new Error('Insight not found'))

    const event = createEvent('c-1', { insight_index: 5, action: 'approve' })
    const result = await handler(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body as string).error).toContain('Insight')
  })

  it('should approve insight successfully', async () => {
    const card = {
      card_id: 'c-1',
      front: 'aardappel',
      back: 'potato',
      insights: [
        { type: 'compound', content: 'test', status: 'pending' },
      ],
    }

    mockGetCard.mockResolvedValue(card)

    const updatedCard = {
      ...card,
      insights: [
        {
          type: 'compound',
          content: 'test',
          status: 'approved',
          reviewed_by: 'human',
        },
      ],
    }
    mockUpdateInsightStatus.mockResolvedValue(updatedCard)

    const event = createEvent('c-1', { insight_index: 0, action: 'approve' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    const body = JSON.parse(result.body as string)
    expect(body.card).toBeDefined()
    expect(body.card.insights[0].status).toBe('approved')

    expect(mockUpdateInsightStatus).toHaveBeenCalledWith(
      'test-user-123',
      'c-1',
      0,
      expect.objectContaining({
        status: 'approved',
        reviewed_by: 'human',
      })
    )
  })

  it('should reject insight by deleting it', async () => {
    const card = {
      card_id: 'c-1',
      front: 'test',
      back: 'test',
      insights: [{ type: 'root', content: 'speculation', status: 'pending' }],
    }

    mockGetCard.mockResolvedValue(card)

    // After rejection, the insight is deleted so the array is empty
    const updatedCard = {
      ...card,
      insights: [],
    }
    mockDeleteInsight.mockResolvedValue(updatedCard)

    const event = createEvent('c-1', {
      insight_index: 0,
      action: 'reject',
    })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    expect(mockDeleteInsight).toHaveBeenCalledWith(
      'test-user-123',
      'c-1',
      0
    )
    // updateInsightStatus should NOT be called for reject
    expect(mockUpdateInsightStatus).not.toHaveBeenCalled()
  })

  it('should edit insight content', async () => {
    const card = {
      card_id: 'c-1',
      front: 'test',
      back: 'test',
      insights: [{ type: 'compound', content: 'original', status: 'pending' }],
    }

    mockGetCard.mockResolvedValue(card)

    const updatedCard = {
      ...card,
      insights: [
        {
          type: 'compound',
          content: 'edited content',
          status: 'approved',
          reviewed_by: 'human',
        },
      ],
    }
    mockUpdateInsightStatus.mockResolvedValue(updatedCard)

    const event = createEvent('c-1', {
      insight_index: 0,
      action: 'edit',
      content: 'edited content',
    })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)

    expect(mockUpdateInsightStatus).toHaveBeenCalledWith(
      'test-user-123',
      'c-1',
      0,
      expect.objectContaining({
        status: 'approved',
        reviewed_by: 'human',
        content: 'edited content',
      })
    )
  })
})
