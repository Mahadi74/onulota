import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { Plus, Trash2, Save } from 'lucide-react'
import { ImageUploadField } from '@/components/ImageUploadField'

interface PaymentMethod { name: string; logo?: string; isActive: boolean }
interface SiteSettings {
  siteName: string
  logoUrl?: string
  tagline?: string
  contactPhone: string[]
  contactEmail: string
  contactAddress: string
  paymentMethods: PaymentMethod[]
  bkashNumber?: string
  nagadNumber?: string
}

const FALLBACK: SiteSettings = {
  siteName: 'onulota',
  logoUrl: '',
  tagline: '',
  contactPhone: ['+880 1234 567890'],
  contactEmail: 'support@onulota.com.bd',
  contactAddress: 'Dhaka, Bangladesh',
  bkashNumber: '',
  nagadNumber: '',
  paymentMethods: [
    { name: 'Cash on Delivery', isActive: true },
    { name: 'bKash', isActive: true },
    { name: 'Nagad', isActive: true },
  ],
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SiteSettings>(FALLBACK)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: async () => (await apiClient.get('/api/settings')).data,
  })

  useEffect(() => {
    if (data) setForm({ ...FALLBACK, ...data })
  }, [data])

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (payload: SiteSettings) => (await apiClient.put('/api/settings', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const setField = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setPhone = (i: number, val: string) =>
    setField('contactPhone', form.contactPhone.map((p, idx) => idx === i ? val : p))

  const addPhone = () => setField('contactPhone', [...form.contactPhone, ''])
  const removePhone = (i: number) => setField('contactPhone', form.contactPhone.filter((_, idx) => idx !== i))

  const setPM = (i: number, patch: Partial<PaymentMethod>) =>
    setField('paymentMethods', form.paymentMethods.map((pm, idx) => idx === i ? { ...pm, ...patch } : pm))

  const addPM = () => setField('paymentMethods', [...form.paymentMethods, { name: '', isActive: true }])
  const removePM = (i: number) => setField('paymentMethods', form.paymentMethods.filter((_, idx) => idx !== i))

  if (isLoading) return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage logo, contact info, and payment methods</p>
        </div>
        <button
          onClick={() => save(form)}
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Brand */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Brand</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Site Name</label>
            <input
              value={form.siteName}
              onChange={(e) => setField('siteName', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tagline</label>
            <input
              value={form.tagline || ''}
              onChange={(e) => setField('tagline', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <ImageUploadField
              label="Logo"
              value={form.logoUrl || ''}
              onChange={(url) => setField('logoUrl', url)}
              uploadType="category"
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Contact Information</h2>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Phone Numbers</label>
          <div className="space-y-2">
            {form.contactPhone.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={p}
                  onChange={(e) => setPhone(i, e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removePhone(i)} className="p-2 text-slate-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addPhone} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Plus className="w-3.5 h-3.5" /> Add Phone
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <input
              value={form.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Address</label>
            <textarea
              value={form.contactAddress}
              onChange={(e) => setField('contactAddress', e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Mobile Payment Numbers */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Mobile Payment Numbers</h2>
          <p className="text-xs text-slate-500 mt-0.5">These merchant numbers appear in the checkout instructions for customers</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* bKash */}
          <div className="rounded-xl border border-pink-100 bg-pink-50 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <img src="https://freelogopng.com/images/all_img/1656234841bkash-app-logo-png.png" alt="bKash" className="w-6 h-6 object-contain" />
              <span className="text-sm font-bold text-pink-700">bKash Merchant Number</span>
            </div>
            <input
              type="tel"
              value={form.bkashNumber || ''}
              onChange={(e) => setField('bkashNumber', e.target.value)}
              placeholder="e.g. 01716684803"
              className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
            <p className="text-[11px] text-pink-500">Customers will send payment to this number</p>
          </div>

          {/* Nagad */}
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <img src="https://freelogopng.com/images/all_img/1679248558Nagad-Logo.png" alt="Nagad" className="w-6 h-6 object-contain" />
              <span className="text-sm font-bold text-orange-700">Nagad Merchant Number</span>
            </div>
            <input
              type="tel"
              value={form.nagadNumber || ''}
              onChange={(e) => setField('nagadNumber', e.target.value)}
              placeholder="e.g. 01712345678"
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-[11px] text-orange-500">Customers will send payment to this number</p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Payment Methods</h2>
        <div className="space-y-3">
          {form.paymentMethods.map((pm, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
              <input
                value={pm.name}
                onChange={(e) => setPM(i, { name: e.target.value })}
                placeholder="Name"
                className="w-full sm:flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={pm.logo || ''}
                onChange={(e) => setPM(i, { logo: e.target.value })}
                placeholder="Logo URL (optional)"
                className="w-full sm:flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between sm:contents">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pm.isActive}
                    onChange={(e) => setPM(i, { isActive: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
                <button onClick={() => removePM(i)} className="p-1.5 text-slate-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addPM} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add Payment Method
        </button>
      </div>
    </div>
  )
}
