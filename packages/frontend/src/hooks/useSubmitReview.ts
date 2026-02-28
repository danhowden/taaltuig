import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import type { SubmitReviewRequest, SubmitReviewResponse, QueueResponse } from '@/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useSubmitReview() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    SubmitReviewResponse,
    Error,
    SubmitReviewRequest,
    { previousQueue: QueueResponse | undefined }
  >({
    mutationFn: async (data) => {
      if (!token) throw new Error('No authentication token')
      return apiClient.submitReview(token, data)
    },
    onMutate: async () => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['review-queue'] })

      // Snapshot the previous value
      const previousQueue = queryClient.getQueryData<QueueResponse>(['review-queue'])

      // Optimistically update by decrementing the count
      if (previousQueue?.stats && previousQueue.stats.total_count !== undefined) {
        queryClient.setQueryData<QueueResponse>(['review-queue'], {
          ...previousQueue,
          stats: {
            ...previousQueue.stats,
            total_count: Math.max(0, previousQueue.stats.total_count - 1),
          },
        })
      }

      // Return context with previous value for potential rollback
      return { previousQueue }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(['review-queue'], context.previousQueue)
      }
    },
    // No onSettled - optimistic updates keep the count accurate
    // Query will naturally refetch when user navigates away or on window focus
  })
}
