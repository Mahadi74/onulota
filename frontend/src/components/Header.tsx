import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, User, LayoutDashboard, Heart, Package, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/services/api/client'

export const Header: React.FC = () => {
  const { data: settings } = useQuery<{ siteName: string; logoUrl?: string }>({
    queryKey: ['site-settings'],
    queryFn: async () => (await apiClient.get('/api/settings')).data,
    staleTime: 1000 * 60 * 5,
  })
  const siteName = settings?.siteName || 'onulota'
  const logoUrl = settings?.logoUrl
  const [searchQuery, setSearchQuery] = useState('')
  const [cartBounce, setCartBounce] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { items } = useCartStore()
  const { ids: wishlistIds } = useWishlistStore()
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const wishlistCount = wishlistIds.length
  const prevCountRef = useRef(cartItemCount)

  useEffect(() => {
    if (cartItemCount > prevCountRef.current) {
      setCartBounce(true)
      setTimeout(() => setCartBounce(false), 600)
    }
    prevCountRef.current = cartItemCount
  }, [cartItemCount])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    setProfileOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <style>{`
        @keyframes cartBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.45); }
          60%  { transform: scale(0.9); }
          80%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .cart-bounce { animation: cartBounce 0.55s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-14 object-contain" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">{siteName}</div>
              )}
            </Link>

            {/* Search Bar */}
            <form
              onSubmit={handleSearch}
              className="flex-1 max-w-md relative"
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-6">
              {/* Wishlist */}
              <Link to="/wishlist" className="relative group">
                <Heart className={`w-6 h-6 transition-all duration-200 ${wishlistCount > 0 ? ' text-gray-700 scale-110' : 'text-gray-400 group-hover:text-gray-400'}`} style={{ fill: wishlistCount > 0 ? undefined : 'none', strokeWidth: 1.75 }} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              {/* Cart */}
              <Link to="/cart" className="relative">
                <ShoppingCart className={`w-6 h-6 text-gray-700 hover:text-blue-600 ${cartBounce ? 'cart-bounce' : ''}`} />
                {cartItemCount > 0 && (
                  <span key={cartItemCount} className={`absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md shadow-blue-200 ${cartBounce ? 'cart-bounce' : ''}`}>
                    {cartItemCount}
                  </span>
                )}
              </Link>

              {/* User Menu */}
              {user ? (
                <div className="flex items-center gap-3">
                  {user.role === 'admin' && (
                    <Link
                      to="/admin/dashboard"
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                  {/* Profile dropdown */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(o => !o)}
                      className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      {/* <span className="text-sm font-medium max-w-[100px] truncate">{user.name}</span> */}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {profileOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 truncate">{user.name}</p>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <User className="w-4 h-4 text-slate-400" />
                          My Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Package className="w-4 h-4 text-slate-400" />
                          My Orders
                        </Link>
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header — logo + search only; nav handled by BottomNav */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 w-[120px]">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 object-contain" />
            ) : (
              <div className="text-xl font-bold text-blue-600">{siteName}</div>
            )}
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-sm bg-slate-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </header>
  )
}
