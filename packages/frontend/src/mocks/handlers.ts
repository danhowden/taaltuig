import { http, HttpResponse } from 'msw'
import type {
  QueueResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  UserSettings,
  PaginatedListCardsResponse,
  GenerateInsightsResponse,
  ValidateInsightsResponse,
  ReviewInsightResponse,
  ClearInsightsResponse,
} from '@/types'
import {
  mockUser,
  mockQueue,
  mockSettings,
  mockCardsWithInsights,
  mockExtraNewCards,
  mockInsightsQueue,
  mockInsightsMetricsData,
} from './data'

// Use wildcard pattern to match any domain
const API_PATTERN = '*/api'

// Simple in-memory queue state for demo purposes
let currentQueue = [...mockQueue]

/** Reset mutable handler state between tests */
export function resetHandlerState(): void {
  currentQueue = [...mockQueue]
}

export const handlers = [
  // GET /api/auth/me - Get current user
  http.get(`${API_PATTERN}/auth/me`, () => {
    return HttpResponse.json({ user: mockUser })
  }),

  // GET /api/reviews/queue - Get review queue
  http.get(`${API_PATTERN}/reviews/queue`, ({ request }) => {
    const url = new URL(request.url)
    const extraNew = url.searchParams.get('extra_new')
    const all = url.searchParams.get('all')

    // Extra new cards request
    if (extraNew) {
      const count = parseInt(extraNew, 10)
      const extraCards = mockExtraNewCards.slice(0, count)
      const response: QueueResponse = {
        queue: extraCards,
        stats: {
          due_count: 0,
          new_count: extraCards.length,
          learning_count: 0,
          total_count: extraCards.length,
          new_remaining_today: Math.max(0, mockExtraNewCards.length - count),
          vocab_experienced: 42,
          vocab_learned: 28,
        },
      }
      return HttpResponse.json(response)
    }

    // All items (debug page)
    const queue = all === 'true' ? [...mockQueue] : currentQueue

    const learningCount = queue.filter(
      (item) => item.state === 'LEARNING',
    ).length
    const dueCount = queue.filter((item) =>
      ['REVIEW', 'RELEARNING'].includes(item.state),
    ).length
    const newCount = queue.filter((item) => item.state === 'NEW').length

    const response: QueueResponse = {
      queue,
      stats: {
        due_count: dueCount,
        new_count: newCount,
        learning_count: learningCount,
        total_count: queue.length,
        new_remaining_today: 15, // Mock value
        vocab_experienced: 42,
        vocab_learned: 28,
      },
    }

    return HttpResponse.json(response)
  }),

  // POST /api/reviews/submit - Submit review
  http.post(`${API_PATTERN}/reviews/submit`, async ({ request }) => {
    const body = (await request.json()) as SubmitReviewRequest

    // Remove the reviewed item from the queue
    currentQueue = currentQueue.filter(
      (item) => item.id !== body.review_item_id,
    )

    // Realistic interval_days based on grade
    // Grade 0 (Again): ~10min → triggers waiting state
    // Grade 2 (Hard): 1 day
    // Grade 3 (Good): 1 day
    // Grade 4 (Easy): 4 days
    const intervalMap: Record<number, number> = {
      0: 0.007, // ~10 minutes
      2: 1,
      3: 1,
      4: 4,
    }
    const daysToAdd = intervalMap[body.grade] ?? 1
    const nextReview = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000)

    const response: SubmitReviewResponse = {
      next_review: nextReview.toISOString(),
      interval_days: daysToAdd,
      state: body.grade === 0 ? 'LEARNING' : 'REVIEW',
    }

    // Add artificial delay to simulate network
    await new Promise((resolve) => setTimeout(resolve, 50))

    return HttpResponse.json(response)
  }),

  // GET /api/settings - Get user settings
  http.get(`${API_PATTERN}/settings`, () => {
    return HttpResponse.json({ settings: mockSettings })
  }),

  // PUT /api/settings - Update user settings
  http.put(`${API_PATTERN}/settings`, async ({ request }) => {
    const body = (await request.json()) as Partial<UserSettings>
    const updated = {
      ...mockSettings,
      ...body,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json({ settings: updated })
  }),

  // GET /api/cards - List cards (supports pagination via ?limit= param)
  http.get(`${API_PATTERN}/cards`, ({ request }) => {
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit')

    if (limit) {
      // Paginated response
      const response: PaginatedListCardsResponse = {
        cards: mockCardsWithInsights,
        pagination: {
          cursor: null,
          hasMore: false,
          pageSize: parseInt(limit, 10),
        },
      }
      return HttpResponse.json(response)
    }

    // Legacy non-paginated response
    return HttpResponse.json({ cards: mockCardsWithInsights })
  }),

  // POST /api/cards - Create card
  http.post(`${API_PATTERN}/cards`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      card: {
        id: `CARD#new-card-${Date.now()}`,
        card_id: `new-card-${Date.now()}`,
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        ...body,
      },
    })
  }),

  // PUT /api/cards/:id - Update card
  http.put(`${API_PATTERN}/cards/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ card: { id: 'card-1', ...body } })
  }),

  // DELETE /api/cards/:id - Delete card
  http.delete(`${API_PATTERN}/cards/:id`, () => {
    return HttpResponse.json({ success: true })
  }),

  // PUT /api/categories/rename - Rename category
  http.put(`${API_PATTERN}/categories/rename`, async ({ request }) => {
    const body = (await request.json()) as { old_category: string; new_category: string }
    return HttpResponse.json({
      cards_updated: 5,
      old_category: body.old_category,
      new_category: body.new_category,
    })
  }),

  // POST /api/import/upload-url - Get upload URL
  http.post(`${API_PATTERN}/import/upload-url`, async ({ request }) => {
    const body = (await request.json()) as { filename: string }
    return HttpResponse.json({
      upload_url: 'https://s3.example.com/upload',
      file_key: `uploads/${body.filename}`,
    })
  }),

  // POST /api/import/anki - Import Anki deck
  http.post(`${API_PATTERN}/import/anki`, () => {
    return HttpResponse.json({
      import_id: 'import-123',
      status: 'processing',
    })
  }),

  // POST /api/debug/reset-daily-reviews - Reset daily reviews
  http.post(`${API_PATTERN}/debug/reset-daily-reviews`, () => {
    return HttpResponse.json({
      message: 'Daily review counts reset',
      new_items_added: 20,
    })
  }),

  // POST /api/debug/clear-database - Clear database
  http.post(`${API_PATTERN}/debug/clear-database`, () => {
    return HttpResponse.json({
      deleted_cards: 10,
      deleted_review_items: 20,
      deleted_history: 50,
    })
  }),

  // =========================================================================
  // Insights endpoints
  // =========================================================================

  // POST /api/insights/generate - Generate insights for cards
  http.post(`${API_PATTERN}/insights/generate`, async ({ request }) => {
    const body = (await request.json()) as { card_ids: string[] }
    const response: GenerateInsightsResponse = {
      generated: body.card_ids.map((card_id) => ({
        card_id,
        insights_count: 2,
      })),
    }
    return HttpResponse.json(response)
  }),

  // POST /api/insights/validate - Validate pending insights
  http.post(`${API_PATTERN}/insights/validate`, async ({ request }) => {
    const body = (await request.json()) as { card_ids: string[] }
    const response: ValidateInsightsResponse = {
      validated: body.card_ids.map((card_id) => ({
        card_id,
        insights: [
          { type: 'compound' as const, content: 'Test insight', approved: true },
        ],
      })),
    }
    return HttpResponse.json(response)
  }),

  // GET /api/insights/queue - Get insights awaiting review
  http.get(`${API_PATTERN}/insights/queue`, () => {
    return HttpResponse.json(mockInsightsQueue)
  }),

  // PUT /api/insights/:cardId/review - Review a single insight
  http.put(`${API_PATTERN}/insights/:cardId/review`, async ({ params }) => {
    const { cardId } = params
    const card = mockCardsWithInsights.find((c) => c.card_id === cardId)
    const response: ReviewInsightResponse = {
      card: card || mockCardsWithInsights[0],
    }
    return HttpResponse.json(response)
  }),

  // =========================================================================
  // Metrics endpoints
  // =========================================================================

  // GET /api/metrics/insights - Get insights metrics
  http.get(`${API_PATTERN}/metrics/insights`, () => {
    return HttpResponse.json(mockInsightsMetricsData())
  }),

  // =========================================================================
  // Debug endpoints
  // =========================================================================

  // POST /api/debug/clear-insights - Clear all insights
  http.post(`${API_PATTERN}/debug/clear-insights`, () => {
    const response: ClearInsightsResponse = {
      message: 'Insights cleared',
      cleared_cards: 5,
      cleared_review_items: 10,
    }
    return HttpResponse.json(response)
  }),
]
