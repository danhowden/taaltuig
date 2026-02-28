import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  missingBodyResponse,
  invalidJsonResponse,
  badRequestResponse,
  notFoundResponse,
  serverErrorResponse,
  jsonResponse,
  mapCardToResponse,
  sanitizeText,
  sanitizeTags,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * PUT /api/cards/{card_id}
 *
 * Update an existing card
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

    const parsed = parseJsonBody(event)
    if (parsed.error === 'MISSING_BODY') return missingBodyResponse()
    if (parsed.error === 'INVALID_JSON') return invalidJsonResponse()

    const body = parsed.data as Record<string, unknown>

    // Sanitize inputs to prevent XSS
    const sanitizedBody: Record<string, unknown> = {}
    if ('front' in body) sanitizedBody.front = sanitizeText(body.front as string)
    if ('back' in body) sanitizedBody.back = sanitizeText(body.back as string)
    if ('explanation' in body) sanitizedBody.explanation = sanitizeText(body.explanation as string)
    if ('tags' in body) sanitizedBody.tags = sanitizeTags(body.tags as string[])
    if ('category' in body) sanitizedBody.category = sanitizeText(body.category as string)

    // Check if card exists and belongs to user
    const existingCard = await dbClient.getCard(userId, cardId)
    if (!existingCard) {
      return notFoundResponse('Card not found')
    }

    // Update card
    const updatedCard = await dbClient.updateCard(userId, cardId, sanitizedBody)

    return jsonResponse({ card: mapCardToResponse(updatedCard) })
  } catch (error) {
    console.error('Error in updateCard:', error)
    return serverErrorResponse()
  }
}
