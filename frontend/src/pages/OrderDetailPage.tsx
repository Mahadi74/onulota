import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { formatBDT } from '@/utils/currency'
import {
  Package, MapPin, CreditCard, Loader2, AlertCircle,
  ArrowLeft, CheckCircle2, Clock, Truck, XCircle, Home,
} from 'lucide-react'

interface OrderDetail {
  _id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  items: Array<{
    product: string
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  shippingAddress: {
    recipientName: string
    phone: string
    street: string
    city: string
    postalCode: string
  }
  subtotal: number
  tax: number
  shippingCost: number
  discount: number
  total: number
  trackingNumber?: string
  coupon?: { code: string }
  statusHistory: Array<{
    status: string
    timestamp: string
    note?: string
  }>
  createdAt: string
}

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered']

const statusMeta: Record<string, { label: string; color: string; bg: string; ring: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-200', icon: <Clock className="w-4 h-4" /> },
  processing: { label: 'Processing', color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-200',  icon: <Package className="w-4 h-4" /> },
  shipped:    { label: 'Shipped',    color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-200', icon: <Truck className="w-4 h-4" /> },
  delivered:  { label: 'Delivered',  color: 'text-emerald-600',bg: 'bg-emerald-50',ring: 'ring-emerald-200',icon: <CheckCircle2 className="w-4 h-4" /> },
  cancelled:  { label: 'Cancelled',  color: 'text-red-600',    bg: 'bg-red-50',    ring: 'ring-red-200',   icon: <XCircle className="w-4 h-4" /> },
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100', ring: 'ring-gray-200', icon: null }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ring-1 ${meta.color} ${meta.bg} ${meta.ring}`}>
      {meta.icon}{meta.label}
    </span>
  )
}

function ProgressTracker({ status }: { status: string }) {
  if (status === 'cancelled') return null
  const current = STATUS_STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= current
        const active = i === current
        const meta = statusMeta[step]
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all
                ${done ? (active ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-emerald-500') : 'bg-gray-200'}`}>
                {done && !active ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${done ? (active ? 'text-blue-600' : 'text-emerald-600') : 'text-gray-400'}`}>
                {meta.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < current ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/orders/${id}`)
      return response.data as OrderDetail
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/api/orders/${id}/cancel`)
    },
    onSuccess: () => navigate('/orders'),
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="text-center py-20 text-red-500">Error loading order</div>
  if (!order) return <div className="text-center py-20 text-gray-400">Order not found</div>

  const canCancel = ['pending', 'processing'].includes(order.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Orders
        </button>

        {/* Hero Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Order</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Progress bar */}
          <ProgressTracker status={order.status} />
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT — Items + Shipping + Timeline */}
          <div className="lg:col-span-3 space-y-6">

            {/* Tracking banner */}
            {order.trackingNumber && (
              <div className="bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl p-5 text-white flex items-center gap-4">
                <div className="bg-white/20 rounded-xl p-3">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-75">Tracking Number</p>
                  <p className="text-xl font-bold mt-0.5">{order.trackingNumber}</p>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Items Ordered</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatBDT(item.price)} × {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{formatBDT(item.subtotal)}</p>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="border-t border-gray-100 px-6 py-4 space-y-2 bg-gray-50/50">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>{formatBDT(order.subtotal)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Tax</span><span>{formatBDT(order.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping</span>
                  <span>{order.shippingCost === 0 ? <span className="text-emerald-600 font-medium">Free</span> : formatBDT(order.shippingCost)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Discount {order.coupon ? `(${order.coupon.code})` : ''}</span>
                    <span>−{formatBDT(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span className="text-blue-600">{formatBDT(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Delivery Address</h2>
              </div>
              <div className="px-6 py-5 flex gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <p className="font-semibold text-gray-900">{order.shippingAddress.recipientName}</p>
                  <p className="text-gray-500 mt-0.5">{order.shippingAddress.street}</p>
                  <p className="text-gray-500">{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
                  <p className="text-gray-400 mt-1 text-xs">{order.shippingAddress.phone}</p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order Timeline</h2>
              </div>
              <div className="px-6 py-5">
                <div className="relative">
                  {[...order.statusHistory].reverse().map((h, i, arr) => (
                    <div key={i} className="flex gap-4 relative">
                      {/* Line */}
                      {i < arr.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-100" />
                      )}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10
                        ${i === 0 ? 'bg-blue-600' : 'bg-gray-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-white' : 'bg-gray-400'}`} />
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm font-semibold capitalize ${i === 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                          {h.status}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(h.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {h.note && <p className="text-xs text-gray-500 mt-1 italic">"{h.note}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Payment + Actions */}
          <div className="lg:col-span-2 space-y-6">

            {/* Payment Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Method</span>
                  <span className="text-sm font-semibold text-gray-900 capitalize">
                    {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod?.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  {order.paymentStatus === 'paid' || (order.paymentMethod === 'cod' && order.status === 'delivered') ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-amber-600 capitalize">
                      {order.paymentMethod === 'cod' ? 'Pay on delivery' : order.paymentStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Amount</span>
                  <span className="text-lg font-bold text-blue-600">{formatBDT(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Need help card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-6 text-white">
              <p className="text-sm font-semibold mb-1">Need help?</p>
              <p className="text-xs text-gray-300 leading-relaxed">
                For questions about your order, contact our support team with your order number.
              </p>
              <p className="text-xs font-mono text-blue-300 mt-3">{order.orderNumber}</p>
            </div>

            {/* Cancel */}
            {canCancel && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-600 mb-4">
                  You can cancel this order while it's still being prepared.
                </p>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cancel Order
                </button>
                {cancelMutation.isError && (
                  <div className="mt-3 bg-red-50 rounded-xl p-3 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">Failed to cancel order. Please try again.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
