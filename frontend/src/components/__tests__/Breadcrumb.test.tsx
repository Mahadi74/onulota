import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Breadcrumb } from '../Breadcrumb'

describe('Breadcrumb', () => {
  it('should render breadcrumb items', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Electronics' },
    ]

    render(
      <BrowserRouter>
        <Breadcrumb items={items} />
      </BrowserRouter>
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Electronics')).toBeInTheDocument()
  })

  it('should render links for items with href', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
    ]

    render(
      <BrowserRouter>
        <Breadcrumb items={items} />
      </BrowserRouter>
    )

    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('should render last item as text without link', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Current Page' },
    ]

    render(
      <BrowserRouter>
        <Breadcrumb items={items} />
      </BrowserRouter>
    )

    const currentPage = screen.getByText('Current Page')
    expect(currentPage.closest('a')).not.toBeInTheDocument()
  })

  it('should render separators between items', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
    ]

    render(
      <BrowserRouter>
        <Breadcrumb items={items} />
      </BrowserRouter>
    )

    const { container } = render(
      <BrowserRouter>
        <Breadcrumb items={items} />
      </BrowserRouter>
    )
    const separators = container.querySelectorAll('.lucide-chevron-right')
    expect(separators.length).toBeGreaterThan(0)
  })
})
