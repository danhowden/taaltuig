import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'
import type { SidebarCountsResponse } from '@/types'

export function useSidebarCounts() {
  const { token } = useAuth()

  return useApiQuery<SidebarCountsResponse>({
    queryKey: ['sidebar-counts'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token')
      return apiClient.getSidebarCounts(token)
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}
