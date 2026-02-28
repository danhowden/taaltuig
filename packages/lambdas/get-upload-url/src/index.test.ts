import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock S3 client and getSignedUrl
const mockGetSignedUrl = vi.fn()

vi.mock('@aws-sdk/client-s3', async () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({})),
    PutObjectCommand: vi.fn(),
  }
})

vi.mock('@aws-sdk/s3-request-presigner', async () => {
  return {
    getSignedUrl: mockGetSignedUrl,
  }
})

vi.mock('crypto', async () => {
  return {
    randomUUID: vi.fn(() => 'test-uuid-123'),
  }
})

// Set env var before import
process.env.ANKI_IMPORT_BUCKET = 'test-bucket'

const { handler } = await import('./index')

describe('get-upload-url handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate presigned URL for valid apkg file', async () => {
    const mockPresignedUrl = 'https://s3.amazonaws.com/test-bucket/uploads/test-user/test-uuid-123/deck.apkg?signature=xyz'
    mockGetSignedUrl.mockResolvedValue(mockPresignedUrl)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'deck.apkg',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.uploadUrl).toBe(mockPresignedUrl)
    expect(body.s3Key).toBe('uploads/test-user/test-uuid-123/deck.apkg')
    expect(body.s3Bucket).toBe('test-bucket')
    expect(body.expiresIn).toBe(300)
  })

  it('should accept apkg files with uppercase extension', async () => {
    mockGetSignedUrl.mockResolvedValue('https://example.com/presigned')

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'DECK.APKG',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
  })

  it('should return 401 when user is not authenticated', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({
        filename: 'deck.apkg',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('should return 400 when filename is missing', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({}),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'filename is required',
      code: 'MISSING_FIELD',
    })
  })

  it('should return 400 for non-apkg files', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'deck.zip',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Only .apkg files are supported',
      code: 'INVALID_FILE_TYPE',
    })
  })

  it('should return 500 on S3 error', async () => {
    mockGetSignedUrl.mockRejectedValue(new Error('S3 connection failed'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'deck.apkg',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'S3 connection failed',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should handle non-Error exceptions', async () => {
    mockGetSignedUrl.mockRejectedValue('Unexpected failure')

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'deck.apkg',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should generate unique S3 keys for each request', async () => {
    mockGetSignedUrl.mockResolvedValue('https://example.com/presigned')

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'user-456' },
          },
        },
      },
      body: JSON.stringify({
        filename: 'my-deck.apkg',
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    const body = JSON.parse(result.body)
    expect(body.s3Key).toBe('uploads/user-456/test-uuid-123/my-deck.apkg')
  })

  it('should handle empty body gracefully', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'test-user' },
          },
        },
      },
      body: '',
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
  })
})
