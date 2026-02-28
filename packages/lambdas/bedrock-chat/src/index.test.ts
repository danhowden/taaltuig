import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock AWS Bedrock client
const mockSend = vi.fn()

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeModelCommand: vi.fn(),
}))

const { handler } = await import('./index')

describe('bedrock-chat handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({ model: 'anthropic.claude-v2', prompt: 'Hello' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('should return 400 for malformed JSON body', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: 'not valid json{',
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should return 400 when body is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
      code: 'MISSING_BODY',
    })
  })

  it('should return 400 when model or prompt is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({ model: 'anthropic.claude-v2' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'model and prompt are required',
      code: 'VALIDATION_ERROR',
    })
  })

  it('should invoke Claude model successfully', async () => {
    const mockResponse = {
      content: [{ text: 'Hello! How can I help you?' }],
      usage: { input_tokens: 10, output_tokens: 8 },
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'anthropic.claude-v2',
        prompt: 'Hello',
        temperature: 0.7,
        maxTokens: 100,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.model).toBe('anthropic.claude-v2')
    expect(body.response).toEqual(mockResponse)
    expect(mockSend).toHaveBeenCalled()
  })

  it('should return 500 on Bedrock error', async () => {
    mockSend.mockRejectedValue(new Error('Bedrock error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'anthropic.claude-v2',
        prompt: 'Hello',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('should invoke Amazon Nova model successfully', async () => {
    const mockResponse = {
      output: {
        message: {
          role: 'assistant',
          content: [{ text: 'This is a response from Nova.' }],
        },
      },
      usage: {
        inputTokens: 10,
        outputTokens: 20,
      },
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'amazon.nova-pro-v1:0',
        prompt: 'Hello',
        temperature: 0.5,
        maxTokens: 512,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.model).toBe('amazon.nova-pro-v1:0')
    expect(body.response).toEqual(mockResponse)
  })

  it('should return 400 for unsupported model type', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'unsupported.model',
        prompt: 'Hello',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unsupported model type',
      code: 'INVALID_MODEL',
    })
  })

  it('should handle Claude model with topP parameter', async () => {
    const mockResponse = {
      content: [{ text: 'Response with topP' }],
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'anthropic.claude-v2',
        prompt: 'Hello',
        topP: 0.9,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalled()
  })

  it('should handle Claude model with topK parameter', async () => {
    const mockResponse = {
      content: [{ text: 'Response with topK' }],
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'anthropic.claude-v2',
        prompt: 'Hello',
        topK: 250,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalled()
  })

  it('should handle Claude model with all optional parameters', async () => {
    const mockResponse = {
      content: [{ text: 'Response with all params' }],
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'anthropic.claude-v2',
        prompt: 'Hello',
        temperature: 0.8,
        topP: 0.95,
        topK: 100,
        maxTokens: 2048,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalled()
  })

  it('should handle Amazon Nova model with custom topP', async () => {
    const mockResponse = {
      output: {
        message: {
          role: 'assistant',
          content: [{ text: 'Nova response with topP' }],
        },
      },
      usage: {
        inputTokens: 8,
        outputTokens: 15,
      },
    }

    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        model: 'amazon.nova-lite-v1:0',
        prompt: 'Hello',
        topP: 0.8,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalled()
  })
})
