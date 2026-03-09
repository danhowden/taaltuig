import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useSubmitReview } from './useSubmitReview'

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}))

// Mock apiClient
const mockSubmitReview = vi.fn()
vi.mock('@/lib/api', () => ({
  apiClient: {
    submitReview: (...args: unknown[]) => mockSubmitReview(...args),
  },
}))

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useSubmitReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ token: 'test-token-123' })
  })

  it('submits review with token', async () => {
    const mockResponse = { success: true, next_review: '2024-01-16' }
    mockSubmitReview.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() })

    const reviewData = {
      review_item_id: 'ri-1',
      grade: 3,
      duration_ms: 5000,
    }

    await act(async () => {
      await result.current.mutateAsync(reviewData)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockResponse)
    expect(mockSubmitReview).toHaveBeenCalledWith('test-token-123', reviewData)
  })

  it('throws when token is missing', async () => {
    mockUseAuth.mockReturnValue({ token: null })

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          review_item_id: 'ri-1',
          grade: 3,
          duration_ms: 5000,
        })
      } catch (error) {
        expect((error as Error).message).toBe('No authentication token')
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('handles API errors', async () => {
    mockSubmitReview.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          review_item_id: 'ri-1',
          grade: 3,
          duration_ms: 5000,
        })
      } catch {
        // Expected
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error('Server error'))
  })

  it('optimistically decrements total_count on mutate', async () => {
    mockSubmitReview.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 200)),
    )

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    // Pre-populate cache with queue data
    queryClient.setQueryData(['review-queue'], {
      items: [{ review_item_id: 'ri-1' }],
      stats: { due_count: 5, new_count: 3, learning_count: 1, total_count: 9, new_remaining_today: 3 },
    })

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({
        review_item_id: 'ri-1',
        grade: 3,
        duration_ms: 5000,
      })
    })

    // Check optimistic update happened
    await waitFor(() => {
      const cachedData = queryClient.getQueryData<{ stats: { total_count: number } }>(['review-queue'])
      expect(cachedData?.stats.total_count).toBe(8)
    })
  })

  it('rolls back optimistic update on error', async () => {
    mockSubmitReview.mockRejectedValue(new Error('Server error'))

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    const originalData = {
      items: [{ review_item_id: 'ri-1' }],
      stats: { due_count: 5, new_count: 3, learning_count: 1, total_count: 9, new_remaining_today: 3 },
    }
    queryClient.setQueryData(['review-queue'], originalData)

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          review_item_id: 'ri-1',
          grade: 3,
          duration_ms: 5000,
        })
      } catch {
        // Expected
      }
    })

    // Should have rolled back to original data
    const cachedData = queryClient.getQueryData(['review-queue'])
    expect(cachedData).toEqual(originalData)
  })

  it('handles optimistic update when no cached queue data', async () => {
    mockSubmitReview.mockResolvedValue({ success: true })

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync({
        review_item_id: 'ri-1',
        grade: 3,
        duration_ms: 5000,
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})
