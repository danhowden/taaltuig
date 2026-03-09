import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient, type ExerciseType } from '@taaltuig/dynamodb-client'
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
      exercise_type,
      user_answer,
      reference_answer,
      alternatives,
      duration_ms,
      card_id,
    } = parsed.data as {
      exercise_id: string
      exercise_type: ExerciseType
      user_answer: string
      reference_answer: string
      alternatives?: string[]
      duration_ms: number
      card_id?: string
    }

    // Validate required fields
    if (!exercise_id || !exercise_type || user_answer === undefined || !reference_answer) {
      return badRequestResponse(
        'Missing required fields: exercise_id, exercise_type, user_answer, reference_answer',
        'MISSING_FIELDS'
      )
    }

    if (!VALID_EXERCISE_TYPES.includes(exercise_type)) {
      return badRequestResponse(
        `Invalid exercise_type. Must be one of: ${VALID_EXERCISE_TYPES.join(', ')}`,
        'INVALID_EXERCISE_TYPE'
      )
    }

    if (typeof duration_ms !== 'number' || duration_ms < 0) {
      return badRequestResponse('duration_ms must be >= 0', 'INVALID_DURATION')
    }

    // Create the attempt (assessment happens inside createWritingAttempt)
    const attempt = await dbClient.createWritingAttempt(
      userId,
      exercise_id,
      exercise_type,
      user_answer,
      reference_answer,
      alternatives || [],
      duration_ms,
      card_id
    )

    return jsonResponse({
      correct: attempt.score > 0,
      grade: attempt.score,
      feedback: attempt.feedback,
      match_type: attempt.match_type,
      reference_answer,
    })
  } catch (error) {
    console.error('Error in writingSubmit:', error)
    return serverErrorResponse()
  }
}
