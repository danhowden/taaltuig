import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient, type ExerciseType } from '@taaltuig/dynamodb-client'
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
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'translation',
  'fill_blank',
  'word_reorder',
  'guided_write',
  'paragraph_write',
]

/**
 * POST /api/writing/submit
 *
 * Submit a writing exercise answer for assessment.
 * Looks up the exercise from DynamoDB for the reference answer (server-side validation).
 * Returns the assessment result with feedback.
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

    const {
      exercise_id,
      user_answer,
      duration_ms,
    } = parsed.data as {
      exercise_id: string
      user_answer: string
      duration_ms: number
    }

    // Validate required fields
    if (!exercise_id || user_answer === undefined) {
      return badRequestResponse(
        'Missing required fields: exercise_id, user_answer',
        'MISSING_FIELDS'
      )
    }

    if (typeof duration_ms !== 'number' || duration_ms < 0) {
      return badRequestResponse('duration_ms must be >= 0', 'INVALID_DURATION')
    }

    // Look up the exercise from DynamoDB (server-side reference answer)
    const exercise = await dbClient.getExercise(userId, exercise_id)
    if (!exercise) {
      return notFoundResponse('Exercise not found')
    }

    if (!VALID_EXERCISE_TYPES.includes(exercise.type)) {
      return badRequestResponse(
        `Invalid exercise_type. Must be one of: ${VALID_EXERCISE_TYPES.join(', ')}`,
        'INVALID_EXERCISE_TYPE'
      )
    }

    // Create the attempt (assessment happens inside createWritingAttempt)
    const attempt = await dbClient.createWritingAttempt(
      userId,
      exercise.exercise_id,
      exercise.type,
      user_answer,
      exercise.reference_answer,
      exercise.alternatives,
      duration_ms
    )

    // Mark exercise as completed
    await dbClient.markExerciseCompleted(userId, exercise_id)

    return jsonResponse({
      correct: attempt.score > 0,
      grade: attempt.score,
      feedback: attempt.feedback,
      match_type: attempt.match_type,
      reference_answer: exercise.reference_answer,
    })
  } catch (error) {
    console.error('Error in writingSubmit:', error)
    return serverErrorResponse()
  }
}
