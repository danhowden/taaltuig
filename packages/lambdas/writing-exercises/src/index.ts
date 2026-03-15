import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * GET /api/writing/exercises — list exercises
 * DELETE /api/writing/exercises — clear incomplete exercises
 * PUT /api/writing/exercises — reject an exercise with a reason
 * PATCH /api/writing/exercises — reset an exercise back to pending
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

    if (method === 'PATCH') {
      const parsed = parseJsonBody(event)
      if (parsed.error) {
        return badRequestResponse('Invalid request body')
      }

      const { exercise_id } = parsed.data as { exercise_id?: string }
      if (!exercise_id) {
        return badRequestResponse('Missing required field: exercise_id')
      }

      await dbClient.resetExercise(userId, exercise_id)
      return jsonResponse({ message: 'Exercise reset to pending', exercise_id })
    }

    if (method === 'PUT') {
      const parsed = parseJsonBody(event)
      if (parsed.error) {
        return badRequestResponse('Invalid request body')
      }

      const { exercise_id, reason } = parsed.data as { exercise_id?: string; reason?: string }
      if (!exercise_id || !reason) {
        return badRequestResponse('Missing required fields: exercise_id, reason')
      }

      await dbClient.rejectExercise(userId, exercise_id, reason)
      return jsonResponse({ message: 'Exercise rejected', exercise_id })
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
