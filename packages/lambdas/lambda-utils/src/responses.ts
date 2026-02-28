import type { APIGatewayProxyResultV2 } from 'aws-lambda'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * 401 Unauthorized response
 */
export function unauthorizedResponse(): APIGatewayProxyResultV2 {
  return {
    statusCode: 401,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    }),
  }
}

/**
 * 400 Bad Request response
 */
export function badRequestResponse(
  message: string,
  code: string = 'BAD_REQUEST',
  details?: Record<string, unknown>
): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      error: message,
      code,
      ...(details && { details }),
    }),
  }
}

/**
 * 400 Missing Body response
 */
export function missingBodyResponse(): APIGatewayProxyResultV2 {
  return badRequestResponse('Request body is required', 'MISSING_BODY')
}

/**
 * 400 Invalid JSON response
 */
export function invalidJsonResponse(): APIGatewayProxyResultV2 {
  return badRequestResponse('Invalid JSON in request body', 'INVALID_JSON')
}

/**
 * 403 Forbidden response
 */
export function forbiddenResponse(): APIGatewayProxyResultV2 {
  return {
    statusCode: 403,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      error: 'Forbidden',
      code: 'FORBIDDEN',
    }),
  }
}

/**
 * 404 Not Found response
 */
export function notFoundResponse(
  message: string = 'Not found'
): APIGatewayProxyResultV2 {
  return {
    statusCode: 404,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      error: message,
      code: 'NOT_FOUND',
    }),
  }
}

/**
 * 500 Internal Server Error response
 */
export function serverErrorResponse(
  error?: unknown,
  includeMessage: boolean = false
): APIGatewayProxyResultV2 {
  return {
    statusCode: 500,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      error:
        includeMessage && error instanceof Error
          ? error.message
          : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    }),
  }
}

/**
 * 200 OK JSON response
 */
export function jsonResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  }
}
