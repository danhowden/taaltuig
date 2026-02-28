import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * POST /api/debug/clear-insights
 *
 * Clear all AI-generated insights from cards and review items
 * This is a destructive operation for testing/development purposes
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const result = await dbClient.clearAllInsights(userId)

    return jsonResponse({
      message: 'All insights cleared successfully',
      cleared_cards: result.clearedCards,
      cleared_review_items: result.clearedReviewItems,
    })
  } catch (error) {
    console.error('Error in clearInsights:', error)
    return serverErrorResponse()
  }
}
