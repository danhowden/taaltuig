import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { LandingPage } from './LandingPage'
import { renderWithProviders } from '@/test/utils'

describe('LandingPage', () => {
  it('renders the logo', () => {
    renderWithProviders(<LandingPage />)

    expect(screen.getByText('Taaltuig')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    renderWithProviders(<LandingPage />)

    expect(
      screen.getByText('Master Dutch with spaced repetition'),
    ).toBeInTheDocument()
  })

  it('renders Get Started link to login', () => {
    renderWithProviders(<LandingPage />)

    const link = screen.getByRole('link', { name: /get started/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })
})
