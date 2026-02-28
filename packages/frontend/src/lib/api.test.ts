import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { apiClient } from './api'
import { mockUser, mockCards } from '@/mocks/data'
import type {
  SubmitReviewRequest,
  CreateCardRequest,
  UpdateCardRequest,
  RenameCategoryRequest,
  GetUploadUrlRequest,
  ImportAnkiRequest,
} from '@/types'

const API_BASE = '*/api'
const TEST_TOKEN = 'test-token-123'

describe('apiClient', () => {
  beforeEach(() => {
    server.resetHandlers()
  })

  describe('request handling', () => {
    it('sets Authorization header with Bearer token', async () => {
      let capturedHeaders: Headers | undefined

      server.use(
        http.get(`${API_BASE}/auth/me`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json({ user: mockUser })
        }),
      )

      await apiClient.getCurrentUser(TEST_TOKEN)

      expect(capturedHeaders?.get('Authorization')).toBe(`Bearer ${TEST_TOKEN}`)
    })

    it('throws error on non-ok responses', async () => {
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.json(
            { error: 'Unauthorized', code: 'AUTH_ERROR' },
            { status: 401 },
          )
        }),
      )

      await expect(apiClient.getCurrentUser(TEST_TOKEN)).rejects.toEqual({
        error: 'Unauthorized',
        code: 'AUTH_ERROR',
      })
    })

    it('parses JSON error bodies', async () => {
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.json(
            { error: 'Invalid token', code: 'INVALID_TOKEN' },
            { status: 401 },
          )
        }),
      )

      await expect(apiClient.getCurrentUser(TEST_TOKEN)).rejects.toEqual({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      })
    })

    it('falls back to status text for non-JSON error bodies', async () => {
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return new HttpResponse('Server Error', { status: 500 })
        }),
      )

      await expect(apiClient.getCurrentUser(TEST_TOKEN)).rejects.toMatchObject({
        error: expect.stringContaining('API request failed'),
        code: 'HTTP_500',
      })
    })

    it('handles network errors', async () => {
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.error()
        }),
      )

      await expect(apiClient.getCurrentUser(TEST_TOKEN)).rejects.toThrow()
    })
  })

  describe('auth endpoints', () => {
    it('getCurrentUser calls GET /api/auth/me', async () => {
      const result = await apiClient.getCurrentUser(TEST_TOKEN)

      expect(result).toEqual({ user: mockUser })
    })
  })

  describe('review endpoints', () => {
    it('getReviewQueue calls GET /api/reviews/queue', async () => {
      const result = await apiClient.getReviewQueue(TEST_TOKEN)

      expect(result.queue).toBeDefined()
      expect(result.stats).toBeDefined()
    })

    it('submitReview calls POST /api/reviews/submit with data', async () => {
      const reviewData: SubmitReviewRequest = {
        review_item_id: 'review-1',
        grade: 3,
      }

      const result = await apiClient.submitReview(TEST_TOKEN, reviewData)

      expect(result.next_review).toBeDefined()
      expect(result.state).toBeDefined()
    })
  })

  describe('settings endpoints', () => {
    it('getSettings calls GET /api/settings', async () => {
      const result = await apiClient.getSettings(TEST_TOKEN)

      // apiClient.getSettings unwraps { settings: {...} } and returns settings directly
      expect(result).toMatchObject({
        user_id: expect.any(String),
        new_cards_per_day: expect.any(Number),
      })
    })

    it('updateSettings calls PUT /api/settings', async () => {
      const updates = { new_cards_per_day: 30 }

      const result = await apiClient.updateSettings(TEST_TOKEN, updates)

      // apiClient.updateSettings unwraps { settings: {...} } and returns settings directly
      expect(result).toBeDefined()
      expect(result.updated_at).toBeDefined()
    })
  })

  describe('card endpoints', () => {
    beforeEach(() => {
      // Add card endpoint handlers
      server.use(
        http.get(`${API_BASE}/cards`, () => {
          return HttpResponse.json({ cards: mockCards })
        }),
        http.post(`${API_BASE}/cards`, async ({ request }) => {
          const body = (await request.json()) as CreateCardRequest
          return HttpResponse.json({
            card: {
              id: 'CARD#new-card',
              card_id: 'new-card',
              user_id: 'user-1',
              ...body,
              created_at: new Date().toISOString(),
            },
          })
        }),
        http.put(`${API_BASE}/cards/:id`, async ({ request, params }) => {
          const body = (await request.json()) as UpdateCardRequest
          const card = mockCards.find((c) => c.card_id === params.id)
          return HttpResponse.json({
            card: {
              ...card,
              ...body,
            },
          })
        }),
        http.delete(`${API_BASE}/cards/:id`, () => {
          return HttpResponse.json({ success: true })
        }),
      )
    })

    it('listCards calls GET /api/cards', async () => {
      const result = await apiClient.listCards(TEST_TOKEN)

      expect(result.cards).toBeDefined()
      expect(Array.isArray(result.cards)).toBe(true)
    })

    it('listCardsPaginated calls GET /api/cards with query params', async () => {
      server.use(
        http.get(`${API_BASE}/cards`, ({ request }) => {
          const url = new URL(request.url)
          const limit = url.searchParams.get('limit')
          const _search = url.searchParams.get('search')
          return HttpResponse.json({
            cards: mockCards,
            pagination: {
              cursor: null,
              hasMore: false,
              pageSize: parseInt(limit || '50'),
            },
          })
        }),
      )

      const result = await apiClient.listCardsPaginated(TEST_TOKEN, {
        limit: 10,
        search: 'test',
      })

      expect(result.cards).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.pageSize).toBe(10)
    })

    it('createCard calls POST /api/cards', async () => {
      const cardData: CreateCardRequest = {
        front: 'nieuwe woord',
        back: 'new word',
        category: 'vocabulary',
      }

      const result = await apiClient.createCard(TEST_TOKEN, cardData)

      expect(result.card).toMatchObject({
        front: 'nieuwe woord',
        back: 'new word',
      })
    })

    it('updateCard calls PUT /api/cards/{id}', async () => {
      const updates: UpdateCardRequest = {
        front: 'updated front',
      }

      const result = await apiClient.updateCard(TEST_TOKEN, 'card-1', updates)

      expect(result.card).toBeDefined()
    })

    it('deleteCard calls DELETE /api/cards/{id}', async () => {
      const result = await apiClient.deleteCard(TEST_TOKEN, 'card-1')

      expect(result.success).toBe(true)
    })
  })

  describe('category endpoints', () => {
    beforeEach(() => {
      server.use(
        http.put(`${API_BASE}/categories/rename`, async ({ request }) => {
          const body = (await request.json()) as RenameCategoryRequest
          return HttpResponse.json({
            old_category: body.old_category,
            new_category: body.new_category,
            cards_updated: 5,
          })
        }),
      )
    })

    it('renameCategory calls PUT /api/categories/rename', async () => {
      const data: RenameCategoryRequest = {
        old_category: 'old-name',
        new_category: 'new-name',
      }

      const result = await apiClient.renameCategory(TEST_TOKEN, data)

      expect(result.cards_updated).toBeDefined()
    })
  })

  describe('anki import endpoints', () => {
    beforeEach(() => {
      server.use(
        http.post(`${API_BASE}/import/upload-url`, async ({ request }) => {
          const body = (await request.json()) as GetUploadUrlRequest
          return HttpResponse.json({
            upload_url: 'https://s3.example.com/upload',
            file_key: `uploads/${body.filename}`,
          })
        }),
        http.post(`${API_BASE}/import/anki`, async ({ request }) => {
          const _body = (await request.json()) as ImportAnkiRequest
          return HttpResponse.json({
            import_id: 'import-123',
            status: 'processing',
          })
        }),
      )
    })

    it('getUploadUrl calls POST /api/import/upload-url', async () => {
      const data: GetUploadUrlRequest = {
        filename: 'deck.apkg',
        content_type: 'application/zip',
      }

      const result = await apiClient.getUploadUrl(TEST_TOKEN, data)

      expect(result.upload_url).toBeDefined()
      expect(result.file_key).toBeDefined()
    })

    it('importAnkiDeck calls POST /api/import/anki', async () => {
      const data: ImportAnkiRequest = {
        file_key: 'uploads/deck.apkg',
        filename: 'deck.apkg',
      }

      const result = await apiClient.importAnkiDeck(TEST_TOKEN, data)

      expect(result.import_id).toBeDefined()
      expect(result.status).toBe('processing')
    })
  })

  describe('debug endpoints', () => {
    beforeEach(() => {
      server.use(
        http.post(`${API_BASE}/debug/reset-daily-reviews`, () => {
          return HttpResponse.json({
            message: 'Daily review counts reset',
            new_items_added: 20,
          })
        }),
      )
    })

    it('resetDailyReviews calls POST /api/debug/reset-daily-reviews', async () => {
      const result = await apiClient.resetDailyReviews(TEST_TOKEN)

      expect(result.message).toBeDefined()
    })
  })
})
