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
 * PUT /api/settings
 *
 * Update user SRS configuration (partial updates supported)
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

    const body = parsed.data as Record<string, unknown>

    // Validate fields
    if (
      body.new_cards_per_day !== undefined &&
      ((body.new_cards_per_day as number) < 0 ||
        (body.new_cards_per_day as number) > 100)
    ) {
      return badRequestResponse(
        'new_cards_per_day must be between 0 and 100',
        'VALIDATION_ERROR',
        { field: 'new_cards_per_day', value: body.new_cards_per_day }
      )
    }

    if (
      body.starting_ease !== undefined &&
      (body.starting_ease as number) < 1.3
    ) {
      return badRequestResponse(
        'starting_ease must be >= 1.3',
        'VALIDATION_ERROR',
        { field: 'starting_ease', value: body.starting_ease }
      )
    }

    // Update settings in DynamoDB
    const settings = await dbClient.updateSettings(userId, body)

    // Convert to API response format
    const settingsResponse = {
      user_id: settings.user_id,
      new_cards_per_day: settings.new_cards_per_day,
      max_reviews_per_day: settings.max_reviews_per_day,
      learning_steps: settings.learning_steps,
      relearning_steps: settings.relearning_steps,
      graduating_interval: settings.graduating_interval,
      easy_interval: settings.easy_interval,
      starting_ease: settings.starting_ease,
      easy_bonus: settings.easy_bonus,
      interval_modifier: settings.interval_modifier,
      disabled_categories: settings.disabled_categories,
      updated_at: settings.updated_at,
    }

    return jsonResponse({ settings: settingsResponse })
  } catch (error) {
    console.error('Error in updateSettings:', error)
    return serverErrorResponse()
  }
}
