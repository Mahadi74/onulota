import { Link, useLocation } from 'react-router-dom'
import { Home, ShoppingBag, ShoppingCart, Heart, User } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'

const TABS = [
  { to: '/',         icon: Home,         label: 'Home'      },
  { to: '/orders',   icon: ShoppingBag,   label: 'Orders'    },
  { to: '/cart',     icon: ShoppingCart,  label: 'Cart',  center: true },
  { to: '/wishlist', icon: Heart,         label: 'Wishlist'  },
  { to: '/profile',  icon: User,          label: 'Account'   },
]

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation()
  const cartCount = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))
  const wishlistCount = useWishlistStore(s => s.ids.length)

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50">
      {/* Frosted glass card */}
      <div className="mx-3 mb-3 rounded-[26px] bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] border border-white/60">
        <div className="flex items-end justify-around px-2 pt-3 pb-2">
          {TABS.map(({ to, icon: Icon, label, center }) => {
            const active = isActive(to)
            const isCart = !!center
            const isWishlist = to === '/wishlist'

            if (isCart) {
              return (
                <Link key={to} to={to} className="flex flex-col items-center gap-1 -mt-5 relative">
                  {/* Elevated floating circle */}
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center relative
                    transition-all duration-200
                    ${active
                      ? 'bg-blue-600 shadow-[0_6px_24px_rgba(37,99,235,0.45)]'
                      : 'bg-slate-900 shadow-[0_6px_24px_rgba(0,0,0,0.25)]'
                    }
                  `}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={active ? 2.5 : 1.75} />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                    {label}
                  </span>
                </Link>
              )
            }

            return (
              <Link key={to} to={to} className="flex flex-col items-center gap-1 py-1 px-3 relative min-w-[52px]">
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-all duration-200 ${active ? 'text-slate-900' : 'text-slate-400'}`}
                    strokeWidth={active ? 2.5 : 1.75}
                    style={{ fill: active && (to === '/wishlist') ? 'currentColor' : 'none' }}
                  />
                  {isWishlist && wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {wishlistCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {label}
                </span>
                {/* Active dot indicator */}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
