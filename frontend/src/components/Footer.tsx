import { useQuery } from '@tanstack/react-query'
import { Mail, Phone, MapPin } from 'lucide-react'
import apiClient from '@/services/api/client'

interface PaymentMethod { name: string; logo?: string; isActive: boolean }
interface SiteSettings {
  siteName: string
  logoUrl?: string
  tagline?: string
  contactPhone: string[]
  contactEmail: string
  contactAddress: string
  paymentMethods: PaymentMethod[]
}

const FALLBACK: SiteSettings = {
  siteName: 'onulota',
  contactPhone: ['+880 1234 567890'],
  contactEmail: 'support@onulota.com.bd',
  contactAddress: 'Dhaka, Bangladesh',
  paymentMethods: [
    { name: 'Cash on Delivery', isActive: true },
    { name: 'SSLCommerz', isActive: true },
    { name: 'bKash', isActive: true },
    { name: 'Nagad', isActive: true },
  ],
}

export const Footer: React.FC = () => {
  const { data: settings = FALLBACK } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: async () => (await apiClient.get('/api/settings')).data,
    staleTime: 1000 * 60 * 10,
  })

  const activeMethods = settings.paymentMethods.filter((p) => p.isActive)

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="h-9 mb-4 object-contain" />
            ) : (
              <span className="text-2xl font-extrabold text-white tracking-tight">{settings.siteName}</span>
            )}
            {settings.tagline && (
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{settings.tagline}</p>
            )}
          </div>

          {/* About */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4">About</h4>
            <ul className="space-y-2.5 text-sm">
              {['About Us', 'Careers', 'Press', 'Blog'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Help & Policies */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4">Help & Policies</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'FAQ', href: '#' },
                { label: 'Shipping Info', href: '#' },
                { label: 'Returns', href: '#' },
                { label: 'Privacy Policy', href: '#' },
                { label: 'Terms of Service', href: '#' },
                { label: 'Refund Policy', href: '#' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-white transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4">Contact Us</h4>
            <div className="space-y-3 text-sm">
              {settings.contactPhone.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                  <div className="space-y-0.5">
                    {settings.contactPhone.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-white transition-colors break-all">
                  {settings.contactEmail}
                </a>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                <p className="whitespace-pre-line">{settings.contactAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Accepted Payments</p>
            <div className="flex flex-wrap gap-2">
              {activeMethods.map((pm) => (
                <div
                  key={pm.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {pm.logo && (
                    <img src={pm.logo} alt={pm.name} className="h-4 w-auto object-contain" />
                  )}
                  {pm.name}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center sm:text-right">
            &copy; {new Date().getFullYear()} {settings.siteName} Bangladesh. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
