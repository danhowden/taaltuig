/**
 * API Client Configuration
 *
 * Centralized API client for making requests to the Taaltuig backend.
 * All types are synced with OpenAPI spec at /docs/design/backend/openapi.yaml
 */

import type {
  SidebarCountsResponse,
  GetCurrentUserResponse,
  QueueResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  UserSettings,
  ListCardsResponse,
  ListCardsParams,
  PaginatedListCardsResponse,
  CreateCardRequest,
  CreateCardResponse,
  UpdateCardRequest,
  UpdateCardResponse,
  DeleteCardResponse,
  RenameCategoryRequest,
  RenameCategoryResponse,
  GetUploadUrlRequest,
  GetUploadUrlResponse,
  ImportAnkiRequest,
  ImportAnkiResponse,
  ResetDailyReviewsResponse,
  ClearInsightsResponse,
  ApiError,
  GenerateInsightsRequest,
  GenerateInsightsResponse,
  ValidateInsightsRequest,
  ValidateInsightsResponse,
  ReviewInsightRequest,
  ReviewInsightResponse,
  InsightsQueueResponse,
  InsightsMetricsResponse,
  WritingQueueResponse,
  SubmitWritingRequest,
  SubmitWritingResponse,
  GenerateExercisesRequest,
  GenerateExercisesResponse,
  CardExerciseLink,
  StoredWritingExercise,
  ChallengeWritingRequest,
  ChallengeWritingResponse,
  ExerciseSummaryResponse,
  ExerciseCatalogResponse,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        // Try to parse error response body
        let errorBody: ApiError | null = null
        try {
          errorBody = await response.json()
        } catch {
          // Ignore JSON parse errors
        }

        const error: ApiError = errorBody || {
          error: `API request failed: ${response.statusText}`,
          code: `HTTP_${response.status}`,
        }
        throw error
      }

      // Handle 204 No Content (e.g., DELETE operations)
      if (response.status === 204) {
        return {} as T
      }

      return response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ============================================================================
  // Sidebar counts (lightweight, single call)
  // ============================================================================

  async getSidebarCounts(token: string): Promise<SidebarCountsResponse> {
    return this.request<SidebarCountsResponse>('/api/counts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  // ============================================================================
  // Auth endpoints
  // ============================================================================

  async getCurrentUser(token: string): Promise<GetCurrentUserResponse> {
    return this.request<GetCurrentUserResponse>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  // ============================================================================
  // Review endpoints
  // ============================================================================

  async getReviewQueue(
    token: string,
    options?: { all?: boolean; extraNew?: number }
  ): Promise<QueueResponse> {
    const params = new URLSearchParams()
    if (options?.all) params.append('all', 'true')
    if (options?.extraNew) params.append('extra_new', options.extraNew.toString())

    const url = params.toString()
      ? `/api/reviews/queue?${params.toString()}`
      : '/api/reviews/queue'

    return this.request<QueueResponse>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async submitReview(
    token: string,
    data: SubmitReviewRequest
  ): Promise<SubmitReviewResponse> {
    return this.request<SubmitReviewResponse>('/api/reviews/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  // ============================================================================
  // Settings endpoints
  // ============================================================================

  async getSettings(token: string): Promise<UserSettings> {
    const response = await this.request<{ settings: UserSettings }>('/api/settings', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.settings
  }

  async updateSettings(
    token: string,
    settings: Partial<UserSettings>
  ): Promise<UserSettings> {
    const response = await this.request<{ settings: UserSettings }>('/api/settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    })
    return response.settings
  }

  // ============================================================================
  // Card endpoints
  // ============================================================================

  async listCards(token: string): Promise<ListCardsResponse> {
    return this.request<ListCardsResponse>('/api/cards', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async listCardsPaginated(
    token: string,
    params?: ListCardsParams
  ): Promise<PaginatedListCardsResponse> {
    const searchParams = new URLSearchParams()

    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.cursor) searchParams.append('cursor', params.cursor)
    if (params?.category) searchParams.append('category', params.category)
    if (params?.insightStatus) searchParams.append('insight_status', params.insightStatus)
    if (params?.search) searchParams.append('search', params.search)

    const queryString = searchParams.toString()
    const url = queryString ? `/api/cards?${queryString}` : '/api/cards?limit=50'

    return this.request<PaginatedListCardsResponse>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async createCard(
    token: string,
    data: CreateCardRequest
  ): Promise<CreateCardResponse> {
    return this.request<CreateCardResponse>('/api/cards', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async updateCard(
    token: string,
    cardId: string,
    data: UpdateCardRequest
  ): Promise<UpdateCardResponse> {
    return this.request<UpdateCardResponse>(`/api/cards/${cardId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async deleteCard(token: string, cardId: string): Promise<DeleteCardResponse> {
    return this.request<DeleteCardResponse>(`/api/cards/${cardId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  // ============================================================================
  // Category endpoints
  // ============================================================================

  async renameCategory(
    token: string,
    data: RenameCategoryRequest
  ): Promise<RenameCategoryResponse> {
    return this.request<RenameCategoryResponse>('/api/categories/rename', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  // ============================================================================
  // Anki import endpoints
  // ============================================================================

  async getUploadUrl(
    token: string,
    data: GetUploadUrlRequest
  ): Promise<GetUploadUrlResponse> {
    return this.request<GetUploadUrlResponse>('/api/import/upload-url', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async importAnkiDeck(
    token: string,
    data: ImportAnkiRequest
  ): Promise<ImportAnkiResponse> {
    return this.request<ImportAnkiResponse>('/api/import/anki', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  // ============================================================================
  // Debug endpoints
  // ============================================================================

  async resetDailyReviews(
    token: string
  ): Promise<ResetDailyReviewsResponse> {
    return this.request<ResetDailyReviewsResponse>(
      '/api/debug/reset-daily-reviews',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
  }

  async clearInsights(token: string): Promise<ClearInsightsResponse> {
    return this.request<ClearInsightsResponse>('/api/debug/clear-insights', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  // ============================================================================
  // Insights endpoints
  // ============================================================================

  async generateInsights(
    token: string,
    data: GenerateInsightsRequest
  ): Promise<GenerateInsightsResponse> {
    return this.request<GenerateInsightsResponse>('/api/insights/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async validateInsights(
    token: string,
    data: ValidateInsightsRequest
  ): Promise<ValidateInsightsResponse> {
    return this.request<ValidateInsightsResponse>('/api/insights/validate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async getInsightsQueue(
    token: string,
    status?: 'pending' | 'ai_approved' | 'all'
  ): Promise<InsightsQueueResponse> {
    const params = new URLSearchParams()
    if (status) params.append('status', status)

    const url = params.toString()
      ? `/api/insights/queue?${params.toString()}`
      : '/api/insights/queue'

    return this.request<InsightsQueueResponse>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async reviewInsight(
    token: string,
    cardId: string,
    data: ReviewInsightRequest
  ): Promise<ReviewInsightResponse> {
    return this.request<ReviewInsightResponse>(
      `/api/insights/${cardId}/review`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    )
  }

  // ============================================================================
  // Metrics endpoints
  // ============================================================================

  async getInsightsMetrics(
    token: string,
    period: 'hour' | 'day' | 'week' = 'day'
  ): Promise<InsightsMetricsResponse> {
    return this.request<InsightsMetricsResponse>(
      `/api/metrics/insights?period=${period}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
  }
  // ============================================================================
  // Writing exercise endpoints
  // ============================================================================

  async getWritingQueue(token: string): Promise<WritingQueueResponse> {
    return this.request<WritingQueueResponse>('/api/writing/queue', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async getWritingQueueCount(token: string): Promise<WritingQueueResponse> {
    return this.request<WritingQueueResponse>('/api/writing/queue?mode=count', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async submitWritingAttempt(
    token: string,
    data: SubmitWritingRequest
  ): Promise<SubmitWritingResponse> {
    return this.request<SubmitWritingResponse>('/api/writing/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async generateWritingExercises(
    token: string,
    data: GenerateExercisesRequest
  ): Promise<GenerateExercisesResponse> {
    return this.request<GenerateExercisesResponse>('/api/writing/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  }

  async getExercisesForCard(
    token: string,
    cardId: string
  ): Promise<CardExerciseLink[]> {
    return this.request<CardExerciseLink[]>(
      `/api/writing/exercises?card_id=${encodeURIComponent(cardId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
  }

  async resetExercise(token: string, exerciseId: string): Promise<{ exercise_id: string }> {
    return this.request<{ exercise_id: string }>('/api/writing/exercises', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ exercise_id: exerciseId }),
    })
  }

  async rejectExercise(token: string, exerciseId: string, reason: string): Promise<{ exercise_id: string }> {
    return this.request<{ exercise_id: string }>('/api/writing/exercises', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ exercise_id: exerciseId, reason }),
    })
  }

  async clearIncompleteExercises(token: string): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/api/writing/exercises', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async challengeWritingAssessment(
    token: string,
    data: ChallengeWritingRequest
  ): Promise<ChallengeWritingResponse> {
    return this.request<ChallengeWritingResponse>('/api/writing/challenge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  async getExercisesList(
    token: string,
    params?: { status?: string; type?: string }
  ): Promise<StoredWritingExercise[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.type) searchParams.set('type', params.type)
    const query = searchParams.toString()
    return this.request<StoredWritingExercise[]>(
      `/api/writing/exercises${query ? `?${query}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
  }
  async getExerciseCatalog(
    token: string,
    params: { topic?: string; level?: string; type?: string; due_only?: boolean }
  ): Promise<ExerciseCatalogResponse> {
    const searchParams = new URLSearchParams()
    if (params.topic) searchParams.set('topic', params.topic)
    if (params.level) searchParams.set('level', params.level)
    if (params.type) searchParams.set('type', params.type)
    if (params.due_only) searchParams.set('due_only', 'true')
    return this.request<ExerciseCatalogResponse>(
      `/api/exercises/catalog?${searchParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
  }

  async recordExerciseAttempt(
    token: string,
    attempt: { exercise_id: string; topic_id: string; result: 'correct' | 'incorrect' | 'skipped' }
  ): Promise<void> {
    await this.request<{ ok: boolean }>(
      '/api/exercises/attempt',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt),
      }
    )
  }

  async getExerciseSummary(
    token: string,
    level: string
  ): Promise<ExerciseSummaryResponse> {
    return this.request<ExerciseSummaryResponse>(
      `/api/exercises/summary?level=${encodeURIComponent(level)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
