import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LayoutDashboard, Box, Tag, CreditCard, Users, Ticket, LogOut, Store, Layout, Settings } from 'lucide-react'

const adminNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Box },
  { to: '/admin/categories', label: 'Categories', icon: Tag },
  { to: '/admin/orders', label: 'Orders', icon: CreditCard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/homepage', label: 'Homepage', icon: Layout },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b bg-white px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-blue-600">onulota</Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-700">Admin Panel</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden sm:block text-sm text-slate-600">
                {user.name}
              </span>
            )}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Store className="w-4 h-4" />
              Store
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="hidden lg:block rounded-2xl bg-white border border-slate-200 p-4 shadow-sm self-start sticky top-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-2">Navigation</p>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.to ||
                  location.pathname.startsWith(item.to + '/')
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Mobile nav */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-2">
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          <section className="space-y-6 min-w-0">{children}</section>
        </div>
      </div>
    </div>
  )
}
