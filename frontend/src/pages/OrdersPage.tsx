import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { formatBDT } from '@/utils/currency'
import { Package, ChevronRight, ShoppingBag, Clock } from 'lucide-react'

interface Order {
  _id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: number
  createdAt: string
  items: Array<{ name: string; quantity: number; price: number }>
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  processing: { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  shipped:    { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  delivered:  { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  cancelled:  { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
}

export default function OrdersPage() {
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await apiClient.get('/api/orders')).data,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-red-600 font-medium">Failed to load orders. Please try again.</p>
    </div>
  )

  const orders: Order[] = data?.orders || []

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            My Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''} placed</p>
        </div>

        {/* Empty */}
        {orders.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No orders yet</h3>
            <p className="text-sm text-slate-500 mb-6">Start shopping to place your first order</p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Browse Products
            </button>
          </div>
        )}

        {/* Order list */}
        {orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const style = STATUS_STYLE[order.status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' }
              const itemsSummary = order.items.slice(0, 2).map(i => i.name).join(', ')
                + (order.items.length > 2 ? ` +${order.items.length - 2} more` : '')

              return (
                <Link
                  key={order._id}
                  to={`/orders/${order._id}`}
                  className="block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{order.orderNumber}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{itemsSummary}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="mx-1">·</span>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-base font-bold text-blue-600">{formatBDT(order.total)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
