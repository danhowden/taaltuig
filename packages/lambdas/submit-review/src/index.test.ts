import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Mock dependencies
const mockGetReviewItem = vi.fn()
const mockGetSettings = vi.fn()
const mockUpdateReviewItem = vi.fn()
const mockCreateReviewHistory = vi.fn()
const mockSchedule = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getReviewItem: mockGetReviewItem,
      getSettings: mockGetSettings,
      updateReviewItem: mockUpdateReviewItem,
      createReviewHistory: mockCreateReviewHistory,
    })),
    SM2Scheduler: vi.fn().mockImplementation(() => ({
      schedule: mockSchedule,
    })),
  }
})

const { handler } = await import('./index')

describe('submit-review handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  const mockReviewItem = {
    review_item_id: 'ri-123',
    card_id: 'c-123',
    user_id: 'google-123',
    direction: 'forward' as const,
    state: 'REVIEW' as const,
    interval: 10,
    ease_factor: 2.5,
    repetitions: 3,
    step_index: 0,
    due_date: '2024-01-15T00:00:00Z',
    last_reviewed: '2024-01-05T12:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    front: 'hallo',
    back: 'hello',
    explanation: 'Common greeting',
  }

  const mockSettings = {
    user_id: 'google-123',
    daily_new_cards: 20,
    learning_steps: [1, 10],
    graduating_interval: 1,
    easy_interval: 4,
    starting_ease: 2.5,
    easy_bonus: 1.3,
    interval_modifier: 1.0,
    maximum_interval: 36500,
    relearning_steps: [10],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockScheduleResult = {
    state: 'REVIEW' as const,
    interval: 25,
    ease_factor: 2.5,
    repetitions: 4,
    step_index: 0,
    due_date: '2024-02-09T12:00:00Z',
  }

  it('should successfully submit a review', async () => {
    mockGetReviewItem.mockResolvedValue(mockReviewItem)
    mockGetSettings.mockResolvedValue(mockSettings)
    mockSchedule.mockReturnValue(mockScheduleResult)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 3,
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)

    // Response should match OpenAPI spec
    expect(body).toEqual({
      next_review: '2024-02-09T12:00:00Z',
      interval_days: 25,
      state: 'REVIEW',
    })

    expect(mockSchedule).toHaveBeenCalledWith(
      mockReviewItem,
      3,
      mockSettings,
      expect.any(Date)
    )
    expect(mockUpdateReviewItem).toHaveBeenCalledWith(
      'google-123',
      'ri-123',
      expect.objectContaining({
        state: 'REVIEW',
        interval: 25,
        ease_factor: 2.5,
      })
    )
    expect(mockCreateReviewHistory).toHaveBeenCalled()
  })


  it('should return 401 when unauthorized', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({ review_item_id: 'ri-123', grade: 3, duration_ms: 5000 }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('should return 400 for malformed JSON body', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: 'not valid json{',
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    })
  })

  it('should return 400 when body is missing', async () => {
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

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Request body is required',
      code: 'MISSING_BODY',
    })
  })

  it('should return 400 for invalid grade', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 1, // Invalid - only 0,2,3,4 allowed
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid grade. Must be 0, 2, 3, or 4',
      code: 'INVALID_GRADE',
    })
  })

  it('should return 400 for negative duration', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 3,
        duration_ms: -100,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'duration_ms must be >= 0',
      code: 'INVALID_DURATION',
    })
  })

  it('should return 404 when review item not found', async () => {
    mockGetReviewItem.mockResolvedValue(null)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'nonexistent',
        grade: 3,
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Review item not found',
      code: 'NOT_FOUND',
    })
  })

  it('should return 403 when user does not own review item', async () => {
    mockGetReviewItem.mockResolvedValue({
      ...mockReviewItem,
      user_id: 'different-user',
    })

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 3,
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(403)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Forbidden',
      code: 'FORBIDDEN',
    })
  })

  it('should return 500 when settings not found', async () => {
    mockGetReviewItem.mockResolvedValue(mockReviewItem)
    mockGetSettings.mockResolvedValue(null)

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 3,
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should handle all valid grades (0, 2, 3, 4)', async () => {
    mockGetReviewItem.mockResolvedValue(mockReviewItem)
    mockGetSettings.mockResolvedValue(mockSettings)
    mockSchedule.mockReturnValue(mockScheduleResult)

    const validGrades = [0, 2, 3, 4]

    for (const grade of validGrades) {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'google-123' },
            },
          },
        },
        body: JSON.stringify({
          review_item_id: 'ri-123',
          grade,
          duration_ms: 5000,
        }),
      } as unknown as APIGatewayProxyEventV2

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
    }
  })

  it('should return 500 on database error', async () => {
    mockGetReviewItem.mockRejectedValue(new Error('Database error'))

    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: { sub: 'google-123' },
          },
        },
      },
      body: JSON.stringify({
        review_item_id: 'ri-123',
        grade: 3,
        duration_ms: 5000,
      }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })
})
