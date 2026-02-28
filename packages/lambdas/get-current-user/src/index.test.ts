import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockGetOrCreateUser = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getOrCreateUser: mockGetOrCreateUser,
    })),
  }
})

const { handler } = await import('./index')

describe('get-current-user handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('should return user profile on successful authentication', async () => {
    const mockUser = {
      google_sub: 'google-123',
      email: 'test@example.com',
      name: 'Test User',
      picture_url: 'https://example.com/pic.jpg',
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-15T12:00:00Z',
    }

    mockGetOrCreateUser.mockResolvedValue(mockUser)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'google-123',
              email: 'test@example.com',
              name: 'Test User',
              picture: 'https://example.com/pic.jpg',
            },
          },
        },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(result.body)
    expect(body).toEqual({
      user: {
        id: 'google-123',
        google_sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture_url: 'https://example.com/pic.jpg',
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-15T12:00:00Z',
      },
    })

    expect(mockGetOrCreateUser).toHaveBeenCalledWith(
      'google-123',
      'test@example.com',
      'Test User',
      'https://example.com/pic.jpg'
    )
  })

  it('should return 401 when JWT claims are missing', async () => {
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
    expect(mockGetOrCreateUser).not.toHaveBeenCalled()
  })

  it('should return 401 when authorizer is missing', async () => {
    const event = {
      requestContext: {},
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(mockGetOrCreateUser).not.toHaveBeenCalled()
  })

  it('should return 500 on database error', async () => {
    mockGetOrCreateUser.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'google-123',
              email: 'test@example.com',
              name: 'Test User',
              picture: 'https://example.com/pic.jpg',
            },
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

  it('should handle user creation for first-time login', async () => {
    const newUser = {
      google_sub: 'new-user-123',
      email: 'new@example.com',
      name: 'New User',
      picture_url: 'https://example.com/new.jpg',
      created_at: '2024-01-15T12:00:00Z',
      last_login: '2024-01-15T12:00:00Z',
    }

    mockGetOrCreateUser.mockResolvedValue(newUser)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'new-user-123',
              email: 'new@example.com',
              name: 'New User',
              picture: 'https://example.com/new.jpg',
            },
          },
        },
      },
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.user.google_sub).toBe('new-user-123')
    expect(body.user.created_at).toBe(body.user.last_login)
  })
})
