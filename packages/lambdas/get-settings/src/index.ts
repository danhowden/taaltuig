import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * GET /api/settings
 *
 * Get user SRS configuration parameters
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Get settings from DynamoDB
    let settings = await dbClient.getSettings(userId)

    // If settings don't exist, create default settings
    if (!settings) {
      settings = await dbClient.createDefaultSettings(userId)
    }

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
    console.error('Error in getSettings:', error)
    return serverErrorResponse()
  }
}
