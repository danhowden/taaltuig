import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockSend = vi.fn()

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetMetricStatisticsCommand: vi.fn().mockImplementation((input) => input),
}))

// Import handler AFTER mocking
const { handler } = await import('./index')

describe('get-metrics Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('should return 400 for invalid period', async () => {
    const event = createEvent({ period: 'month' })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.body as string)
    expect(body.error).toContain('Invalid period')
  })

  it('should default to day period when not specified', async () => {
    mockSend.mockResolvedValue({ Datapoints: [] })

    const event = createEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.period).toBe('day')
  })

  it('should return metrics for hour period', async () => {
    mockSend.mockResolvedValue({ Datapoints: [] })

    const event = createEvent({ period: 'hour' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.period).toBe('hour')
  })

  it('should return metrics for week period', async () => {
    mockSend.mockResolvedValue({ Datapoints: [] })

    const event = createEvent({ period: 'week' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.period).toBe('week')
  })

  it('should merge datapoints from all six metrics', async () => {
    const ts = new Date('2024-01-15T12:00:00Z')

    // 6 metrics: InsightsApproved, InsightsRejected, CardsProcessed,
    //            InsightsGenerated, GenerationCardsProcessed, GenerationErrors
    mockSend
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 10 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 3 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 20 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 7 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 15 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: ts, Sum: 1 }] })

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)

    expect(body.datapoints).toHaveLength(1)
    expect(body.datapoints[0]).toEqual({
      timestamp: ts.toISOString(),
      approved: 10,
      rejected: 3,
      cardsProcessed: 20,
      generated: 7,
      generationCardsProcessed: 15,
      generationErrors: 1,
    })
  })

  it('should calculate totals correctly', async () => {
    const ts1 = new Date('2024-01-15T12:00:00Z')
    const ts2 = new Date('2024-01-15T13:00:00Z')

    // Validation metrics
    mockSend
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 10 },
          { Timestamp: ts2, Sum: 5 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 3 },
          { Timestamp: ts2, Sum: 2 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 20 },
          { Timestamp: ts2, Sum: 10 },
        ],
      })
      // Generation metrics
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 8 },
          { Timestamp: ts2, Sum: 4 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 18 },
          { Timestamp: ts2, Sum: 9 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 1 },
          { Timestamp: ts2, Sum: 0 },
        ],
      })

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    const body = JSON.parse(result.body as string)
    expect(body.totals.approved).toBe(15)
    expect(body.totals.rejected).toBe(5)
    expect(body.totals.cardsProcessed).toBe(30)
    expect(body.totals.approvalRate).toBe(0.75) // 15 / (15 + 5)
    expect(body.totals.generated).toBe(12)
    expect(body.totals.generationCardsProcessed).toBe(27)
    expect(body.totals.generationErrors).toBe(1)
  })

  it('should handle approval rate when no insights exist', async () => {
    mockSend.mockResolvedValue({ Datapoints: [] })

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    const body = JSON.parse(result.body as string)
    expect(body.totals.approvalRate).toBe(0)
  })

  it('should sort datapoints by timestamp', async () => {
    const ts1 = new Date('2024-01-15T14:00:00Z')
    const ts2 = new Date('2024-01-15T12:00:00Z')

    // Return out-of-order timestamps for first metric, empty for rest
    mockSend
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: ts1, Sum: 5 },
          { Timestamp: ts2, Sum: 10 },
        ],
      })
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [] })

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    const body = JSON.parse(result.body as string)
    expect(body.datapoints[0].timestamp).toBe(ts2.toISOString())
    expect(body.datapoints[1].timestamp).toBe(ts1.toISOString())
  })

  it('should handle missing Datapoints arrays', async () => {
    mockSend.mockResolvedValue({})

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.datapoints).toEqual([])
  })

  it('should return 500 on CloudWatch error', async () => {
    mockSend.mockRejectedValue(new Error('CloudWatch error'))

    const event = createEvent({ period: 'day' })
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })

  it('should fetch all six metrics in parallel', async () => {
    mockSend.mockResolvedValue({ Datapoints: [] })

    const event = createEvent({ period: 'day' })
    await handler(event)

    expect(mockSend).toHaveBeenCalledTimes(6)

    // Verify metric names: 3 validation + 3 generation
    const calls = mockSend.mock.calls
    expect(calls[0][0].MetricName).toBe('InsightsApproved')
    expect(calls[1][0].MetricName).toBe('InsightsRejected')
    expect(calls[2][0].MetricName).toBe('CardsProcessed')
    expect(calls[3][0].MetricName).toBe('InsightsGenerated')
    expect(calls[4][0].MetricName).toBe('GenerationCardsProcessed')
    expect(calls[5][0].MetricName).toBe('GenerationErrors')
  })
})
