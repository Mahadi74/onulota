import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatBDT } from '@/utils/currency'
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, subtotal, tax, shippingCost, total } = useCartStore()
  const { user } = useAuthStore()

  const handleCheckout = () => {
    if (!user) {
      navigate('/login')
      return
    }
    navigate('/checkout')
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <EmptyState
          title="Your cart is empty"
          description="Add some products to get started"
          action={{
            label: 'Continue Shopping',
            href: '/products',
          }}
          type="cart"
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            {items.map((item) => (
              <div
                key={item._id}
                className="flex gap-4 p-6 border-b last:border-b-0 hover:bg-gray-50"
              >
                {/* Product Image */}
                <Link
                  to={`/products/${item.product._id}`}
                  className="flex-shrink-0 w-24 h-24 bg-gray-200 rounded-lg overflow-hidden"
                >
                  {item.product.image ? (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                  )}
                </Link>

                {/* Product Details */}
                <div className="flex-1">
                  <Link
                    to={`/products/${item.product._id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-gray-600 text-sm mt-1">
                    {formatBDT(item.product.price)} each
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity - 1)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity + 1)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Price & Remove */}
                <div className="flex flex-col items-end justify-between">
                  <span className="font-bold text-lg text-blue-600">
                    {formatBDT(item.price * item.quantity)}
                  </span>
                  <button
                    onClick={() => removeItem(item._id)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Continue Shopping */}
          <Link
            to="/products"
            className="inline-block mt-6 text-blue-600 hover:underline"
          >
            ← Continue Shopping
          </Link>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6 pb-6 border-b">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatBDT(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax (5%)</span>
                <span>{formatBDT(tax)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{formatBDT(shippingCost)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-blue-600">{formatBDT(total)}</span>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Proceed to Checkout
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Free shipping on orders over ৳500
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
