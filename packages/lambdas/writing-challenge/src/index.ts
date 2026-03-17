import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
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
const CHALLENGE_MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)
const bedrockClient = new BedrockRuntimeClient({ region: 'eu-west-1' })

const CHALLENGE_PROMPT = `You are a Dutch language teacher re-evaluating a student's answer that was automatically marked incorrect.

Exercise type: {type}
Prompt shown to student: {prompt}
Reference answer: {reference_answer}
Known valid alternatives: {alternatives}
Student's answer: {user_answer}

Determine whether the student's answer is actually acceptable.

Guidelines:
- For word_reorder: Dutch V2 word order allows multiple valid arrangements. Accept any grammatically correct ordering of the same words.
- For translation: Accept synonymous Dutch phrasings that convey the same meaning with correct grammar.
- For fill_blank: Only accept words that fit grammatically AND semantically — not just any plausible word.
- Minor capitalisation or punctuation differences are fine.
- Do NOT accept answers with spelling errors that change meaning, wrong words, or grammatical mistakes.

Respond with JSON only (no markdown):
{"correct": true, "feedback": "Brief explanation of why this is acceptable"}
or
{"correct": false, "feedback": "Brief explanation of why this is still incorrect"}`

/**
 * POST /api/writing/challenge
 *
 * Re-evaluate an answer that was marked incorrect using AI.
 * If AI agrees it's correct, marks the exercise as completed.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) return unauthorizedResponse()

    const parsed = parseJsonBody(event)
    if (parsed.error === 'MISSING_BODY') return missingBodyResponse()
    if (parsed.error === 'INVALID_JSON') return invalidJsonResponse()

    const { exercise_id, user_answer } = parsed.data as {
      exercise_id: string
      user_answer: string
    }

    if (!exercise_id || user_answer === undefined) {
      return badRequestResponse('Missing required fields: exercise_id, user_answer', 'MISSING_FIELDS')
    }

    const exercise = await dbClient.getExercise(userId, exercise_id)
    if (!exercise) return notFoundResponse('Exercise not found')

    const prompt = CHALLENGE_PROMPT
      .replace('{type}', exercise.type)
      .replace('{prompt}', exercise.prompt)
      .replace('{reference_answer}', exercise.reference_answer)
      .replace('{alternatives}', exercise.alternatives.length > 0 ? exercise.alternatives.join(', ') : 'none')
      .replace('{user_answer}', user_answer)

    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: CHALLENGE_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    )

    const body = JSON.parse(new TextDecoder().decode(response.body))
    const text: string = body.content[0].text.trim()

    let result: { correct: boolean; feedback: string }
    try {
      result = JSON.parse(text) as { correct: boolean; feedback: string }
    } catch {
      console.error('Failed to parse AI response:', text)
      return serverErrorResponse()
    }

    // If AI says correct, mark the exercise as completed so it doesn't recur
    if (result.correct) {
      await dbClient.markExerciseCompleted(userId, exercise_id)
    }

    return jsonResponse({ correct: result.correct, feedback: result.feedback })
  } catch (error) {
    console.error('Error in writingChallenge:', error)
    return serverErrorResponse()
  }
}
