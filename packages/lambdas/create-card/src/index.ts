import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  missingBodyResponse,
  invalidJsonResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
  mapCardToResponse,
  sanitizeText,
  sanitizeTags,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * POST /api/cards
 *
 * Create a new flashcard with bidirectional review items
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const parsed = parseJsonBody(event)
    if (parsed.error === 'MISSING_BODY') return missingBodyResponse()
    if (parsed.error === 'INVALID_JSON') return invalidJsonResponse()

    const { front, back, explanation, tags, source, category } =
      parsed.data as {
        front?: string
        back?: string
        explanation?: string
        tags?: string[]
        source?: string
        category?: string
      }

    // Sanitize inputs to prevent XSS
    const sanitizedFront = sanitizeText(front)
    const sanitizedBack = sanitizeText(back)
    const sanitizedExplanation = sanitizeText(explanation)
    const sanitizedTags = sanitizeTags(tags)
    const sanitizedCategory = sanitizeText(category)

    // Validate required fields
    if (!sanitizedFront || !sanitizedBack) {
      return badRequestResponse(
        'front and back are required',
        'VALIDATION_ERROR'
      )
    }

    // Create card and review items
    const result = await dbClient.createCard(
      userId,
      sanitizedFront,
      sanitizedBack,
      sanitizedExplanation,
      sanitizedTags,
      source || 'manual',
      sanitizedCategory
    )

    return jsonResponse({ card: mapCardToResponse(result.card) }, 201)
  } catch (error) {
    console.error('Error in createCard:', error)
    return serverErrorResponse()
  }
}
