import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewTitle, ReviewProgress } from './ReviewHeader'

describe('ReviewTitle', () => {
  it('renders title', () => {
    render(<ReviewTitle />)
    expect(screen.getByText('Review')).toBeInTheDocument()
  })
})

describe('ReviewProgress', () => {
  it('displays remaining cards count', () => {
    render(<ReviewProgress totalCards={10} reviewedCount={5} againCount={0} againReviewed={0} />)
    expect(screen.getByText('to go')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('includes AGAIN cards in remaining count', () => {
    // 10 cards + 2 AGAIN = 12 total reviews, 8 completed = 4 remaining
    render(<ReviewProgress totalCards={10} reviewedCount={8} againCount={2} againReviewed={1} />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows 0 when all cards completed', () => {
    render(<ReviewProgress totalCards={10} reviewedCount={10} againCount={0} againReviewed={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('updates when props change', () => {
    const { rerender } = render(<ReviewProgress totalCards={10} reviewedCount={1} againCount={0} againReviewed={0} />)
    expect(screen.getByText('9')).toBeInTheDocument()

    rerender(<ReviewProgress totalCards={10} reviewedCount={5} againCount={0} againReviewed={0} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
