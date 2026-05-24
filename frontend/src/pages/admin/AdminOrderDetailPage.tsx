import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { formatBDT } from '@/utils/currency'
import { Package, MapPin, CreditCard, User, ArrowLeft, Edit2, X } from 'lucide-react'

interface OrderDetail {
  _id: string
  orderNumber: string
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: string
  paymentMethod: string
  user: {
    _id: string
    name: string
    email: string
    phone?: string
  }
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
    country: string
  }
  subtotal: number
  tax: number
  shippingCost: number
  discount: number
  total: number
  trackingNumber?: string
  notes?: string
  coupon?: { code: string; discountType: string; discountValue: number }
  statusHistory: Array<{
    status: string
    timestamp: string
    note?: string
  }>
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const validNextStatuses: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')

  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['admin-order-detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/admin/orders/${id}`)
      return res.data
    },
  })

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      return apiClient.put(`/api/admin/orders/${id}`, {
        status: newStatus,
        trackingNumber: newStatus === 'shipped' ? trackingNumber : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-order-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      setShowStatusModal(false)
      setNewStatus('')
      setTrackingNumber('')
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !order) return <div className="text-center py-12 text-red-600">Failed to load order</div>

  const nextStatuses = validNextStatuses[order.status] ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500">
              Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          {nextStatuses.length > 0 && (
            <button
              onClick={() => {
                setNewStatus(nextStatuses[0])
                setTrackingNumber(order.trackingNumber || '')
                setShowStatusModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Edit2 className="w-4 h-4" />
              Update Status
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Items + Status History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" /> Order Items
            </h2>
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="text-left pb-2">Product</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 text-gray-900 font-medium">{item.name}</td>
                    <td className="py-3 text-right text-gray-600">{formatBDT(item.price)}</td>
                    <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">{formatBDT(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatBDT(order.subtotal)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span><span>{formatBDT(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span><span>{formatBDT(order.shippingCost)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount {order.coupon ? `(${order.coupon.code})` : ''}</span>
                  <span>-{formatBDT(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t">
                <span>Total</span><span className="text-blue-600">{formatBDT(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Status History</h2>
            <div className="space-y-4">
              {[...order.statusHistory].reverse().map((h, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-blue-600 rounded-full mt-1 shrink-0" />
                    {i < order.statusHistory.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-gray-900 capitalize">{h.status}</p>
                    <p className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</p>
                    {h.note && <p className="text-sm text-gray-600 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking */}
          {order.trackingNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Tracking Number</p>
              <p className="text-lg font-bold text-blue-900 mt-1">{order.trackingNumber}</p>
            </div>
          )}
        </div>

        {/* Right: Customer, Shipping, Payment */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Customer
            </h3>
            <p className="font-medium text-gray-900">{order.user?.name}</p>
            <p className="text-sm text-gray-600">{order.user?.email}</p>
            {order.user?.phone && <p className="text-sm text-gray-600">{order.user.phone}</p>}
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Shipping Address
            </h3>
            <p className="font-medium text-gray-900">{order.shippingAddress.recipientName}</p>
            <p className="text-sm text-gray-600">{order.shippingAddress.street}</p>
            <p className="text-sm text-gray-600">
              {order.shippingAddress.city}, {order.shippingAddress.postalCode}
            </p>
            <p className="text-sm text-gray-600">{order.shippingAddress.country}</p>
            <p className="text-sm text-gray-500 mt-2">{order.shippingAddress.phone}</p>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Payment
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium capitalize">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                {order.paymentStatus === 'paid' || (order.paymentMethod === 'cod' && order.status === 'delivered') ? (
                  <span className="font-medium text-green-600">Paid</span>
                ) : (
                  <span className="font-medium text-yellow-600 capitalize">{order.paymentStatus} (pending delivery)</span>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-yellow-900">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Update Order Status</h2>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Current status: <span className="font-medium capitalize">{order.status}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              {newStatus === 'shipped' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus()}
                  disabled={isUpdating || (newStatus === 'shipped' && !trackingNumber)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm"
                >
                  {isUpdating ? 'Updating…' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
