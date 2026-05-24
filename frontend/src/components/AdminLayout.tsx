import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, Box, Tag, CreditCard, Users, Ticket,
  LogOut, Store, Layout, Settings, Menu, X,
} from 'lucide-react'

const adminNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products',  label: 'Products',  icon: Box },
  { to: '/admin/categories',label: 'Categories',icon: Tag },
  { to: '/admin/orders',    label: 'Orders',    icon: CreditCard },
  { to: '/admin/users',     label: 'Users',     icon: Users },
  { to: '/admin/coupons',   label: 'Coupons',   icon: Ticket },
  { to: '/admin/homepage',  label: 'Homepage',  icon: Layout },
  { to: '/admin/settings',  label: 'Settings',  icon: Settings },
]

// Bottom tab bar shows first 5 items + "More" drawer for the rest
const TAB_ITEMS = adminNavItems.slice(0, 4)
const MORE_ITEMS = adminNavItems.slice(4)

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="text-lg font-extrabold text-blue-600 tracking-tight">onulota</Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline text-sm font-semibold text-slate-600">Admin</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:block text-sm text-slate-500 max-w-[140px] truncate">
                {user.name}
              </span>
            )}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Store</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Slide-in panel */}
          <aside className="lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b">
              <span className="font-bold text-blue-600 text-lg">onulota Admin</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {user && (
              <div className="px-4 py-3 border-b bg-slate-50">
                <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-3 border-t space-y-1">
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                <Store className="w-4 h-4" /> View Store
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 pb-24 lg:pb-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">

          {/* Desktop Sticky Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-2">
                Navigation
              </p>
              <nav className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.to)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <section className="space-y-6 min-w-0">{children}</section>
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ──────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                  active ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            )
          })}
          {/* "More" opens drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              MORE_ITEMS.some((i) => isActive(i.to)) ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Menu className={`w-5 h-5 ${MORE_ITEMS.some((i) => isActive(i.to)) ? 'text-blue-600' : 'text-slate-400'}`} />
            More
          </button>
        </div>
      </nav>
    </div>
  )
}
