/**
 * API Client Configuration
 *
 * Centralized API client for making requests to the Taaltuig backend.
 * All types are synced with OpenAPI spec at /docs/design/backend/openapi.yaml
 */

import type {
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

    const response = await fetch(url, {
      ...options,
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
}

export const apiClient = new ApiClient(API_BASE_URL)
