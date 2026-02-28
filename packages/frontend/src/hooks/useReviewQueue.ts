import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'
import type { QueueResponse } from '@/types'

export function useReviewQueue() {
  const { token } = useAuth()

  return useApiQuery<QueueResponse>({
    queryKey: ['review-queue'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token')
      return apiClient.getReviewQueue(token)
    },
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}
