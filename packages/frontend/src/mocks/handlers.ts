import { http, HttpResponse } from 'msw'
import type {
  QueueResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  UserSettings,
} from '@/types'
import { mockUser, mockQueue, mockSettings } from './data'

// Use wildcard pattern to match any domain
const API_PATTERN = '*/api'

// Simple in-memory queue state for demo purposes
let currentQueue = [...mockQueue]

export const handlers = [
  // GET /api/auth/me - Get current user
  http.get(`${API_PATTERN}/auth/me`, () => {
    return HttpResponse.json({ user: mockUser })
  }),

  // GET /api/reviews/queue - Get review queue
  http.get(`${API_PATTERN}/reviews/queue`, () => {
    const learningCount = currentQueue.filter(
      (item) => item.state === 'LEARNING',
    ).length
    const dueCount = currentQueue.filter((item) =>
      ['REVIEW', 'RELEARNING'].includes(item.state),
    ).length
    const newCount = currentQueue.filter((item) => item.state === 'NEW').length

    const response: QueueResponse = {
      queue: currentQueue,
      stats: {
        due_count: dueCount,
        new_count: newCount,
        learning_count: learningCount,
        total_count: currentQueue.length,
        new_remaining_today: 15, // Mock value
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

    // Calculate mock next review date based on grade
    const daysToAdd = body.grade === 0 ? 0.0007 : body.grade === 2 ? 1 : 7
    const nextReview = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000)

    const response: SubmitReviewResponse = {
      next_review: nextReview.toISOString(),
      interval_days: daysToAdd,
      state: body.grade === 0 ? 'LEARNING' : 'REVIEW',
    }

    // Add artificial delay to simulate network
    await new Promise((resolve) => setTimeout(resolve, 300))

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

  // GET /api/cards - List cards
  http.get(`${API_PATTERN}/cards`, () => {
    return HttpResponse.json({ cards: [] })
  }),

  // POST /api/cards - Create card
  http.post(`${API_PATTERN}/cards`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ card: { id: 'new-card', ...body } })
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
]
