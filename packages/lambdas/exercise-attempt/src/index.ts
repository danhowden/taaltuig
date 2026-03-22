import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
  badRequestResponse,
} from '@taaltuig/lambda-utils'

const EXERCISE_PROGRESS_TABLE_NAME = process.env.EXERCISE_PROGRESS_TABLE_NAME!
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const VALID_RESULTS = new Set(['correct', 'incorrect', 'skipped'])

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

const FAR_FUTURE = '9999-12-31'

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) return unauthorizedResponse()

    let body: { exercise_id?: string; topic_id?: string; result?: string }
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return badRequestResponse('Invalid JSON body')
    }

    const { exercise_id, topic_id, result } = body

    if (!exercise_id || !topic_id || !result) {
      return badRequestResponse('exercise_id, topic_id, and result are required')
    }

    if (!VALID_RESULTS.has(result)) {
      return badRequestResponse('result must be correct, incorrect, or skipped')
    }

    const due_date = result === 'incorrect' ? tomorrow() : FAR_FUTURE
    const now = new Date().toISOString()

    await docClient.send(
      new PutCommand({
        TableName: EXERCISE_PROGRESS_TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: `EXERCISE#${exercise_id}`,
          GSI1PK: `USER#${userId}`,
          GSI1SK: `DUE#${due_date}#${exercise_id}`,
          exercise_id,
          topic_id,
          last_result: result,
          due_date,
          updated_at: now,
        },
      })
    )

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Error in exerciseAttempt:', error)
    return serverErrorResponse()
  }
}
