import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorMessage } from '../ErrorMessage'

describe('ErrorMessage', () => {
  it('should render error message', () => {
    const errorMsg = 'Something went wrong'
    render(<ErrorMessage message={errorMsg} />)
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
  })

  it('should have error styling', () => {
    const { container } = render(<ErrorMessage message="Error message" />)
    const errorContainer = container.querySelector('.bg-red-50')
    expect(errorContainer).toHaveClass('bg-red-50')
    expect(errorContainer).toHaveClass('border-red-200')
  })

  it('should display error icon', () => {
    const { container } = render(<ErrorMessage message="Error" />)
    const icon = container.querySelector('.lucide-alert-circle')
    expect(icon).toBeInTheDocument()
  })

  it('should display title', () => {
    render(<ErrorMessage message="Error message" title="Custom Title" />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('should have dismiss button when dismissible', () => {
    render(<ErrorMessage message="Error" dismissible={true} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
