import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
  mapCardToResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

// Valid insight status values
const VALID_INSIGHT_STATUSES = ['none', 'pending', 'approved', 'rejected', 'any'] as const
type InsightStatusFilter = (typeof VALID_INSIGHT_STATUSES)[number]

/**
 * GET /api/cards
 *
 * List cards for the authenticated user with optional pagination and filtering
 *
 * Query Parameters:
 * - limit: Number of cards per page (default 50, max 200)
 * - cursor: Base64-encoded pagination cursor
 * - category: Filter by category
 * - insight_status: Filter by insight status (none|pending|approved|rejected|any)
 * - search: Search text in front/back/explanation
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {}

    // Parse limit (default 50, max 200)
    let limit = 50
    if (queryParams.limit) {
      const parsedLimit = parseInt(queryParams.limit, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 200)
      }
    }

    // Parse cursor
    const cursor = queryParams.cursor || undefined

    // Parse category filter
    const category = queryParams.category || undefined

    // Parse insight_status filter
    let insightStatus: InsightStatusFilter | undefined
    if (queryParams.insight_status) {
      const status = queryParams.insight_status as InsightStatusFilter
      if (VALID_INSIGHT_STATUSES.includes(status)) {
        insightStatus = status
      }
    }

    // Parse search query
    const search = queryParams.search || undefined

    // Check if any pagination/filter params are present
    const hasPaginationParams = cursor || category || insightStatus || search || queryParams.limit

    if (hasPaginationParams) {
      // Use paginated query
      const result = await dbClient.listCardsPaginated(userId, {
        limit,
        cursor,
        category,
        insightStatus,
        search,
      })

      return jsonResponse({
        cards: result.cards.map(mapCardToResponse),
        pagination: {
          cursor: result.cursor,
          hasMore: result.hasMore,
          pageSize: limit,
        },
      })
    } else {
      // Legacy behavior: return all cards (for backwards compatibility)
      const cards = await dbClient.listCards(userId)
      return jsonResponse({ cards: cards.map(mapCardToResponse) })
    }
  } catch (error) {
    console.error('Error in listCards:', error)
    return serverErrorResponse()
  }
}
