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
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * PUT /api/categories/rename
 *
 * Rename a category across all cards, review items, and settings
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

    const { oldCategory, newCategory } = parsed.data as {
      oldCategory?: string
      newCategory?: string
    }

    // Validate required fields
    if (!oldCategory || !newCategory) {
      return badRequestResponse(
        'oldCategory and newCategory are required',
        'VALIDATION_ERROR'
      )
    }

    if (oldCategory === newCategory) {
      return badRequestResponse(
        'Old and new category names must be different',
        'VALIDATION_ERROR'
      )
    }

    // Rename category across all entities
    const result = await dbClient.renameCategory(userId, oldCategory, newCategory)

    return jsonResponse({
      success: true,
      cardsUpdated: result.cardsUpdated,
      reviewItemsUpdated: result.reviewItemsUpdated,
      settingsUpdated: result.settingsUpdated,
    })
  } catch (error) {
    console.error('Error in renameCategory:', error)
    return serverErrorResponse()
  }
}
