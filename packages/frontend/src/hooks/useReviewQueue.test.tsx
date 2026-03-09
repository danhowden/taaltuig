import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { useReviewQueue } from './useReviewQueue'

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}))

// Mock apiClient
const mockGetReviewQueue = vi.fn()
vi.mock('@/lib/api', () => ({
  apiClient: {
    getReviewQueue: (...args: unknown[]) => mockGetReviewQueue(...args),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>{children}</LoadingProvider>
    </QueryClientProvider>
  )
}

describe('useReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ token: 'test-token-123' })
  })

  it('fetches review queue with token', async () => {
    const mockData = {
      items: [{ review_item_id: '1', front: 'huis', back: 'house' }],
      stats: { due_count: 5, new_count: 3, learning_count: 1, total_count: 9, new_remaining_today: 3 },
    }
    mockGetReviewQueue.mockResolvedValue(mockData)

    const { result } = renderHook(() => useReviewQueue(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGetReviewQueue).toHaveBeenCalledWith('test-token-123')
  })

  it('handles API errors', async () => {
    mockGetReviewQueue.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useReviewQueue(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error('Network error'))
  })

  it('does not fetch when token is null', () => {
    mockUseAuth.mockReturnValue({ token: null })

    const { result } = renderHook(() => useReviewQueue(), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetReviewQueue).not.toHaveBeenCalled()
  })

  it('returns loading state while fetching', async () => {
    mockGetReviewQueue.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ items: [], stats: {} }), 100)),
    )

    const { result } = renderHook(() => useReviewQueue(), { wrapper: createWrapper() })

    // Initially should be loading
    await waitFor(() => {
      expect(result.current.isFetching).toBe(true)
    })

    expect(result.current.data).toBeUndefined()
  })
})
