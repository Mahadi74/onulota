import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../cartStore'

describe('Cart Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCartStore.setState({
      items: [],
      subtotal: 0,
      tax: 0,
      shippingCost: 0,
      total: 0,
      isLoading: false,
      error: null,
    })
  })

  it('should initialize with empty cart', () => {
    const state = useCartStore.getState()
    expect(state.items).toEqual([])
    expect(state.subtotal).toBe(0)
    expect(state.total).toBe(0)
  })

  it('should add item to cart', () => {
    const store = useCartStore.getState()
    const item = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Test Product',
        price: 1000,
        image: 'test.jpg',
      },
      quantity: 1,
      price: 1000,
    }

    store.addItem(item)
    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toEqual(item)
  })

  it('should update item quantity', () => {
    const store = useCartStore.getState()
    const item = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Test Product',
        price: 1000,
        image: 'test.jpg',
      },
      quantity: 1,
      price: 1000,
    }

    store.addItem(item)
    store.updateQuantity('1', 5)
    const state = useCartStore.getState()
    expect(state.items[0].quantity).toBe(5)
  })

  it('should remove item from cart', () => {
    const store = useCartStore.getState()
    const item = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Test Product',
        price: 1000,
        image: 'test.jpg',
      },
      quantity: 1,
      price: 1000,
    }

    store.addItem(item)
    expect(useCartStore.getState().items).toHaveLength(1)

    store.removeItem('1')
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('should clear entire cart', () => {
    const store = useCartStore.getState()
    const item1 = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Product 1',
        price: 1000,
        image: 'test1.jpg',
      },
      quantity: 1,
      price: 1000,
    }
    const item2 = {
      _id: '2',
      product: {
        _id: 'prod2',
        name: 'Product 2',
        price: 2000,
        image: 'test2.jpg',
      },
      quantity: 2,
      price: 2000,
    }

    store.addItem(item1)
    store.addItem(item2)
    expect(useCartStore.getState().items).toHaveLength(2)

    store.clear()
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().subtotal).toBe(0)
  })

  it('should calculate totals correctly', () => {
    const store = useCartStore.getState()
    const item = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Test Product',
        price: 1000,
        image: 'test.jpg',
      },
      quantity: 2,
      price: 1000,
    }

    store.addItem(item)
    const state = useCartStore.getState()
    
    // Subtotal = 1000 * 2 = 2000
    expect(state.subtotal).toBe(2000)
    // Tax = 2000 * 0.05 = 100
    expect(state.tax).toBe(100)
    // Shipping = 100 (default)
    expect(state.shippingCost).toBe(100)
    // Total = 2000 + 100 + 100 = 2200
    expect(state.total).toBe(2200)
  })

  it('should merge carts correctly', () => {
    const store = useCartStore.getState()
    const existingItem = {
      _id: '1',
      product: {
        _id: 'prod1',
        name: 'Product 1',
        price: 1000,
        image: 'test1.jpg',
      },
      quantity: 2,
      price: 1000,
    }
    const guestItem = {
      _id: '2',
      product: {
        _id: 'prod2',
        name: 'Product 2',
        price: 2000,
        image: 'test2.jpg',
      },
      quantity: 1,
      price: 2000,
    }

    store.addItem(existingItem)
    store.merge([guestItem])
    
    const state = useCartStore.getState()
    expect(state.items).toHaveLength(2)
  })
})
