import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { bangladeshPhoneSchema, bangladeshPostalCodeSchema } from '@/utils/bangladeshValidation'
import { Loader2, MapPin, CreditCard, Tag, X, CheckCircle2 } from 'lucide-react'

const checkoutSchema = z.object({
  recipientName: z.string().min(2, 'Name is required'),
  phone: bangladeshPhoneSchema,
  street: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  postalCode: bangladeshPostalCodeSchema,
  paymentMethod: z.enum(['cod', 'bkash', 'nagad']),
  couponCode: z.string().optional(),
  senderPhone: z.string().optional(),
  transactionId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'bkash' || data.paymentMethod === 'nagad') {
    if (!data.senderPhone || data.senderPhone.trim().length < 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Sender phone number is required', path: ['senderPhone'] })
    }
    if (!data.transactionId || data.transactionId.trim().length < 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction ID is required', path: ['transactionId'] })
    }
  }
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, subtotal, tax, shippingCost, total, clear: clearCart } = useCartStore()
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bkashNumber, setBkashNumber] = useState('01XXXXXXXXX')
  const [nagadNumber, setNagadNumber] = useState('01XXXXXXXXX')

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  useEffect(() => {
    apiClient.get('/api/settings').then(res => {
      if (res.data.bkashNumber) setBkashNumber(res.data.bkashNumber)
      if (res.data.nagadNumber) setNagadNumber(res.data.nagadNumber)
    }).catch(() => {})
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: user?.name || '',
      phone: '+880',
      paymentMethod: 'cod',
    },
  })

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      setError('Your cart is empty')
      return
    }

    if (!user) {
      navigate('/login?redirect=/checkout')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Sync local cart to backend before creating the order
      await apiClient.delete('/api/cart').catch(() => {})
      for (const item of items) {
        await apiClient.post('/api/cart/items', {
          productId: item.product._id,
          quantity: item.quantity,
          ...(item.variant?._id ? { variantId: item.variant._id } : {}),
        }).catch(() => {})
      }

      const response = await apiClient.post('/api/orders', {
        shippingAddress: {
          recipientName: data.recipientName,
          phone: data.phone,
          street: data.street,
          city: data.city,
          postalCode: data.postalCode,
          country: 'Bangladesh',
        },
        paymentMethod: data.paymentMethod,
        couponCode: couponApplied?.code || undefined,
      })

      const order = response.data

      if (data.paymentMethod === 'bkash' || data.paymentMethod === 'nagad') {
        // Manual mobile payment — confirm with transaction ID
        await apiClient.post('/api/payments/cod/confirm', { orderId: order._id })
        clearCart()
        navigate(`/orders/success/${order._id}`)
      } else {
        // COD order
        await apiClient.post('/api/payments/cod/confirm', {
          orderId: order._id,
        })

        clearCart()
        navigate(`/orders/success/${order._id}`)
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Checkout failed. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600 mb-4">Your cart is empty</p>
        <button
          onClick={() => navigate('/products')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Continue Shopping
        </button>
      </div>
    )
  }

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    setCouponError('')
    setCouponLoading(true)
    try {
      const res = await apiClient.post('/api/coupons/validate', { code, cartSubtotal: subtotal })
      const { discountAmount } = res.data
      setCouponApplied({ code, discount: discountAmount })
      setCouponError('')
    } catch (err: any) {
      setCouponApplied(null)
      setCouponError(err?.response?.data?.message || 'Invalid or expired coupon')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setCouponApplied(null)
    setCouponInput('')
    setCouponError('')
  }

  const discount = couponApplied?.discount ?? 0
  const finalTotal = total - discount

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Shipping Address
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Name
                  </label>
                  <input
                    {...register('recipientName')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.recipientName && (
                    <p className="mt-1 text-sm text-red-600">{errors.recipientName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="+880"
                    pattern="\+?880\d{9,10}"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    {...register('street')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.street && (
                    <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    {...register('city')}
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code
                  </label>
                  <input
                    {...register('postalCode')}
                    type="text"
                    placeholder="1205"
                    maxLength={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">4-digit postal code (e.g., 1205 for Dhaka)</p>
                  {errors.postalCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.postalCode.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Method
              </h2>

              {/* Card selector */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {([
                  { value: 'bkash', label: 'bKash', icon: 'https://freelogopng.com/images/all_img/1656234841bkash-app-logo-png.png' },
                  { value: 'nagad', label: 'Nagad', icon: 'https://freelogopng.com/images/all_img/1679248558Nagad-Logo.png' },
                  { value: 'cod',   label: 'Cash On Delivery', emoji: '💵' },
                ] as const).map(opt => {
                  const selected = watch('paymentMethod') === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input {...register('paymentMethod')} type="radio" value={opt.value} className="sr-only" />
                      {selected && (
                        <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="w-2 h-2 bg-white rounded-full" />
                        </span>
                      )}
                      {'icon' in opt
                        ? <img src={opt.icon} alt={opt.label} className="w-10 h-10 object-contain" />
                        : <span className="text-3xl">{opt.emoji}</span>
                      }
                      <span className={`text-xs font-bold text-center ${selected ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                    </label>
                  )
                })}
              </div>

              {/* bKash instructions */}
              {watch('paymentMethod') === 'bkash' && (
                <div className="rounded-xl bg-pink-50 border border-pink-100 p-5 space-y-4">
                  <div>
                    <p className="font-bold text-gray-900 mb-2">How to pay with bKash:</p>
                    <ol className="text-sm text-gray-700 space-y-1 list-none">
                      <li>1. Go to your bKash App or dial <span className="text-pink-600 font-semibold">*247#</span></li>
                      <li>2. Choose "Send Money"</li>
                      <li>3. Enter Number: <span className="font-bold text-pink-700">{bkashNumber}</span></li>
                      <li>4. Enter Amount: <span className="font-bold">৳{total.toFixed(0)}</span></li>
                      <li>5. Enter Reference: <span className="font-bold">1</span></li>
                      <li>6. Enter your PIN to confirm</li>
                    </ol>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">Your Phone Number (Sender)</label>
                    <input {...register('senderPhone')} type="tel" placeholder="017..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white" />
                    {errors.senderPhone && <p className="mt-1 text-xs text-red-600">{errors.senderPhone.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">Transaction ID</label>
                    <input {...register('transactionId')} type="text" placeholder="e.g. 8X92..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white" />
                    {errors.transactionId && <p className="mt-1 text-xs text-red-600">{errors.transactionId.message}</p>}
                  </div>
                </div>
              )}

              {/* Nagad instructions */}
              {watch('paymentMethod') === 'nagad' && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-5 space-y-4">
                  <div>
                    <p className="font-bold text-gray-900 mb-2">How to pay with Nagad:</p>
                    <ol className="text-sm text-gray-700 space-y-1 list-none">
                      <li>1. Go to your Nagad App or dial <span className="text-orange-600 font-semibold">*167#</span></li>
                      <li>2. Choose "Send Money"</li>
                      <li>3. Enter Number: <span className="font-bold text-orange-700">{nagadNumber}</span></li>
                      <li>4. Enter Amount: <span className="font-bold">৳{total.toFixed(0)}</span></li>
                      <li>5. Enter Reference: <span className="font-bold">1</span></li>
                      <li>6. Enter your PIN to confirm</li>
                    </ol>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">Your Phone Number (Sender)</label>
                    <input {...register('senderPhone')} type="tel" placeholder="017..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">Transaction ID</label>
                    <input {...register('transactionId')} type="text" placeholder="e.g. 8X92..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                    {errors.transactionId && <p className="mt-1 text-xs text-red-600">{errors.transactionId.message}</p>}
                  </div>
                </div>
              )}

              {/* COD info */}
              {watch('paymentMethod') === 'cod' && (
                <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-sm text-green-800">
                  ✅ Pay in cash when your order is delivered to your door.
                </div>
              )}
            </div>

            {/* Coupon Code */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" /> Coupon Code
              </h2>

              {couponApplied ? (
                <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">{couponApplied.code}</span>
                    <span className="text-sm">— {formatBDT(couponApplied.discount)} off</span>
                  </div>
                  <button type="button" onClick={removeCoupon} className="text-green-600 hover:text-red-500 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                      placeholder="Enter coupon code"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold transition"
                    >
                      {couponLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Apply
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> {couponError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Processing...' : `Place Order - ${formatBDT(finalTotal)}`}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

            {/* Items */}
            <div className="space-y-3 mb-6 pb-6 border-b max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item._id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.product.name} x {item.quantity}
                  </span>
                  <span className="font-medium">{formatBDT(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-3 mb-6 pb-6 border-b">
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
              {couponApplied && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({couponApplied.code})</span>
                  <span>-{formatBDT(couponApplied.discount)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-blue-600">{formatBDT(finalTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
