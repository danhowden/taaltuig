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
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

interface ReviewInsightRequest {
  insight_index: number
  action: 'approve' | 'reject' | 'edit'
  content?: string // For edit action
}

/**
 * PUT /api/insights/{card_id}/review
 *
 * Human review of a single insight on a card
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Extract card_id from path parameters
    const cardId = event.pathParameters?.card_id
    if (!cardId) {
      return badRequestResponse('card_id is required', 'VALIDATION_ERROR')
    }

    const parsed = parseJsonBody(event)
    if (parsed.error === 'MISSING_BODY') return missingBodyResponse()
    if (parsed.error === 'INVALID_JSON') return invalidJsonResponse()

    const { insight_index, action, content } =
      parsed.data as ReviewInsightRequest

    // Validate required fields
    if (typeof insight_index !== 'number' || insight_index < 0) {
      return badRequestResponse(
        'insight_index must be a non-negative number',
        'VALIDATION_ERROR'
      )
    }

    if (!action || !['approve', 'reject', 'edit'].includes(action)) {
      return badRequestResponse(
        'action must be approve, reject, or edit',
        'VALIDATION_ERROR'
      )
    }

    if (action === 'edit' && !content) {
      return badRequestResponse(
        'content is required for edit action',
        'VALIDATION_ERROR'
      )
    }

    // Verify card exists and belongs to user
    const card = await dbClient.getCard(userId, cardId)
    if (!card) {
      return notFoundResponse('Card not found')
    }

    // Handle the action
    try {
      let updatedCard

      if (action === 'reject') {
        // Delete the insight entirely
        updatedCard = await dbClient.deleteInsight(userId, cardId, insight_index)
      } else {
        // Approve or edit - update the insight
        updatedCard = await dbClient.updateInsightStatus(
          userId,
          cardId,
          insight_index,
          {
            status: 'approved',
            reviewed_by: 'human',
            ...(action === 'edit' && content ? { content } : {}),
          }
        )
      }

      return jsonResponse({ card: mapCardToResponse(updatedCard) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message === 'Insight not found') {
        return notFoundResponse('Insight not found at specified index')
      }
      throw err
    }
  } catch (error) {
    console.error('Error in reviewInsight:', error)
    return serverErrorResponse()
  }
}
