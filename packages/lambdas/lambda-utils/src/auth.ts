import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Extended type for HTTP API with JWT authorizer
interface JwtAuthorizer {
  jwt?: {
    claims?: Record<string, unknown>
  }
}

type EventWithJwt = APIGatewayProxyEventV2 & {
  requestContext: {
    authorizer?: JwtAuthorizer
  }
}

/**
 * Extract user ID from JWT claims in API Gateway event
 * Returns null if not authenticated
 */
export function getUserIdFromEvent(
  event: APIGatewayProxyEventV2
): string | null {
  const eventWithJwt = event as EventWithJwt
  const claims = eventWithJwt.requestContext.authorizer?.jwt?.claims
  if (!claims) {
    return null
  }
  return claims.sub as string
}

/**
 * Parse JSON body from event, returns null if missing or invalid
 */
export function parseJsonBody<T = unknown>(
  event: APIGatewayProxyEventV2
): { data: T; error: null } | { data: null; error: 'MISSING_BODY' | 'INVALID_JSON' } {
  if (!event.body) {
    return { data: null, error: 'MISSING_BODY' }
  }

  try {
    return { data: JSON.parse(event.body) as T, error: null }
  } catch {
    return { data: null, error: 'INVALID_JSON' }
  }
}
