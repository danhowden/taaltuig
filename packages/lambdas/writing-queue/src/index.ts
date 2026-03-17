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

const lambdaClient = new LambdaClient({})

async function triggerGenerationIfNeeded(userId: string, poolCount: number): Promise<void> {
  const generateFn = process.env.GENERATE_FUNCTION_NAME
  if (!generateFn || poolCount >= POOL_LOW_THRESHOLD) return
  await lambdaClient.send(new InvokeCommand({
    FunctionName: generateFn,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify({ userId })),
  }))
}

const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * GET /api/writing/queue
 *
 * Two modes:
 * - ?mode=count — lightweight stats only (for sidebar badge). No serving, no generation trigger.
 * - No mode param — full queue: fetches exercises, marks as served, triggers generation if low.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const mode = event.queryStringParameters?.mode

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

    // Count mode: return stats only — no side effects
    if (mode === 'count') {
      return jsonResponse({
        exercises: [],
        stats: {
          total_available: poolCount,
          exercises_today: attemptsToday,
          exercises_remaining: remaining,
          pool_size: poolCount,
          can_complete_more: poolCount > 0 && remaining > 0,
        },
      })
    }

    if (remaining === 0) {
      return jsonResponse({
        exercises: [],
        stats: { total_available: poolCount, exercises_today: attemptsToday, exercises_remaining: 0, pool_size: poolCount },
      })
    }

    // If pool is empty, kick off generation immediately (fire-and-forget)
    if (poolCount === 0) {
      triggerGenerationIfNeeded(userId, 0).catch(() => {})
    }

    // Fetch exercises from pool (handles priority shuffling internally)
    const exercises = await dbClient.getExercisePool(userId, remaining)

    // Fire-and-forget generation if pool is running low
    triggerGenerationIfNeeded(userId, poolCount).catch(() => {})

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
