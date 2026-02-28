import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GlobalLoadingIndicator } from './GlobalLoadingIndicator'
import * as LoadingContext from '@/contexts/LoadingContext'

describe('GlobalLoadingIndicator', () => {
  it('renders nothing when not loading', () => {
    vi.spyOn(LoadingContext, 'useLoading').mockReturnValue({
      isLoading: false,
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    })

    const { container } = render(<GlobalLoadingIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders indicator when loading', () => {
    vi.spyOn(LoadingContext, 'useLoading').mockReturnValue({
      isLoading: true,
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    })

    const { container } = render(<GlobalLoadingIndicator />)
    expect(container.firstChild).not.toBeNull()
  })

  it('hides when loading stops', () => {
    const mockLoading = vi.spyOn(LoadingContext, 'useLoading')

    mockLoading.mockReturnValue({
      isLoading: true,
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    })

    const { container, rerender } = render(<GlobalLoadingIndicator />)
    expect(container.firstChild).not.toBeNull()

    mockLoading.mockReturnValue({
      isLoading: false,
      startLoading: vi.fn(),
      stopLoading: vi.fn(),
    })

    rerender(<GlobalLoadingIndicator />)
    expect(container.firstChild).toBeNull()
  })
})
