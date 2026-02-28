import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  TaaltuigDynamoDBClient,
  SM2Scheduler,
  type Grade,
} from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  missingBodyResponse,
  invalidJsonResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)
const scheduler = new SM2Scheduler()

/**
 * POST /api/reviews/submit
 *
 * Submit review grade and update scheduling state using SM-2 algorithm
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

    const { review_item_id, grade, duration_ms } = parsed.data as {
      review_item_id: string
      grade: number
      duration_ms: number
    }

    // Validate grade
    if (![0, 2, 3, 4].includes(grade)) {
      return badRequestResponse(
        'Invalid grade. Must be 0, 2, 3, or 4',
        'INVALID_GRADE'
      )
    }

    // Validate duration
    if (typeof duration_ms !== 'number' || duration_ms < 0) {
      return badRequestResponse('duration_ms must be >= 0', 'INVALID_DURATION')
    }

    // Get review item from DynamoDB
    const reviewItem = await dbClient.getReviewItem(userId, review_item_id)
    if (!reviewItem) {
      return notFoundResponse('Review item not found')
    }

    // Verify ownership
    if (reviewItem.user_id !== userId) {
      return forbiddenResponse()
    }

    // Get user settings
    const settings = await dbClient.getSettings(userId)
    if (!settings) {
      return serverErrorResponse()
    }

    // Calculate next review state using SM-2
    const result = scheduler.schedule(
      reviewItem,
      grade as Grade,
      settings,
      new Date()
    )

    // Update review item in DynamoDB
    await dbClient.updateReviewItem(userId, review_item_id, {
      state: result.state,
      interval: result.interval,
      ease_factor: result.ease_factor,
      repetitions: result.repetitions,
      step_index: result.step_index,
      due_date: result.due_date,
      last_reviewed: new Date().toISOString(),
    })

    // Create review history record
    await dbClient.createReviewHistory(
      userId,
      review_item_id,
      grade as Grade,
      duration_ms,
      reviewItem.state,
      result.state,
      reviewItem.interval,
      result.interval,
      reviewItem.ease_factor,
      result.ease_factor
    )

    return jsonResponse({
      next_review: result.due_date,
      interval_days: result.interval,
      state: result.state,
    })
  } catch (error) {
    console.error('Error in submitReview:', error)
    return serverErrorResponse()
  }
}
