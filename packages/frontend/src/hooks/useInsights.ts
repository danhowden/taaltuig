import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useApiQuery } from './useApiQuery'
import { useApiMutation } from './useApiMutation'
import type {
  GenerateInsightsRequest,
  GenerateInsightsResponse,
  ValidateInsightsRequest,
  ValidateInsightsResponse,
  ReviewInsightRequest,
  ReviewInsightResponse,
  InsightsQueueResponse,
} from '@/types'

/**
 * Hook to fetch the insights review queue
 */
export function useInsightsQueue(
  status?: 'pending' | 'ai_approved' | 'all',
  enabled = true
) {
  const { token } = useAuth()

  return useApiQuery<InsightsQueueResponse>({
    queryKey: ['insights-queue', status],
    queryFn: async () => apiClient.getInsightsQueue(token!, status),
    enabled: !!token && enabled,
  })
}

/**
 * Hook to generate insights for cards
 */
export function useGenerateInsights() {
  const { token } = useAuth()

  return useApiMutation<GenerateInsightsResponse, GenerateInsightsRequest>({
    mutationFn: async (data) => apiClient.generateInsights(token!, data),
    invalidateQueries: ['cards', 'insights-queue'],
  })
}

/**
 * Hook to validate pending insights
 */
export function useValidateInsights() {
  const { token } = useAuth()

  return useApiMutation<ValidateInsightsResponse, ValidateInsightsRequest>({
    mutationFn: async (data) => apiClient.validateInsights(token!, data),
    invalidateQueries: ['cards', 'insights-queue'],
  })
}

interface ReviewInsightParams extends ReviewInsightRequest {
  cardId: string
}

/**
 * Hook to review a single insight (approve/reject/edit)
 */
export function useReviewInsight() {
  const { token } = useAuth()

  return useApiMutation<ReviewInsightResponse, ReviewInsightParams>({
    mutationFn: async ({ cardId, ...data }) =>
      apiClient.reviewInsight(token!, cardId, data),
    invalidateQueries: ['cards', 'insights-queue', 'review-queue'],
  })
}
