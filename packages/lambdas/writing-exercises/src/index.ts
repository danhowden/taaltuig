import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * GET /api/writing/exercises
 *
 * List exercises. Supports:
 * - ?card_id=<id> — exercises linked to a specific card
 * - No params — all exercises (for admin view)
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const cardId = event.queryStringParameters?.card_id

    if (cardId) {
      // Return card-exercise links for a specific card
      const links = await dbClient.getExercisesForCard(userId, cardId)
      return jsonResponse(links)
    }

    // Return all exercises (for admin view)
    const exercises = await dbClient.getAllExercises(userId)

    return jsonResponse(exercises)
  } catch (error) {
    console.error('Error in writingExercises:', error)
    return serverErrorResponse()
  }
}
