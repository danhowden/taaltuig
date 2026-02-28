import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useApiQuery } from './useApiQuery'
import type { UserSettings } from '@/types'

/**
 * Hook to fetch user settings
 */
export function useSettings() {
  const { token } = useAuth()

  return useApiQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => apiClient.getSettings(token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // Settings don't change often, cache for 5 minutes
  })
}
