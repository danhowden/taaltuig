import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockUpdateSettings = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      updateSettings: mockUpdateSettings,
    })),
  }
})

const { handler } = await import('./index')

describe('update-settings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockUpdatedSettings = {
    user_id: 'google-123',
    new_cards_per_day: 30,
    max_reviews_per_day: 200,
    learning_steps: [1, 10],
    relearning_steps: [10],
    graduating_interval: 1,
    easy_interval: 4,
    starting_ease: 2.5,
    easy_bonus: 1.3,
    interval_modifier: 1.0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  }

  it('should update settings and return updated values', async () => {
    mockUpdateSettings.mockResolvedValue(mockUpdatedSettings)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        new_cards_per_day: 30,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body.settings.new_cards_per_day).toBe(30)
    expect(body.settings.user_id).toBe('google-123')

    expect(mockUpdateSettings).toHaveBeenCalledWith('google-123', {
      new_cards_per_day: 30,
    })
  })

  it('should support partial updates', async () => {
    mockUpdateSettings.mockResolvedValue({
      ...mockUpdatedSettings,
      interval_modifier: 0.8,
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        interval_modifier: 0.8,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.settings.interval_modifier).toBe(0.8)

    expect(mockUpdateSettings).toHaveBeenCalledWith('google-123', {
      interval_modifier: 0.8,
    })
  })

  it('should update multiple fields at once', async () => {
    mockUpdateSettings.mockResolvedValue({
      ...mockUpdatedSettings,
      new_cards_per_day: 50,
      learning_steps: [1, 5, 10],
      starting_ease: 2.8,
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        new_cards_per_day: 50,
        learning_steps: [1, 5, 10],
        starting_ease: 2.8,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.settings.new_cards_per_day).toBe(50)
    expect(body.settings.learning_steps).toEqual([1, 5, 10])
    expect(body.settings.starting_ease).toBe(2.8)
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({ new_cards_per_day: 30 }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('should return 400 for malformed JSON body', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
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
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('should return 400 when body is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
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
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('should return 400 for new_cards_per_day below 0', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        new_cards_per_day: -5,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'new_cards_per_day must be between 0 and 100',
      code: 'VALIDATION_ERROR',
      details: {
        field: 'new_cards_per_day',
        value: -5,
      },
    })
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('should return 400 for new_cards_per_day above 100', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        new_cards_per_day: 150,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'new_cards_per_day must be between 0 and 100',
      code: 'VALIDATION_ERROR',
      details: {
        field: 'new_cards_per_day',
        value: 150,
      },
    })
  })

  it('should return 400 for starting_ease below 1.3', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        starting_ease: 1.2,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'starting_ease must be >= 1.3',
      code: 'VALIDATION_ERROR',
      details: {
        field: 'starting_ease',
        value: 1.2,
      },
    })
  })

  it('should allow starting_ease of exactly 1.3', async () => {
    mockUpdateSettings.mockResolvedValue({
      ...mockUpdatedSettings,
      starting_ease: 1.3,
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        starting_ease: 1.3,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.settings.starting_ease).toBe(1.3)
  })

  it('should return 500 on database error', async () => {
    mockUpdateSettings.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        new_cards_per_day: 30,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })
})
