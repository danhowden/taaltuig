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
 * POST /api/debug/reset-daily-reviews
 *
 * Reset today's review history (for testing purposes)
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Delete today's review history
    const deletedCount = await dbClient.resetDailyReviews(userId)

    return jsonResponse({
      message: 'Daily reviews reset successfully',
      deleted_count: deletedCount,
    })
  } catch (error) {
    console.error('Error in resetDailyReviews:', error)
    return serverErrorResponse()
  }
}
