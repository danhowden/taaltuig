import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLoading } from '@/contexts/LoadingContext'

interface ApiMutationOptions<TData, TVariables, TError = Error> {
  mutationFn: (variables: TVariables) => Promise<TData>
  invalidateQueries?: string[]
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: TError, variables: TVariables) => void
  showLoader?: boolean // Whether to show global loading indicator (default: true)
}

/**
 * Custom hook wrapper for API mutations with global loading state
 *
 * @example
 * const createCardMutation = useApiMutation({
 *   mutationFn: async (data) => apiClient.createCard(token, data),
 *   invalidateQueries: ['cards'],
 * })
 */
export function useApiMutation<TData = unknown, TVariables = void, TError = Error>(
  options: ApiMutationOptions<TData, TVariables, TError>
) {
  const { startLoading, stopLoading } = useLoading()
  const queryClient = useQueryClient()
  const showLoader = options.showLoader ?? true

  return useMutation<TData, TError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (showLoader) startLoading()
      try {
        return await options.mutationFn(variables)
      } finally {
        if (showLoader) stopLoading()
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate queries if specified
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      }

      // Call original onSuccess if provided
      if (options.onSuccess) {
        options.onSuccess(data, variables)
      }
    },
    onError: (error, variables) => {
      if (options.onError) {
        options.onError(error, variables)
      }
    },
  })
}
