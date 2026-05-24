import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('should render loading spinner', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should have spinner animation class', () => {
    const { container } = render(<LoadingSpinner />)
    const animatedElement = container.querySelector('.animate-spin')
    expect(animatedElement).toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { container: containerSm } = render(<LoadingSpinner size="sm" />)
    const spinnerSm = containerSm.querySelector('.w-6')
    expect(spinnerSm).toBeInTheDocument()

    const { container: containerLg } = render(<LoadingSpinner size="lg" />)
    const spinnerLg = containerLg.querySelector('.w-16')
    expect(spinnerLg).toBeInTheDocument()
  })
})
