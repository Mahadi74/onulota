import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('should render empty state with title', () => {
    render(
      <BrowserRouter>
        <EmptyState title="No items" description="No items to display" />
      </BrowserRouter>
    )
    expect(screen.getByText('No items')).toBeInTheDocument()
  })

  it('should render empty state with description', () => {
    const description = 'There are no items to display'
    render(
      <BrowserRouter>
        <EmptyState title="No items" description={description} />
      </BrowserRouter>
    )
    expect(screen.getByText(description)).toBeInTheDocument()
  })

  it('should render action button when provided', () => {
    render(
      <BrowserRouter>
        <EmptyState
          title="No items"
          description="No items"
          action={{
            label: 'Add Item',
            href: '/add',
          }}
        />
      </BrowserRouter>
    )
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })

  it('should not render action button when not provided', () => {
    render(
      <BrowserRouter>
        <EmptyState title="No items" description="No items" />
      </BrowserRouter>
    )
    const buttons = screen.queryAllByRole('link')
    expect(buttons).toHaveLength(0)
  })
})
