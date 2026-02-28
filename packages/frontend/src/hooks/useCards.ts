import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useApiQuery } from './useApiQuery'
import { useApiMutation } from './useApiMutation'
import { useQueryClient } from '@tanstack/react-query'
import type {
  ListCardsResponse,
  CreateCardRequest,
  CreateCardResponse,
  UpdateCardRequest,
  UpdateCardResponse,
  DeleteCardResponse,
  RenameCategoryRequest,
  RenameCategoryResponse,
} from '@/types'

/**
 * Hook to fetch cards list
 */
export function useCards() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useApiQuery<ListCardsResponse>({
    queryKey: ['cards'],
    queryFn: async () => apiClient.listCards(token!),
    enabled: !!token,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cards'] })
  }

  return {
    ...query,
    cards: query.data?.cards || [],
    invalidate,
  }
}

/**
 * Hook to create a new card
 */
export function useCreateCard() {
  const { token } = useAuth()

  return useApiMutation<CreateCardResponse, CreateCardRequest>({
    mutationFn: async (data) => apiClient.createCard(token!, data),
    invalidateQueries: ['cards'],
  })
}

/**
 * Hook to update a card
 */
export function useUpdateCard() {
  const { token } = useAuth()

  return useApiMutation<UpdateCardResponse, { cardId: string; data: UpdateCardRequest }>({
    mutationFn: async ({ cardId, data }) => apiClient.updateCard(token!, cardId, data),
    invalidateQueries: ['cards'],
  })
}

/**
 * Hook to delete a card
 */
export function useDeleteCard() {
  const { token } = useAuth()

  return useApiMutation<DeleteCardResponse, string>({
    mutationFn: async (cardId) => apiClient.deleteCard(token!, cardId),
    invalidateQueries: ['cards'],
  })
}

/**
 * Hook to rename a category
 */
export function useRenameCategory() {
  const { token } = useAuth()

  return useApiMutation<RenameCategoryResponse, RenameCategoryRequest>({
    mutationFn: async (data) => apiClient.renameCategory(token!, data),
    invalidateQueries: ['cards', 'settings'],
  })
}
