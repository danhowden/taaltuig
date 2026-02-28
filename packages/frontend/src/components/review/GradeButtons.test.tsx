import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { GradeButtons } from './GradeButtons'

describe('GradeButtons', () => {
  it('renders all 4 grade buttons', () => {
    render(<GradeButtons disabled={false} onGrade={vi.fn()} />)

    expect(screen.getByRole('button', { name: /again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /good/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
  })

  it('calls onGrade with correct value when Again is clicked', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()

    render(<GradeButtons disabled={false} onGrade={onGrade} />)

    const button = screen.getByRole('button', { name: /again/i })
    await user.click(button)

    expect(onGrade).toHaveBeenCalledWith(0)
  })

  it('calls onGrade with correct value when Hard is clicked', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()

    render(<GradeButtons disabled={false} onGrade={onGrade} />)

    const button = screen.getByRole('button', { name: /hard/i })
    await user.click(button)

    expect(onGrade).toHaveBeenCalledWith(2)
  })

  it('calls onGrade with correct value when Good is clicked', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()

    render(<GradeButtons disabled={false} onGrade={onGrade} />)

    const button = screen.getByRole('button', { name: /good/i })
    await user.click(button)

    expect(onGrade).toHaveBeenCalledWith(3)
  })

  it('calls onGrade with correct value when Easy is clicked', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()

    render(<GradeButtons disabled={false} onGrade={onGrade} />)

    const button = screen.getByRole('button', { name: /easy/i })
    await user.click(button)

    expect(onGrade).toHaveBeenCalledWith(4)
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<GradeButtons disabled={true} onGrade={vi.fn()} />)

    expect(screen.getByRole('button', { name: /again/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /hard/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /good/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /easy/i })).toBeDisabled()
  })

  it('does not call onGrade when buttons are disabled', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()

    render(<GradeButtons disabled={true} onGrade={onGrade} />)

    const button = screen.getByRole('button', { name: /good/i })
    await user.click(button)

    expect(onGrade).not.toHaveBeenCalled()
  })

  it('enables buttons when disabled prop changes to false', () => {
    const { rerender } = render(<GradeButtons disabled={true} onGrade={vi.fn()} />)

    expect(screen.getByRole('button', { name: /good/i })).toBeDisabled()

    rerender(<GradeButtons disabled={false} onGrade={vi.fn()} />)

    expect(screen.getByRole('button', { name: /good/i })).not.toBeDisabled()
  })
})
