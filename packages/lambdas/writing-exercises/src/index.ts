import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import {
  getUserIdFromEvent,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const EXERCISES_TABLE_NAME = process.env.EXERCISES_TABLE_NAME!
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

export interface CatalogExercise {
  exercise_id: string
  type: string
  topic_id: string
  cefr_level: string
  prompt: string
  reference_answer: string
  alternatives: string[]
  grammar_focus?: string
  blanking_strategy?: string
  source_notes?: string
  // translation
  direction?: string
  translation_notes?: string
  key_words?: string[]
  // multiple_choice
  options?: string[]
  correct_index?: number
  explanation?: string
  seeded_at: string
}

/**
 * GET /api/exercises/catalog?topic=<topic_id>     — exercises for a topic (PK query)
 * GET /api/exercises/catalog?level=<A1>&type=<type> — exercises for a level (GSI1 query)
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const topic = event.queryStringParameters?.topic
    const level = event.queryStringParameters?.level?.toUpperCase()
    const typeFilter = event.queryStringParameters?.type

    let items: Record<string, unknown>[]

    if (!topic && !level) {
      // No filter — return all exercises (scan, fine for small catalog)
      const response = await docClient.send(new ScanCommand({
        TableName: EXERCISES_TABLE_NAME,
      }))
      items = (response.Items || []) as Record<string, unknown>[]
    } else if (topic) {
      // Query by topic (PK lookup)
      const params: Record<string, unknown> = {
        TableName: EXERCISES_TABLE_NAME,
        KeyConditionExpression: typeFilter
          ? 'PK = :pk AND begins_with(SK, :skPrefix)'
          : 'PK = :pk',
        ExpressionAttributeValues: typeFilter
          ? { ':pk': `TOPIC#${topic}`, ':skPrefix': `${typeFilter}#` }
          : { ':pk': `TOPIC#${topic}` },
      }

      const response = await docClient.send(new QueryCommand(params))
      items = (response.Items || []) as Record<string, unknown>[]
    } else {
      // Query by level (GSI1)
      if (!VALID_LEVELS.has(level!)) {
        return badRequestResponse('Invalid level (A1-C2)')
      }

      const params: Record<string, unknown> = {
        TableName: EXERCISES_TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: typeFilter
          ? 'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)'
          : 'GSI1PK = :pk',
        ExpressionAttributeValues: typeFilter
          ? { ':pk': `LEVEL#${level}`, ':skPrefix': `${typeFilter}#` }
          : { ':pk': `LEVEL#${level}` },
      }

      const response = await docClient.send(new QueryCommand(params))
      items = (response.Items || []) as Record<string, unknown>[]
    }

    // Strip DynamoDB key attributes from response
    const exercises: CatalogExercise[] = items.map((item) => ({
      exercise_id: item.exercise_id as string,
      type: item.type as string,
      topic_id: item.topic_id as string,
      cefr_level: item.cefr_level as string,
      prompt: item.prompt as string,
      reference_answer: item.reference_answer as string,
      alternatives: (item.alternatives as string[]) || [],
      grammar_focus: item.grammar_focus as string | undefined,
      blanking_strategy: item.blanking_strategy as string | undefined,
      source_notes: item.source_notes as string | undefined,
      direction: item.direction as string | undefined,
      translation_notes: item.translation_notes as string | undefined,
      key_words: item.key_words as string[] | undefined,
      options: item.options as string[] | undefined,
      correct_index: item.correct_index as number | undefined,
      explanation: item.explanation as string | undefined,
      seeded_at: item.seeded_at as string,
    }))

    return jsonResponse({ exercises, count: exercises.length })
  } catch (error) {
    console.error('Error in exerciseCatalog:', error)
    return serverErrorResponse()
  }
}
