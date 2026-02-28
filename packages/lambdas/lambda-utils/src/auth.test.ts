import { describe, it, expect } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { getUserIdFromEvent, parseJsonBody } from './auth'

describe('Auth helpers', () => {
  describe('getUserIdFromEvent', () => {
    it('should return user ID from JWT claims', () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
      } as unknown as APIGatewayProxyEventV2

      expect(getUserIdFromEvent(event)).toBe('google-123')
    })

    it('should return null when authorizer is missing', () => {
      const event = {
        requestContext: {},
      } as unknown as APIGatewayProxyEventV2

      expect(getUserIdFromEvent(event)).toBeNull()
    })

    it('should return null when jwt is missing', () => {
      const event = {
        requestContext: {
          authorizer: {},
        },
      } as unknown as APIGatewayProxyEventV2

      expect(getUserIdFromEvent(event)).toBeNull()
    })

    it('should return null when claims are missing', () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {},
          },
        },
      } as unknown as APIGatewayProxyEventV2

      expect(getUserIdFromEvent(event)).toBeNull()
    })
  })

  describe('parseJsonBody', () => {
    it('should parse valid JSON body', () => {
      const event = {
        body: JSON.stringify({ name: 'test', value: 42 }),
      } as APIGatewayProxyEventV2

      const result = parseJsonBody<{ name: string; value: number }>(event)
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ name: 'test', value: 42 })
    })

    it('should return MISSING_BODY error when body is missing', () => {
      const event = {} as APIGatewayProxyEventV2

      const result = parseJsonBody(event)
      expect(result.error).toBe('MISSING_BODY')
      expect(result.data).toBeNull()
    })

    it('should return MISSING_BODY error when body is empty string', () => {
      const event = { body: '' } as APIGatewayProxyEventV2

      const result = parseJsonBody(event)
      expect(result.error).toBe('MISSING_BODY')
      expect(result.data).toBeNull()
    })

    it('should return INVALID_JSON error for malformed JSON', () => {
      const event = { body: 'not valid json{' } as APIGatewayProxyEventV2

      const result = parseJsonBody(event)
      expect(result.error).toBe('INVALID_JSON')
      expect(result.data).toBeNull()
    })
  })
})
