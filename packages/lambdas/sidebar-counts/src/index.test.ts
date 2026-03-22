import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const mockCountCards = vi.fn()
const mockGetReviewQueueStats = vi.fn()
const mockGetCardsWithInsightsForReview = vi.fn()
const mockGetSettings = vi.fn()
const mockGetExercisePoolCount = vi.fn()

vi.mock('@taaltuig/dynamodb-client', () => ({
  TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
    countCards: mockCountCards,
    getReviewQueueStats: mockGetReviewQueueStats,
    getCardsWithInsightsForReview: mockGetCardsWithInsightsForReview,
    getSettings: mockGetSettings,
    getExercisePoolCount: mockGetExercisePoolCount,
  })),
}))

const { handler } = await import('./index')

function createEvent(sub?: string): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      authorizer: sub
        ? { jwt: { claims: { sub } } }
        : {},
    },
  } as unknown as APIGatewayProxyEventV2
}

describe('sidebar-counts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('should return 401 when unauthorized', async () => {
    const result = await handler(createEvent())
    expect(result.statusCode).toBe(401)
  })

  it('should return all counts in parallel', async () => {
    mockCountCards.mockResolvedValue(42)
    mockGetReviewQueueStats.mockResolvedValue({
      due_count: 5,
      new_count: 10,
      learning_count: 3,
      total_count: 18,
      new_remaining_today: 10,
    })
    mockGetCardsWithInsightsForReview.mockResolvedValue([
      { card_id: '1' },
      { card_id: '2' },
      { card_id: '3' },
    ])
    mockGetSettings.mockResolvedValue({
      writing_session_enabled: true,
      writing_exercises_per_day: 10,
    })
    mockGetExercisePoolCount.mockResolvedValue(7)

    const result = await handler(createEvent('user-123'))
    const body = JSON.parse(result.body as string)

    expect(result.statusCode).toBe(200)
    expect(body).toEqual({
      cards: 42,
      review: 18,
      insights: 3,
      writing: 7,
    })
  })

  it('should return 0 writing when disabled', async () => {
    mockCountCards.mockResolvedValue(10)
    mockGetReviewQueueStats.mockResolvedValue({ total_count: 5 })
    mockGetCardsWithInsightsForReview.mockResolvedValue([])
    mockGetSettings.mockResolvedValue({ writing_session_enabled: false })

    const result = await handler(createEvent('user-123'))
    const body = JSON.parse(result.body as string)

    expect(body.writing).toBe(0)
    expect(mockGetExercisePoolCount).not.toHaveBeenCalled()
  })

  it('should return 500 on error', async () => {
    mockCountCards.mockRejectedValue(new Error('DB error'))

    const result = await handler(createEvent('user-123'))
    expect(result.statusCode).toBe(500)
  })
})
