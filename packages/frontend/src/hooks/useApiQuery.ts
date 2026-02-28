import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLoading } from '@/contexts/LoadingContext'

/**
 * Custom hook wrapper for API queries with global loading state
 *
 * @example
 * const { data, isLoading } = useApiQuery({
 *   queryKey: ['cards'],
 *   queryFn: async () => apiClient.listCards(token),
 *   enabled: !!token,
 * })
 */
export function useApiQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError>
) {
  const { startLoading, stopLoading } = useLoading()

  const query = useQuery(options)

  // Track loading state globally
  useEffect(() => {
    if (query.isFetching) {
      startLoading()
      return () => {
        stopLoading()
      }
    }
  }, [query.isFetching, startLoading, stopLoading])

  return query
}
