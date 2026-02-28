import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient, InsightStatus } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

type StatusFilter = InsightStatus | 'ai_approved' | 'all'

/**
 * GET /api/insights/queue
 *
 * Get cards needing human review of their insights
 *
 * Query params:
 * - status: 'pending' | 'ai_approved' | 'all' (default: returns cards needing review)
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Parse query params
    const statusParam = event.queryStringParameters?.status as
      | StatusFilter
      | undefined

    // Get cards with insights for review
    const cards = await dbClient.getCardsWithInsightsForReview(
      userId,
      statusParam
    )

    // Map to response format
    const queueItems = cards.map((card) => ({
      card_id: card.card_id,
      front: card.front,
      back: card.back,
      category: card.category,
      insights: card.insights || [],
    }))

    return jsonResponse({
      cards: queueItems,
      total: queueItems.length,
    })
  } catch (error) {
    console.error('Error in getInsightsQueue:', error)
    return serverErrorResponse()
  }
}
