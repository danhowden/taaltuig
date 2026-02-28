import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock DynamoDB client
const mockGetSettings = vi.fn()
const mockCreateDefaultSettings = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getSettings: mockGetSettings,
      createDefaultSettings: mockCreateDefaultSettings,
    })),
  }
})

const { handler } = await import('./index')

describe('get-settings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockSettings = {
    user_id: 'google-123',
    new_cards_per_day: 20,
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

  it('should return existing user settings', async () => {
    mockGetSettings.mockResolvedValue(mockSettings)

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

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body.settings).toEqual({
      user_id: 'google-123',
      new_cards_per_day: 20,
      max_reviews_per_day: 200,
      learning_steps: [1, 10],
      relearning_steps: [10],
      graduating_interval: 1,
      easy_interval: 4,
      starting_ease: 2.5,
      easy_bonus: 1.3,
      interval_modifier: 1.0,
      updated_at: '2024-01-15T12:00:00Z',
    })

    expect(mockGetSettings).toHaveBeenCalledWith('google-123')
    expect(mockCreateDefaultSettings).not.toHaveBeenCalled()
  })

  it('should create and return default settings when none exist', async () => {
    mockGetSettings.mockResolvedValue(null)
    mockCreateDefaultSettings.mockResolvedValue({
      ...mockSettings,
      created_at: '2024-01-15T12:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    })

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

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.settings.user_id).toBe('google-123')
    expect(body.settings.new_cards_per_day).toBe(20)

    expect(mockGetSettings).toHaveBeenCalledWith('google-123')
    expect(mockCreateDefaultSettings).toHaveBeenCalledWith('google-123')
  })

  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockGetSettings).not.toHaveBeenCalled()
  })

  it('should return 401 when JWT claims are missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {},
        },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(mockGetSettings).not.toHaveBeenCalled()
  })

  it('should return 500 on database error', async () => {
    mockGetSettings.mockRejectedValue(new Error('Database error'))

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

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should not include created_at in response', async () => {
    mockGetSettings.mockResolvedValue(mockSettings)

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

    const body = JSON.parse(result.body)
    expect(body.settings.created_at).toBeUndefined()
  })
})
