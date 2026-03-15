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
 * GET /api/writing/exercises — list exercises
 * DELETE /api/writing/exercises — clear incomplete exercises
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const method = event.requestContext?.http?.method

    if (method === 'DELETE') {
      const result = await dbClient.clearIncompleteExercises(userId)
      return jsonResponse({
        message: 'Incomplete exercises cleared',
        deleted: result.deleted,
      })
    }

    // GET
    const cardId = event.queryStringParameters?.card_id

    if (cardId) {
      const links = await dbClient.getExercisesForCard(userId, cardId)
      return jsonResponse(links)
    }

    const exercises = await dbClient.getAllExercises(userId)
    return jsonResponse(exercises)
  } catch (error) {
    console.error('Error in writingExercises:', error)
    return serverErrorResponse()
  }
}
