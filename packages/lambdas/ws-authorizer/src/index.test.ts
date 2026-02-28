import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayRequestAuthorizerEvent } from 'aws-lambda'

// Mock JWT verification
const mockJwtVerify = vi.fn()
const mockGetSigningKey = vi.fn()
const mockGetPublicKey = vi.fn()

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: mockJwtVerify,
  },
}))

vi.mock('jwks-rsa', () => ({
  default: vi.fn(() => ({
    getSigningKey: mockGetSigningKey,
  })),
}))

const { handler } = await import('./index')

describe('ws-authorizer handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'

    // Default mock setup for successful verification
    mockGetPublicKey.mockReturnValue('mock-public-key')
    mockGetSigningKey.mockResolvedValue({
      getPublicKey: mockGetPublicKey,
    })
  })

  const validToken = 'valid.jwt.token'
  const mockDecodedToken = {
    sub: 'google-user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: 'test-client-id.apps.googleusercontent.com',
    iss: 'https://accounts.google.com',
  }

  const createEvent = (token?: string): APIGatewayRequestAuthorizerEvent => ({
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/connect',
    resource: '/connect',
    path: '/connect',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'abcdef123',
      protocol: 'websocket',
      httpMethod: 'GET',
      path: '/connect',
      stage: 'prod',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        caller: null,
        apiKey: null,
        apiKeyId: null,
        accessKey: null,
        accountId: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        user: null,
        principalOrgId: null,
        clientCert: null,
      },
      resourceId: 'test-resource',
      resourcePath: '/connect',
    },
    queryStringParameters: token ? { token } : null,
  })

  it('should authorize valid token and return Allow policy with context', async () => {
    // Mock successful JWT verification
    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(null, mockDecodedToken)
    })

    const event = createEvent(validToken)
    const result = await handler(event)

    expect(result.principalId).toBe('google-user-123')
    expect(result.policyDocument).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        },
      ],
    })
    expect(result.context).toEqual({
      sub: 'google-user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
    })
  })

  it('should throw error when token is missing', async () => {
    const event = createEvent() // No token

    await expect(handler(event)).rejects.toThrow('Unauthorized')
    expect(mockJwtVerify).not.toHaveBeenCalled()
  })

  it('should throw error when token verification fails', async () => {
    // Mock failed JWT verification
    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(new Error('Invalid signature'))
    })

    const event = createEvent('invalid.jwt.token')

    await expect(handler(event)).rejects.toThrow('Unauthorized')
  })

  it('should throw error when token has wrong audience', async () => {
    // Mock verification with wrong audience
    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(new Error('jwt audience invalid. expected: test-client-id.apps.googleusercontent.com'))
    })

    const event = createEvent(validToken)

    await expect(handler(event)).rejects.toThrow('Unauthorized')
  })

  it('should throw error when token has wrong issuer', async () => {
    // Mock verification with wrong issuer
    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(new Error('jwt issuer invalid. expected: https://accounts.google.com'))
    })

    const event = createEvent(validToken)

    await expect(handler(event)).rejects.toThrow('Unauthorized')
  })

  it('should throw error when token is expired', async () => {
    // Mock expired token error
    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(new Error('jwt expired'))
    })

    const event = createEvent(validToken)

    await expect(handler(event)).rejects.toThrow('Unauthorized')
  })

  it('should throw error when getting signing key fails', async () => {
    // Mock signing key retrieval failure
    mockGetSigningKey.mockRejectedValue(new Error('Unable to find matching key'))

    // JWT verify will fail when trying to get the key
    mockJwtVerify.mockImplementation(async (_token, getKey, _options, callback) => {
      try {
        await getKey({ kid: 'test-key-id' } as never, () => {})
        callback(new Error('Key retrieval failed'))
      } catch (error) {
        callback(error as Error)
      }
    })

    const event = createEvent(validToken)

    await expect(handler(event)).rejects.toThrow('Unauthorized')
  })

  it('should handle token with minimal claims (no email, name, picture)', async () => {
    const minimalToken = {
      sub: 'google-user-456',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'test-client-id.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
    }

    mockJwtVerify.mockImplementation((_token, _getKey, _options, callback) => {
      callback(null, minimalToken)
    })

    const event = createEvent(validToken)
    const result = await handler(event)

    expect(result.principalId).toBe('google-user-456')
    expect(result.context).toEqual({
      sub: 'google-user-456',
      email: '',
      name: '',
      picture: '',
    })
  })
})
