import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const cloudWatchClient = new CloudWatchClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const NAMESPACE = 'Taaltuig/Insights'
const METRICS = ['InsightsApproved', 'InsightsRejected', 'CardsProcessed']

interface MetricDatapoint {
  timestamp: string
  approved: number
  rejected: number
  cardsProcessed: number
}

interface MetricsResponse {
  period: 'hour' | 'day' | 'week'
  datapoints: MetricDatapoint[]
  totals: {
    approved: number
    rejected: number
    cardsProcessed: number
    approvalRate: number
  }
}

/**
 * GET /api/metrics/insights
 *
 * Query CloudWatch metrics for insights validation
 * Query params:
 *   - period: 'hour' | 'day' | 'week' (default: 'day')
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Parse query parameters
    const period = (event.queryStringParameters?.period || 'day') as
      | 'hour'
      | 'day'
      | 'week'

    if (!['hour', 'day', 'week'].includes(period)) {
      return badRequestResponse(
        'Invalid period. Must be hour, day, or week',
        'VALIDATION_ERROR'
      )
    }

    // Calculate time range and period seconds
    const endTime = new Date()
    let startTime: Date
    let periodSeconds: number

    switch (period) {
      case 'hour':
        startTime = new Date(endTime.getTime() - 60 * 60 * 1000) // 1 hour ago
        periodSeconds = 60 // 1-minute intervals
        break
      case 'day':
        startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
        periodSeconds = 3600 // 1-hour intervals
        break
      case 'week':
        startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        periodSeconds = 86400 // 1-day intervals
        break
    }

    // Fetch all metrics in parallel
    const metricPromises = METRICS.map((metricName) =>
      cloudWatchClient.send(
        new GetMetricStatisticsCommand({
          Namespace: NAMESPACE,
          MetricName: metricName,
          StartTime: startTime,
          EndTime: endTime,
          Period: periodSeconds,
          Statistics: ['Sum'],
        })
      )
    )

    const [approvedResult, rejectedResult, cardsResult] =
      await Promise.all(metricPromises)

    // Create a map of timestamps to datapoints
    const datapointMap = new Map<string, MetricDatapoint>()

    // Process approved metrics
    for (const dp of approvedResult.Datapoints || []) {
      if (dp.Timestamp) {
        const ts = dp.Timestamp.toISOString()
        const existing = datapointMap.get(ts) || {
          timestamp: ts,
          approved: 0,
          rejected: 0,
          cardsProcessed: 0,
        }
        existing.approved = dp.Sum || 0
        datapointMap.set(ts, existing)
      }
    }

    // Process rejected metrics
    for (const dp of rejectedResult.Datapoints || []) {
      if (dp.Timestamp) {
        const ts = dp.Timestamp.toISOString()
        const existing = datapointMap.get(ts) || {
          timestamp: ts,
          approved: 0,
          rejected: 0,
          cardsProcessed: 0,
        }
        existing.rejected = dp.Sum || 0
        datapointMap.set(ts, existing)
      }
    }

    // Process cards processed metrics
    for (const dp of cardsResult.Datapoints || []) {
      if (dp.Timestamp) {
        const ts = dp.Timestamp.toISOString()
        const existing = datapointMap.get(ts) || {
          timestamp: ts,
          approved: 0,
          rejected: 0,
          cardsProcessed: 0,
        }
        existing.cardsProcessed = dp.Sum || 0
        datapointMap.set(ts, existing)
      }
    }

    // Sort datapoints by timestamp
    const datapoints = Array.from(datapointMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Calculate totals
    const totals = datapoints.reduce(
      (acc, dp) => ({
        approved: acc.approved + dp.approved,
        rejected: acc.rejected + dp.rejected,
        cardsProcessed: acc.cardsProcessed + dp.cardsProcessed,
        approvalRate: 0,
      }),
      { approved: 0, rejected: 0, cardsProcessed: 0, approvalRate: 0 }
    )

    // Calculate approval rate
    const totalInsights = totals.approved + totals.rejected
    totals.approvalRate = totalInsights > 0 ? totals.approved / totalInsights : 0

    const response: MetricsResponse = {
      period,
      datapoints,
      totals,
    }

    return jsonResponse(response)
  } catch (error) {
    console.error('Error in getMetrics:', error)
    return serverErrorResponse(error, true)
  }
}
