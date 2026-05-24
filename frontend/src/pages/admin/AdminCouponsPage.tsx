import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Plus, Edit2, Trash2, X } from 'lucide-react'

const couponSchema = z.object({
  code: z.string().min(3, 'Coupon code is required'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0, 'Discount value must be positive'),
  minOrderValue: z.number().min(0, 'Minimum order value must be non-negative'),
  maxUsagePerUser: z.number().min(1, 'Max usage per user must be at least 1'),
  totalUsageLimit: z.number().min(1, 'Total usage limit must be at least 1'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  isActive: z.boolean(),
})

type CouponFormData = z.infer<typeof couponSchema>

interface Coupon {
  _id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderValue: number
  maxUsagePerUser: number
  totalUsageLimit: number
  usageCount: number
  expiresAt: string
  isActive: boolean
  createdAt: string
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      isActive: true,
    },
  })

  // Fetch coupons
  const { data: couponsData, isLoading } = useQuery({
    queryKey: ['admin-coupons', currentPage],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/coupons', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
        },
      })
      return response.data
    },
  })

  // Create/Update coupon mutation
  const { mutate: saveCoupon, isPending: isSaving } = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const { expiryDate, ...rest } = data
      const payload = { ...rest, expiresAt: expiryDate }
      if (editingCoupon) {
        return apiClient.put(`/api/admin/coupons/${editingCoupon._id}`, payload)
      } else {
        return apiClient.post('/api/admin/coupons', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      setIsFormOpen(false)
      setEditingCoupon(null)
      reset()
    },
  })

  // Delete coupon mutation
  const { mutate: deleteCoupon } = useMutation({
    mutationFn: async (couponId: string) => {
      return apiClient.delete(`/api/admin/coupons/${couponId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
  })

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setValue('code', coupon.code)
    setValue('discountType', coupon.discountType)
    setValue('discountValue', coupon.discountValue)
    setValue('minOrderValue', coupon.minOrderValue)
    setValue('maxUsagePerUser', coupon.maxUsagePerUser)
    setValue('totalUsageLimit', coupon.totalUsageLimit)
    setValue('expiryDate', coupon.expiresAt.split('T')[0])
    setValue('isActive', coupon.isActive)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCoupon(null)
    reset()
  }

  const onSubmit = (data: CouponFormData) => {
    saveCoupon(data)
  }

  if (isLoading) return <LoadingSpinner />

  const coupons = couponsData?.coupons || []
  const totalPages = Math.ceil((couponsData?.total || 0) / itemsPerPage)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Coupon
        </button>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Code</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
              <th className="text-right py-3 px-4 font-medium text-gray-700">Min Order</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Usage</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Expiry</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon: Coupon) => (
              <tr key={coupon._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-900 font-medium">{coupon.code}</td>
                <td className="py-3 px-4 text-gray-600">
                  {coupon.discountType === 'percentage'
                    ? `${coupon.discountValue}%`
                    : formatBDT(coupon.discountValue)}
                </td>
                <td className="text-right py-3 px-4 text-gray-600">
                  {formatBDT(coupon.minOrderValue)}
                </td>
                <td className="text-center py-3 px-4 text-gray-600">
                  {coupon.usageCount} / {coupon.totalUsageLimit}
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {new Date(coupon.expiresAt).toLocaleDateString()}
                </td>
                <td className="text-center py-3 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      coupon.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {coupon.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this coupon?')) {
                          deleteCoupon(coupon._id)
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* Coupon Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCoupon ? 'Edit Coupon' : 'Add Coupon'}
              </h2>
              <button onClick={handleCloseForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coupon Code
                  </label>
                  <input
                    {...register('code')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.code && (
                    <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    {...register('discountType')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Value
                  </label>
                  <input
                    {...register('discountValue', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.discountValue && (
                    <p className="mt-1 text-sm text-red-600">{errors.discountValue.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Order Value
                  </label>
                  <input
                    {...register('minOrderValue', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.minOrderValue && (
                    <p className="mt-1 text-sm text-red-600">{errors.minOrderValue.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Usage Per User
                  </label>
                  <input
                    {...register('maxUsagePerUser', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.maxUsagePerUser && (
                    <p className="mt-1 text-sm text-red-600">{errors.maxUsagePerUser.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Usage Limit
                  </label>
                  <input
                    {...register('totalUsageLimit', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.totalUsageLimit && (
                    <p className="mt-1 text-sm text-red-600">{errors.totalUsageLimit.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    {...register('expiryDate')}
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.expiryDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.expiryDate.message}</p>
                  )}
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input {...register('isActive')} type="checkbox" className="w-4 h-4" />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
