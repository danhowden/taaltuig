import { describe, it, expect } from 'vitest'
import {
  unauthorizedResponse,
  badRequestResponse,
  missingBodyResponse,
  invalidJsonResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  jsonResponse,
} from './responses'

describe('Response helpers', () => {
  describe('unauthorizedResponse', () => {
    it('should return 401 with correct body', () => {
      const response = unauthorizedResponse()
      expect(response.statusCode).toBe(401)
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      })
    })
  })

  describe('badRequestResponse', () => {
    it('should return 400 with message and default code', () => {
      const response = badRequestResponse('Invalid input')
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Invalid input',
        code: 'BAD_REQUEST',
      })
    })

    it('should return 400 with custom code', () => {
      const response = badRequestResponse('Invalid field', 'VALIDATION_ERROR')
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Invalid field',
        code: 'VALIDATION_ERROR',
      })
    })

    it('should include details when provided', () => {
      const response = badRequestResponse('Invalid field', 'VALIDATION_ERROR', {
        field: 'email',
        value: 'not-an-email',
      })
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Invalid field',
        code: 'VALIDATION_ERROR',
        details: {
          field: 'email',
          value: 'not-an-email',
        },
      })
    })
  })

  describe('missingBodyResponse', () => {
    it('should return 400 with MISSING_BODY code', () => {
      const response = missingBodyResponse()
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Request body is required',
        code: 'MISSING_BODY',
      })
    })
  })

  describe('invalidJsonResponse', () => {
    it('should return 400 with INVALID_JSON code', () => {
      const response = invalidJsonResponse()
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      })
    })
  })

  describe('forbiddenResponse', () => {
    it('should return 403 with correct body', () => {
      const response = forbiddenResponse()
      expect(response.statusCode).toBe(403)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Forbidden',
        code: 'FORBIDDEN',
      })
    })
  })

  describe('notFoundResponse', () => {
    it('should return 404 with default message', () => {
      const response = notFoundResponse()
      expect(response.statusCode).toBe(404)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Not found',
        code: 'NOT_FOUND',
      })
    })

    it('should return 404 with custom message', () => {
      const response = notFoundResponse('Card not found')
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Card not found',
        code: 'NOT_FOUND',
      })
    })
  })

  describe('serverErrorResponse', () => {
    it('should return 500 with generic message by default', () => {
      const response = serverErrorResponse()
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      })
    })

    it('should include error message when includeMessage is true', () => {
      const error = new Error('Database connection failed')
      const response = serverErrorResponse(error, true)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Database connection failed',
        code: 'INTERNAL_SERVER_ERROR',
      })
    })

    it('should use generic message when error is not an Error instance', () => {
      const response = serverErrorResponse('string error', true)
      expect(JSON.parse(response.body as string)).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      })
    })
  })

  describe('jsonResponse', () => {
    it('should return 200 with JSON body', () => {
      const response = jsonResponse({ success: true, data: [1, 2, 3] })
      expect(response.statusCode).toBe(200)
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(response.body as string)).toEqual({
        success: true,
        data: [1, 2, 3],
      })
    })

    it('should use custom status code', () => {
      const response = jsonResponse({ created: true }, 201)
      expect(response.statusCode).toBe(201)
    })
  })
})
