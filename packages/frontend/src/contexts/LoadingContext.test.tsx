import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LoadingProvider, useLoading } from './LoadingContext'

describe('LoadingContext', () => {
  it('initial loading state is false', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('startLoading increments counter and sets isLoading true', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    act(() => {
      result.current.startLoading()
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('stopLoading decrements counter', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    act(() => {
      result.current.startLoading()
      result.current.stopLoading()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('multiple startLoading calls require matching stopLoading calls', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    act(() => {
      result.current.startLoading()
      result.current.startLoading()
      result.current.startLoading()
    })

    expect(result.current.isLoading).toBe(true)

    act(() => {
      result.current.stopLoading()
    })

    expect(result.current.isLoading).toBe(true)

    act(() => {
      result.current.stopLoading()
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading becomes false only when counter reaches 0', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    act(() => {
      result.current.startLoading()
      result.current.startLoading()
    })

    expect(result.current.isLoading).toBe(true)

    act(() => {
      result.current.stopLoading()
      result.current.stopLoading()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('counter never goes below 0', () => {
    const { result } = renderHook(() => useLoading(), {
      wrapper: LoadingProvider,
    })

    act(() => {
      result.current.stopLoading()
      result.current.stopLoading()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useLoading())
    }).toThrow('useLoading must be used within LoadingProvider')
  })
})
