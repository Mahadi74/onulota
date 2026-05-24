import { useParams, Link } from 'react-router-dom'
import { CheckCircle, Package, Home } from 'lucide-react'

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your purchase. Your order has been successfully placed.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Order ID</p>
          <p className="font-mono text-lg font-bold text-green-700">{id}</p>
        </div>

        <div className="space-y-3 mb-8 text-left">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Order Placed</p>
              <p className="text-sm text-gray-600">We've received your order</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Processing</p>
              <p className="text-sm text-gray-600">We're preparing your items</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Shipped</p>
              <p className="text-sm text-gray-600">On its way to you</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          A confirmation email has been sent to your registered email address. You can track your order from your account.
        </p>

        <div className="space-y-3">
          <Link
            to={`/orders/${id}`}
            className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View Order Details
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
