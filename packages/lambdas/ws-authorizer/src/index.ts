import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const GOOGLE_ISSUER = 'https://accounts.google.com'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!

interface GoogleTokenClaims {
  sub: string
  email?: string
  name?: string
  picture?: string
  iat?: number
  exp?: number
  aud?: string
  iss?: string
}

// Create JWKS client for Google's public keys
const client = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
})

// Helper to get signing key
async function getKey(header: jwt.JwtHeader): Promise<string> {
  const key = await client.getSigningKey(header.kid)
  return key.getPublicKey()
}

/**
 * WebSocket Lambda Authorizer
 * Validates Google OAuth JWT tokens from query string parameter
 */
export async function handler(
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  try {
    // Extract token from query string
    const token = event.queryStringParameters?.token

    if (!token) {
      throw new Error('Unauthorized')
    }

    // Verify JWT token
    const decoded = await verifyGoogleToken(token)

    // Generate IAM policy
    const policy = generatePolicy(
      decoded.sub,
      'Allow',
      event.methodArn,
      decoded
    )

    return policy
  } catch (error) {
    console.error('Authorization failed:', error)
    // Return explicit Deny policy
    throw new Error('Unauthorized')
  }
}

async function verifyGoogleToken(token: string): Promise<GoogleTokenClaims> {
  return new Promise((resolve, reject) => {
    // Verify token signature and claims
    jwt.verify(
      token,
      async (header, callback) => {
        try {
          const key = await getKey(header)
          callback(null, key)
        } catch (error) {
          callback(error as Error)
        }
      },
      {
        audience: GOOGLE_CLIENT_ID,
        issuer: [GOOGLE_ISSUER, 'accounts.google.com'],
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          reject(err)
        } else {
          resolve(decoded)
        }
      }
    )
  })
}

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  claims?: GoogleTokenClaims
): APIGatewayAuthorizerResult {
  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  }

  // Add JWT claims to context (available in downstream Lambdas)
  if (claims && effect === 'Allow') {
    authResponse.context = {
      sub: claims.sub,
      email: claims.email || '',
      name: claims.name || '',
      picture: claims.picture || '',
    }
  }

  return authResponse
}
