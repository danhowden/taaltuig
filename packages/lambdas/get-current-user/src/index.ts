import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  unauthorizedResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

/**
 * GET /api/auth/me
 *
 * Get authenticated user profile. Auto-creates user record on first access.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Extract JWT claims (API Gateway JWT Authorizer provides these)
    const claims = event.requestContext.authorizer?.jwt?.claims

    if (!claims) {
      return unauthorizedResponse()
    }

    // Extract user info from JWT claims
    const googleSub = claims.sub as string
    const email = claims.email as string
    const name = claims.name as string
    const pictureUrl = claims.picture as string

    // Get or create user in DynamoDB
    const user = await dbClient.getOrCreateUser(
      googleSub,
      email,
      name,
      pictureUrl
    )

    // Convert to API response format
    const userResponse = {
      id: user.google_sub,
      google_sub: user.google_sub,
      email: user.email,
      name: user.name,
      picture_url: user.picture_url,
      created_at: user.created_at,
      last_login: user.last_login,
    }

    return jsonResponse({ user: userResponse })
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return serverErrorResponse()
  }
}
