import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * DELETE /api/cards/{card_id}
 *
 * Delete a card and its associated review items
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const cardId = event.pathParameters?.card_id
    if (!cardId) {
      return badRequestResponse('card_id is required', 'MISSING_PARAMETER')
    }

    // Check if card exists and belongs to user
    const existingCard = await dbClient.getCard(userId, cardId)
    if (!existingCard) {
      return notFoundResponse('Card not found')
    }

    // Delete card and its review items
    await dbClient.deleteCard(userId, cardId)

    return {
      statusCode: 204,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }
  } catch (error) {
    console.error('Error in deleteCard:', error)
    return serverErrorResponse()
  }
}
