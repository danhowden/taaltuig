import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewHeader } from './ReviewHeader'

describe('ReviewHeader', () => {
  it('renders title', () => {
    render(<ReviewHeader totalCards={10} reviewedCount={1} againCount={0} againReviewed={0} />)
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('displays remaining cards count', () => {
    render(<ReviewHeader totalCards={10} reviewedCount={5} againCount={0} againReviewed={0} />)
    expect(screen.getByText('to go')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('includes AGAIN cards in remaining count', () => {
    // 10 cards + 2 AGAIN = 12 total reviews, 8 completed = 4 remaining
    render(<ReviewHeader totalCards={10} reviewedCount={8} againCount={2} againReviewed={1} />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows 0 when all cards completed', () => {
    render(<ReviewHeader totalCards={10} reviewedCount={10} againCount={0} againReviewed={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('updates when props change', () => {
    const { rerender } = render(<ReviewHeader totalCards={10} reviewedCount={1} againCount={0} againReviewed={0} />)
    expect(screen.getByText('9')).toBeInTheDocument()

    rerender(<ReviewHeader totalCards={10} reviewedCount={5} againCount={0} againReviewed={0} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
