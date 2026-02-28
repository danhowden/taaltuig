import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
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

// Use the Lambda's region from environment
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

interface BedrockChatRequest {
  model: string
  prompt: string
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
}

/**
 * POST /api/bedrock/chat
 *
 * Experimental endpoint for testing AWS Bedrock models
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

    const body = parsed.data as BedrockChatRequest

    if (!body.model || !body.prompt) {
      return badRequestResponse(
        'model and prompt are required',
        'VALIDATION_ERROR'
      )
    }

    // Build request based on model type
    let modelRequest: Record<string, unknown>
    let modelId: string

    if (body.model.includes('anthropic.')) {
      // Claude models (supports both direct model IDs and inference profiles)
      modelId = body.model
      modelRequest = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: body.maxTokens || 1024,
        messages: [
          {
            role: 'user',
            content: body.prompt,
          },
        ],
      }

      // Claude 4.5 models only allow temperature OR top_p, not both
      const isClaude45 = body.model.includes('opus-4-5') || body.model.includes('sonnet-4-5') || body.model.includes('haiku-4-5')

      if (body.temperature !== undefined) {
        modelRequest.temperature = body.temperature
      }
      // Only include top_p for non-Claude 4.5 models, or if temperature is not set
      if (body.topP !== undefined && (!isClaude45 || body.temperature === undefined)) {
        modelRequest.top_p = body.topP
      }
      if (body.topK !== undefined) {
        modelRequest.top_k = body.topK
      }
    } else if (body.model.includes('amazon.nova')) {
      // Amazon Nova models (Messages API format, supports inference profiles)
      modelId = body.model
      modelRequest = {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: body.prompt,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: body.maxTokens || 1024,
        },
      }

      if (body.temperature !== undefined) {
        ;(modelRequest.inferenceConfig as Record<string, unknown>).temperature = body.temperature
      }
      if (body.topP !== undefined) {
        ;(modelRequest.inferenceConfig as Record<string, unknown>).topP = body.topP
      }
      // Nova models require topK between 1-128 (Claude allows 1-500)
      if (body.topK !== undefined) {
        ;(modelRequest.inferenceConfig as Record<string, unknown>).topK = Math.min(body.topK, 128)
      }
    } else {
      return badRequestResponse('Unsupported model type', 'INVALID_MODEL')
    }

    // Invoke Bedrock model
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(modelRequest),
      contentType: 'application/json',
      accept: 'application/json',
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    return jsonResponse({
      model: modelId,
      response: responseBody,
      raw_request: modelRequest,
    })
  } catch (error) {
    console.error('Error in bedrockChat:', error)
    return serverErrorResponse(error, true)
  }
}
