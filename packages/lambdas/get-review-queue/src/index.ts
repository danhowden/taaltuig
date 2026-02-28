import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient, ReviewItem } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * Map ReviewItem to API response format
 */
function mapReviewItemToResponse(item: ReviewItem) {
  return {
    id: item.review_item_id,
    review_item_id: item.review_item_id,
    card_id: item.card_id,
    user_id: item.user_id,
    direction: item.direction,
    state: item.state,
    interval: item.interval,
    ease_factor: item.ease_factor,
    repetitions: item.repetitions,
    step_index: item.step_index,
    due_date: item.due_date,
    last_reviewed: item.last_reviewed,
    created_at: item.created_at,
    front: item.front,
    back: item.back,
    explanation: item.explanation,
    category: item.category,
    insights: item.insights,
  }
}

/**
 * GET /api/reviews/queue
 * GET /api/reviews/queue?all=true
 *
 * Fetch daily review queue (due items + new cards up to daily limit)
 * Or fetch ALL review items with ?all=true flag
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Check if all flag is set
    const showAll = event.queryStringParameters?.all === 'true'

    // Check for extra_new parameter (for "continue session" feature)
    const extraNewParam = event.queryStringParameters?.extra_new
    const extraNew = extraNewParam ? parseInt(extraNewParam, 10) : 0

    if (showAll) {
      // Get ALL review items (for debug purposes)
      const allItems = await dbClient.listAllReviewItems(userId)
      const queueResponse = allItems.map(mapReviewItemToResponse)

      // Calculate stats for all items
      const now = new Date().toISOString()
      const dueCount = allItems.filter(item =>
        (item.state === 'LEARNING' || item.state === 'REVIEW' || item.state === 'RELEARNING') &&
        item.due_date <= now
      ).length
      const newCount = allItems.filter(item => item.state === 'NEW').length
      const learningCount = allItems.filter(item =>
        item.state === 'LEARNING' || item.state === 'RELEARNING'
      ).length

      return jsonResponse({
        queue: queueResponse,
        stats: {
          due_count: dueCount,
          new_count: newCount,
          learning_count: learningCount,
          total_count: allItems.length,
          new_remaining_today: 0, // Not applicable when showing all
        },
      })
    }

    // Get review queue from DynamoDB (normal mode)
    const result = await dbClient.getReviewQueue(userId, { extraNew })
    const queueResponse = result.queue.map(mapReviewItemToResponse)

    return jsonResponse({
      queue: queueResponse,
      stats: result.stats,
    })
  } catch (error) {
    console.error('Error in getReviewQueue:', error)
    return serverErrorResponse()
  }
}
