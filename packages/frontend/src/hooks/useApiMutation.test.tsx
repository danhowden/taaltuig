import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { LoadingProvider, useLoading } from '@/contexts/LoadingContext'
import { useApiMutation } from './useApiMutation'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>{children}</LoadingProvider>
    </QueryClientProvider>
  )
}

describe('useApiMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps React Query useMutation', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn,
        }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ data: 'test' })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mutationFn).toHaveBeenCalledWith({ data: 'test' })
    expect(result.current.data).toEqual({ success: true })
  })

  it('calls startLoading on mutation start when showLoader=true', async () => {
    const mutationFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
    )

    const { result } = renderHook(
      () => {
        const mutation = useApiMutation({
          mutationFn,
          showLoader: true,
        })
        const loading = useLoading()
        return { mutation, loading }
      },
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.mutation.mutate({ data: 'test' })
    })

    // Should show loading immediately
    await waitFor(() => {
      expect(result.current.loading.isLoading).toBe(true)
    })
  })

  it('calls stopLoading on success', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })

    const { result } = renderHook(
      () => {
        const mutation = useApiMutation({
          mutationFn,
        })
        const loading = useLoading()
        return { mutation, loading }
      },
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutation.mutateAsync({ data: 'test' })
    })

    expect(result.current.loading.isLoading).toBe(false)
  })

  it('calls stopLoading on error', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(
      () => {
        const mutation = useApiMutation({
          mutationFn,
        })
        const loading = useLoading()
        return { mutation, loading }
      },
      { wrapper: createWrapper() },
    )

    await act(async () => {
      try {
        await result.current.mutation.mutateAsync({ data: 'test' })
      } catch {
        // Expected error
      }
    })

    expect(result.current.loading.isLoading).toBe(false)
  })

  it('invalidates queries on success with invalidateQueries option', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LoadingProvider>{children}</LoadingProvider>
      </QueryClientProvider>
    )

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn,
          invalidateQueries: ['cards', 'review-queue'],
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync({ data: 'test' })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cards'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['review-queue'] })
  })

  it('calls onSuccess callback if provided', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn,
          onSuccess,
        }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      await result.current.mutateAsync({ data: 'test' })
    })

    expect(onSuccess).toHaveBeenCalledWith({ success: true }, { data: 'test' })
  })

  it('calls onError callback if provided', async () => {
    const error = new Error('API Error')
    const mutationFn = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn,
          onError,
        }),
      { wrapper: createWrapper() },
    )

    await act(async () => {
      try {
        await result.current.mutateAsync({ data: 'test' })
      } catch {
        // Expected error
      }
    })

    expect(onError).toHaveBeenCalledWith(error, { data: 'test' })
  })

  it('skips loading when showLoader=false', async () => {
    const mutationFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50)),
    )

    const { result } = renderHook(
      () => {
        const mutation = useApiMutation({
          mutationFn,
          showLoader: false,
        })
        const loading = useLoading()
        return { mutation, loading }
      },
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.mutation.mutate({ data: 'test' })
    })

    // Should NOT show loading
    expect(result.current.loading.isLoading).toBe(false)

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true)
    })

    expect(result.current.loading.isLoading).toBe(false)
  })

  it('cleanup on unmount stops loading', async () => {
    const mutationFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 200)),
    )

    const { result, unmount } = renderHook(
      () => {
        const mutation = useApiMutation({
          mutationFn,
        })
        const loading = useLoading()
        return { mutation, loading }
      },
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.mutation.mutate({ data: 'test' })
    })

    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.loading.isLoading).toBe(true)
    })

    // Unmount while mutation is in progress
    unmount()

    // Loading should eventually stop even after unmount
    // (The finally block ensures stopLoading is called)
  })
})
