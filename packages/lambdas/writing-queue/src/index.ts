import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const POOL_LOW_THRESHOLD = 20

const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)
const lambdaClient = new LambdaClient({})

/**
 * Trigger exercise generation asynchronously when pool is low.
 */
async function triggerGenerationIfNeeded(userId: string, poolCount: number): Promise<void> {
  const generateFunctionName = process.env.GENERATE_FUNCTION_NAME
  if (!generateFunctionName || poolCount >= POOL_LOW_THRESHOLD) return

  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: generateFunctionName,
        InvocationType: 'Event', // async — fire and forget
        Payload: new TextEncoder().encode(
          JSON.stringify({
            requestContext: {
              authorizer: {
                jwt: { claims: { sub: userId } },
              },
            },
            body: '{}',
          })
        ),
      })
    )
    console.log(`Triggered exercise generation for user ${userId} (pool: ${poolCount})`)
  } catch (error) {
    // Don't fail the queue request if generation trigger fails
    console.error('Failed to trigger exercise generation:', error)
  }
}

/**
 * GET /api/writing/queue
 *
 * Serve writing exercises from the stored exercise pool.
 * Triggers background generation when pool is low.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const [settings, attemptsToday, poolCount] = await Promise.all([
      dbClient.getSettings(userId),
      dbClient.countWritingAttemptsToday(userId),
      dbClient.getExercisePoolCount(userId),
    ])

    if (!settings || settings.writing_session_enabled === false) {
      return jsonResponse({
        exercises: [],
        stats: { total_available: 0, exercises_today: attemptsToday, exercises_remaining: 0, pool_size: poolCount },
      })
    }

    const dailyLimit = settings.writing_exercises_per_day ?? 10
    const remaining = Math.max(0, dailyLimit - attemptsToday)

    // Trigger generation if pool is low
    await triggerGenerationIfNeeded(userId, poolCount)

    if (remaining === 0) {
      return jsonResponse({
        exercises: [],
        stats: { total_available: poolCount, exercises_today: attemptsToday, exercises_remaining: 0, pool_size: poolCount },
      })
    }

    // Fetch exercises from pool (handles priority shuffling internally)
    const exercises = await dbClient.getExercisePool(userId, remaining)

    // Mark them as served
    if (exercises.length > 0) {
      await dbClient.markExercisesServed(userId, exercises.map((e) => e.exercise_id))
    }

    return jsonResponse({
      exercises: exercises.map((e) => ({
        exercise_id: e.exercise_id,
        type: e.type,
        prompt: e.prompt,
        reference_answer: e.reference_answer,
        alternatives: e.alternatives,
        grammar_focus: e.grammar_focus,
        target_vocabulary: e.target_vocabulary,
      })),
      stats: {
        total_available: poolCount,
        exercises_today: attemptsToday,
        exercises_remaining: remaining,
        pool_size: poolCount,
        can_complete_more: poolCount > exercises.length,
      },
    })
  } catch (error) {
    console.error('Error in writingQueue:', error)
    return serverErrorResponse()
  }
}
