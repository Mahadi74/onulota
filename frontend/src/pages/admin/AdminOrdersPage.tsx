import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Search, Edit2, Eye, X } from 'lucide-react'

interface Order {
  _id: string
  orderNumber: string
  user: {
    name: string
    email: string
  }
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
  trackingNumber?: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState<string>('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const itemsPerPage = 10

  // Fetch orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin-orders', currentPage, searchTerm, statusFilter],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/orders', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
          status: statusFilter || undefined,
        },
      })
      return response.data
    },
  })

  // Update order status mutation
  const { mutate: updateOrderStatus, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      return apiClient.put(`/api/admin/orders/${editingOrder?._id}`, {
        status: newStatus,
        trackingNumber: newStatus === 'shipped' ? trackingNumber : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      setEditingOrder(null)
      setNewStatus('')
      setTrackingNumber('')
    },
  })

  if (isLoading) return <LoadingSpinner />

  const orders = ordersData?.orders || []
  const totalPages = Math.ceil((ordersData?.total || 0) / itemsPerPage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number or customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Order Number</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Total</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: Order) => (
                <tr key={order._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{order.orderNumber}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-gray-900 font-medium">{order.user.name}</p>
                      <p className="text-sm text-gray-600">{order.user.email}</p>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 font-medium">
                    {formatBDT(order.total)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigate(`/admin/orders/${order._id}`)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrder(order)
                          setNewStatus(order.status)
                          setTrackingNumber(order.trackingNumber || '')
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Update status"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {orders.map((order: Order) => (
            <div key={order._id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="text-sm font-medium text-gray-800">{order.user.name}</p>
                  <p className="text-xs text-gray-500">{order.user.email}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusColors[order.status]}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="font-semibold text-gray-900">{formatBDT(order.total)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/admin/orders/${order._id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" /> View
                </button>
                <button
                  onClick={() => {
                    setEditingOrder(order)
                    setNewStatus(order.status)
                    setTrackingNumber(order.trackingNumber || '')
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" /> Update
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`px-3 py-2 rounded ${
              currentPage === page
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      {/* Status Update Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Update Order Status</h2>
              <button
                onClick={() => setEditingOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Order: {editingOrder.orderNumber}</p>
                <p className="text-sm text-gray-600">Current Status: {editingOrder.status}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {newStatus === 'shipped' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateOrderStatus()}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isUpdating ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
