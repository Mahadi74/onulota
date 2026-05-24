import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  _id: string
  product: {
    _id: string
    name: string
    price: number
    image?: string
  }
  variant?: {
    _id: string
    name: string
    price?: number
  }
  quantity: number
  price: number
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  tax: number
  shippingCost: number
  total: number
  isLoading: boolean
  error: string | null

  // Actions
  addItem: (item: CartItem) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clear: () => void
  merge: (guestItems: CartItem[]) => void
  setItems: (items: CartItem[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  calculateTotals: () => void
}

const calculateTotals = (items: CartItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.05 // 5% tax
  const shippingCost = subtotal > 0 ? 100 : 0 // Fixed shipping cost
  const total = subtotal + tax + shippingCost

  return { subtotal, tax, shippingCost, total }
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      subtotal: 0,
      tax: 0,
      shippingCost: 0,
      total: 0,
      isLoading: false,
      error: null,

      addItem: (item) =>
        set((state) => {
          const existingItem = state.items.find(
            (i) =>
              i.product._id === item.product._id &&
              i.variant?._id === item.variant?._id
          )

          let newItems: CartItem[]
          if (existingItem) {
            newItems = state.items.map((i) =>
              i._id === existingItem._id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          } else {
            newItems = [...state.items, item]
          }

          const totals = calculateTotals(newItems)
          return { items: newItems, ...totals }
        }),

      removeItem: (itemId) =>
        set((state) => {
          const newItems = state.items.filter((i) => i._id !== itemId)
          const totals = calculateTotals(newItems)
          return { items: newItems, ...totals }
        }),

      updateQuantity: (itemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return state
          }

          const newItems = state.items.map((i) =>
            i._id === itemId ? { ...i, quantity } : i
          )
          const totals = calculateTotals(newItems)
          return { items: newItems, ...totals }
        }),

      clear: () =>
        set({
          items: [],
          subtotal: 0,
          tax: 0,
          shippingCost: 0,
          total: 0,
        }),

      merge: (guestItems) =>
        set((state) => {
          const mergedItems = [...state.items]

          guestItems.forEach((guestItem) => {
            const existingIndex = mergedItems.findIndex(
              (i) =>
                i.product._id === guestItem.product._id &&
                i.variant?._id === guestItem.variant?._id
            )

            if (existingIndex >= 0) {
              // Keep higher quantity
              mergedItems[existingIndex].quantity = Math.max(
                mergedItems[existingIndex].quantity,
                guestItem.quantity
              )
            } else {
              mergedItems.push(guestItem)
            }
          })

          const totals = calculateTotals(mergedItems)
          return { items: mergedItems, ...totals }
        }),

      setItems: (items) =>
        set(() => {
          const totals = calculateTotals(items)
          return { items, ...totals }
        }),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      calculateTotals: () =>
        set((state) => {
          const totals = calculateTotals(state.items)
          return totals
        }),
    }),
    {
      name: 'cart-store',
    }
  )
)
