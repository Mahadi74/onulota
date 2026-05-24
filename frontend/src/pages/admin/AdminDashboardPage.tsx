import { useQuery } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, ShoppingCart, Users, Package } from 'lucide-react'

interface DashboardData {
  monthlyRevenue: number
  ordersByStatus: {
    pending: number
    processing: number
    shipped: number
    delivered: number
    cancelled: number
  }
  userCount: number
  topProducts: Array<{
    _id: string
    name: string
    totalQuantity: number
    totalRevenue: number
    // legacy field aliases
    sales?: number
    revenue?: number
  }>
  salesTrend: Array<{
    _id: string
    revenue: number
    orderCount: number
    // legacy field alias
    orders?: number
    date?: string
  }>
}

interface StatusData {
  name: string
  value: number
  color: string
}

export default function AdminDashboardPage() {
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/dashboard')
      return response.data
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message="Failed to load dashboard data" />
  if (!dashboardData) return <ErrorMessage message="No dashboard data available" />

  const statusData: StatusData[] = [
    { name: 'Pending', value: dashboardData.ordersByStatus.pending, color: '#f59e0b' },
    { name: 'Processing', value: dashboardData.ordersByStatus.processing, color: '#3b82f6' },
    { name: 'Shipped', value: dashboardData.ordersByStatus.shipped, color: '#8b5cf6' },
    { name: 'Delivered', value: dashboardData.ordersByStatus.delivered, color: '#10b981' },
    { name: 'Cancelled', value: dashboardData.ordersByStatus.cancelled, color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatBDT(dashboardData.monthlyRevenue)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {Object.values(dashboardData.ordersByStatus).reduce((a, b) => a + b, 0)}
              </p>
            </div>
            <ShoppingCart className="w-10 h-10 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{dashboardData.userCount}</p>
            </div>
            <Users className="w-10 h-10 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Delivered Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboardData.ordersByStatus.delivered}
              </p>
            </div>
            <Package className="w-10 h-10 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        {/* Sales Trend */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">30-Day Sales Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboardData.salesTrend.map(d => ({ date: d.date || d._id, revenue: d.revenue, orders: d.orders ?? d.orderCount }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatBDT(value as number)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue" />
              <Line type="monotone" dataKey="orders" stroke="#10b981" name="Orders" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Orders by Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry: StatusData, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Top 10 Best-Selling Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Product Name</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Sales</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.topProducts.map((product) => (
                <tr key={product._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{product.name || '(deleted product)'}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{product.sales ?? product.totalQuantity}</td>
                  <td className="text-right py-3 px-4 font-medium text-gray-900">
                    {formatBDT(product.revenue ?? product.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
