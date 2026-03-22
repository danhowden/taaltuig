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

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Run all count queries in parallel — much faster than 4 separate API calls
    const [cardCount, reviewStats, insightsCards, writingStats] =
      await Promise.all([
        dbClient.countCards(userId),
        dbClient.getReviewQueueStats(userId),
        dbClient.getCardsWithInsightsForReview(userId),
        getWritingCounts(userId),
      ])

    return jsonResponse({
      cards: cardCount,
      review: reviewStats.total_count,
      insights: insightsCards.length,
      writing: writingStats.poolSize,
    })
  } catch (error) {
    console.error('Error in sidebarCounts:', error)
    return serverErrorResponse()
  }
}

async function getWritingCounts(userId: string): Promise<{ poolSize: number }> {
  const settings = await dbClient.getSettings(userId)
  if (!settings || settings.writing_session_enabled === false) {
    return { poolSize: 0 }
  }
  const poolSize = await dbClient.getExercisePoolCount(userId)
  return { poolSize }
}
