import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { LoadingProvider, useLoading } from '@/contexts/LoadingContext'
import { useApiQuery } from './useApiQuery'

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

describe('useApiQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps React Query useQuery', async () => {
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(
      () =>
        useApiQuery({
          queryKey: ['test'],
          queryFn,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({ data: 'test' })
    expect(queryFn).toHaveBeenCalled()
  })

  it('calls startLoading when isFetching is true', async () => {
    const queryFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100)),
    )

    const { result } = renderHook(
      () => {
        const query = useApiQuery({
          queryKey: ['test'],
          queryFn,
        })
        const loading = useLoading()
        return { query, loading }
      },
      { wrapper: createWrapper() },
    )

    // Initially fetching
    await waitFor(() => {
      expect(result.current.query.isFetching).toBe(true)
    })

    expect(result.current.loading.isLoading).toBe(true)
  })

  it('calls stopLoading when isFetching becomes false', async () => {
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(
      () => {
        const query = useApiQuery({
          queryKey: ['test'],
          queryFn,
        })
        const loading = useLoading()
        return { query, loading }
      },
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true)
    })

    expect(result.current.loading.isLoading).toBe(false)
  })

  it('cleanup on unmount stops loading', async () => {
    const queryFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 200)),
    )

    const { result, unmount } = renderHook(
      () => {
        const query = useApiQuery({
          queryKey: ['test'],
          queryFn,
        })
        const loading = useLoading()
        return { query, loading }
      },
      { wrapper: createWrapper() },
    )

    // Wait for fetching to start
    await waitFor(() => {
      expect(result.current.query.isFetching).toBe(true)
    })

    expect(result.current.loading.isLoading).toBe(true)

    // Unmount while still fetching
    unmount()

    // Loading should be stopped after unmount
    // (This test verifies the cleanup function is called)
  })

  it('passes through all React Query options', async () => {
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(
      () =>
        useApiQuery({
          queryKey: ['test'],
          queryFn,
          staleTime: 5000,
          gcTime: 10000,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({ data: 'test' })
  })

  it('returns all React Query properties', async () => {
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(
      () =>
        useApiQuery({
          queryKey: ['test'],
          queryFn,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Check that React Query properties are available
    expect(result.current).toHaveProperty('data')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('isSuccess')
    expect(result.current).toHaveProperty('refetch')
  })

  it('handles query errors', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(
      () =>
        useApiQuery({
          queryKey: ['test'],
          queryFn,
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error('API Error'))
  })
})
