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
 * GET /api/writing/queue
 *
 * Fetch writing exercises for the current session.
 * Generates translation exercises from recently reviewed flashcards,
 * prioritizing cards the user found difficult.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const result = await dbClient.getWritingQueue(userId)

    return jsonResponse({
      exercises: result.exercises,
      stats: result.stats,
    })
  } catch (error) {
    console.error('Error in writingQueue:', error)
    return serverErrorResponse()
  }
}
