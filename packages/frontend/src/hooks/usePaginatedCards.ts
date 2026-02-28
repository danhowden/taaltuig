import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { apiClient } from '@/lib/api'
import type { Card, PaginatedListCardsResponse } from '@/types'

export type InsightStatusFilter = 'none' | 'pending' | 'approved' | 'rejected' | 'any'

interface UsePaginatedCardsOptions {
  search?: string
  insightStatus?: InsightStatusFilter
  category?: string
  pageSize?: number
  enabled?: boolean
}

/**
 * Hook for fetching cards with infinite pagination
 *
 * Uses React Query's useInfiniteQuery to fetch cards page by page.
 * Cards are accumulated across pages and can be filtered by search,
 * insight status, and category.
 */
export function usePaginatedCards(options: UsePaginatedCardsOptions = {}) {
  const { token } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  const queryClient = useQueryClient()

  const { search, insightStatus, category, pageSize = 50, enabled = true } = options

  const query = useInfiniteQuery<PaginatedListCardsResponse>({
    queryKey: ['cards-paginated', { search, insightStatus, category, pageSize }],
    queryFn: async ({ pageParam }) => {
      return apiClient.listCardsPaginated(token!, {
        limit: pageSize,
        cursor: pageParam as string | undefined,
        search: search || undefined,
        insightStatus: insightStatus || undefined,
        category: category || undefined,
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined
      return lastPage.pagination.hasMore ? lastPage.pagination.cursor : undefined
    },
    enabled: !!token && enabled,
    staleTime: 30000, // 30 seconds
  })

  // Auto-fetch all pages to get complete card list
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isLoading) {
      query.fetchNextPage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Using specific properties to avoid infinite loop
  }, [query.hasNextPage, query.isFetchingNextPage, query.isLoading, query.data, query.fetchNextPage])

  // Track loading state globally (while any fetching is happening)
  useEffect(() => {
    if (query.isFetching) {
      startLoading()
      return () => {
        stopLoading()
      }
    }
  }, [query.isFetching, startLoading, stopLoading])

  // Flatten all pages into a single array of cards
  const cards = useMemo<Card[]>(() => {
    if (!query.data?.pages) return []
    return query.data.pages.flatMap((page) => page.cards)
  }, [query.data?.pages])

  // Invalidate cards queries (both paginated and legacy)
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cards-paginated'] })
    queryClient.invalidateQueries({ queryKey: ['cards'] })
  }

  return {
    cards,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
    invalidate,
  }
}
