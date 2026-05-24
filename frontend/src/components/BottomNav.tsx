import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, ShoppingBag, ShoppingCart, Heart, CircleUser, LayoutDashboard, LogOut, LogIn, UserPlus } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'

const MAIN_TABS = [
  { to: '/',         icon: Home,        label: 'Home'    },
  { to: '/orders',   icon: ShoppingBag, label: 'Orders'  },
  { to: '/cart',     icon: ShoppingCart,label: 'Cart',   center: true },
  { to: '/wishlist', icon: Heart,       label: 'Wishlist'},
]

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const cartCount = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const wishlistCount = useWishlistStore(s => s.ids.length)
  const [accountOpen, setAccountOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  const isAccountActive = pathname.startsWith('/profile') || pathname.startsWith('/admin')

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    if (accountOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountOpen])

  // Close on route change
  useEffect(() => { setAccountOpen(false) }, [pathname])

  const handleLogout = () => {
    logout()
    setAccountOpen(false)
    navigate('/')
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50">
      {/* Account popup menu */}
      {accountOpen && (
        <div
          className="absolute bottom-full inset-x-3 mb-2 rounded-2xl bg-white shadow-[0_-4px_32px_rgba(0,0,0,0.14)] border border-slate-100 overflow-hidden"
          ref={menuRef}
        >
          {user ? (
            <>
              {/* CircleUser info header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="text-sm font-bold text-slate-900 truncate">{user.name || user.email}</p>
              </div>

              {/* Profile */}
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <CircleUser className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">My Profile</p>
                  <p className="text-xs text-slate-400">Account details & orders</p>
                </div>
              </Link>

              {/* Admin / Store — only for admin role */}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-t border-slate-100"
                >
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <LayoutDashboard className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Admin / Store</p>
                    <p className="text-xs text-slate-400">Manage products & orders</p>
                  </div>
                </Link>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-rose-50 transition-colors border-t border-slate-100"
              >
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-sm font-semibold text-rose-600">Logout</p>
              </button>
            </>
          ) : (
            <>
              {/* Login */}
              <Link
                to="/login"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <LogIn className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Login</p>
                  <p className="text-xs text-slate-400">Sign in to your account</p>
                </div>
              </Link>

              {/* Register */}
              <Link
                to="/register"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-t border-slate-100"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Register</p>
                  <p className="text-xs text-slate-400">Create a new account</p>
                </div>
              </Link>
            </>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="mx-3 mb-3 rounded-[26px] bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] border border-white/60">
        <div className="flex items-end justify-around px-2 pt-3 pb-2">

          {/* Main tabs */}
          {MAIN_TABS.map(({ to, icon: Icon, label, center }) => {
            const active = isActive(to)
            const isCart = !!center
            const isWishlist = to === '/wishlist'

            if (isCart) {
              return (
                <Link key={to} to={to} className="flex flex-col items-center gap-1 -mt-5 relative">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center relative transition-all duration-200 ${active ? 'bg-blue-600 shadow-[0_6px_24px_rgba(37,99,235,0.45)]' : 'bg-slate-900 shadow-[0_6px_24px_rgba(0,0,0,0.25)]'}`}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={active ? 2.5 : 1.75} />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                </Link>
              )
            }

            return (
              <Link key={to} to={to} className="flex flex-col items-center gap-1 py-1 px-3 relative min-w-[52px]">
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-all duration-200 ${active ? 'text-slate-900' : 'text-slate-400'}`}
                    strokeWidth={active ? 2.5 : 1.75}
                    style={{ fill: active && isWishlist ? 'currentColor' : 'none' }}
                  />
                  {isWishlist && wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {wishlistCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900" />}
              </Link>
            )
          })}

          {/* Account tab — opens popup */}
          <button
            onClick={() => setAccountOpen(o => !o)}
            className="flex flex-col items-center gap-1 py-1 px-3 relative min-w-[52px]"
          >
            <div className="relative">
              {user?.name ? (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${isAccountActive || accountOpen ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <CircleUser
                  className={`w-5 h-5 transition-all duration-200 ${isAccountActive || accountOpen ? 'text-slate-900' : 'text-slate-400'}`}
                  strokeWidth={isAccountActive || accountOpen ? 2.5 : 1.75}
                />
              )}
            </div>
            <span className={`text-[10px] font-semibold tracking-wide transition-colors ${isAccountActive || accountOpen ? 'text-slate-900' : 'text-slate-400'}`}>
              Account
            </span>
            {(isAccountActive || accountOpen) && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900" />
            )}
          </button>

        </div>
      </div>
    </nav>
  )
}
