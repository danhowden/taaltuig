import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
  badRequestResponse,
} from '@taaltuig/lambda-utils'

const EXERCISES_TABLE_NAME = process.env.EXERCISES_TABLE_NAME!
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

export interface TopicExerciseCounts {
  total: number
  by_type: Record<string, number>
}

export interface ExerciseSummaryResponse {
  level: string
  counts: Record<string, TopicExerciseCounts>
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const level = event.queryStringParameters?.level?.toUpperCase()
    if (!level || !VALID_LEVELS.has(level)) {
      return badRequestResponse('level query parameter required (A1-C2)')
    }

    const response = await docClient.send(
      new QueryCommand({
        TableName: EXERCISES_TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `LEVEL#${level}`,
        },
        ProjectionExpression: 'topic_id, #t',
        ExpressionAttributeNames: {
          '#t': 'type',
        },
      })
    )

    const counts: Record<string, TopicExerciseCounts> = {}

    for (const item of response.Items || []) {
      const topicId = item.topic_id as string
      const exerciseType = item.type as string

      if (!counts[topicId]) {
        counts[topicId] = { total: 0, by_type: {} }
      }
      counts[topicId].total++
      counts[topicId].by_type[exerciseType] =
        (counts[topicId].by_type[exerciseType] || 0) + 1
    }

    return jsonResponse({ level, counts })
  } catch (error) {
    console.error('Error in exerciseSummary:', error)
    return serverErrorResponse()
  }
}
