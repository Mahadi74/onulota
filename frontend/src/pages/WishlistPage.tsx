import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCartStore } from '@/store/cartStore'
import { formatBDT } from '@/utils/currency'
import apiClient from '@/services/api/client'
import { Heart, ShoppingCart, Trash2, Package, ArrowRight } from 'lucide-react'

interface Product {
  _id: string
  name: string
  price: number
  compareAtPrice?: number
  images?: Array<{ url: string; thumbnail?: string }>
  stock: number
  brand?: string
  averageRating?: number
}

export default function WishlistPage() {
  const navigate = useNavigate()
  const { ids, toggle } = useWishlistStore()
  const { addItem } = useCartStore()

  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['wishlist-products', ids],
    queryFn: async () => {
      if (ids.length === 0) return { products: [] }
      return (await apiClient.get('/api/products', { params: { ids: ids.join(','), limit: 100 } })).data
    },
    enabled: ids.length > 0,
  })

  const products = data?.products?.filter(p => ids.includes(p._id)) ?? []

  const handleAddToCart = (product: Product) => {
    const img = product.images?.[0]?.thumbnail || product.images?.[0]?.url
    addItem({
      _id: product._id,
      product: { _id: product._id, name: product.name, price: product.price, image: img },
      quantity: 1,
      price: product.price,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-1">My</p>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <Heart className="w-6 h-6 fill-rose-500 text-rose-500" />
                Wishlist
                {ids.length > 0 && (
                  <span className="text-sm font-semibold text-slate-400 ml-1">({ids.length} items)</span>
                )}
              </h1>
            </div>
            {ids.length > 0 && (
              <button
                onClick={() => useWishlistStore.getState().clear()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Empty state */}
        {ids.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-rose-300" style={{ fill: 'none', strokeWidth: 1.5 }} />
            </div>
            <p className="text-lg font-bold text-slate-700 mb-1">Your wishlist is empty</p>
            <p className="text-sm text-slate-400 mb-6">Save your favourite products here</p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm shadow-blue-200"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {ids.length > 0 && isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ids.map(id => (
              <div key={id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-slate-100 rounded-full w-4/5" />
                  <div className="h-4 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-9 bg-slate-100 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => {
              const img = product.images?.[0]?.thumbnail || product.images?.[0]?.url || ''
              const discount = product.compareAtPrice && product.compareAtPrice > product.price
                ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0

              return (
                <div key={product._id} className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">
                  {/* Remove button */}
                  <button
                    onClick={() => toggle(product._id)}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-rose-50 hover:scale-110 active:scale-95 transition-all"
                    title="Remove from wishlist"
                  >
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  </button>

                  {/* Discount badge */}
                  {discount > 0 && (
                    <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                      -{discount}%
                    </span>
                  )}

                  {/* Image */}
                  <Link to={`/products/${product._id}`} className="relative aspect-[4/3] bg-slate-50 overflow-hidden block">
                    {img
                      ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-slate-200" /></div>
                    }
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    {product.brand && (
                      <p className="text-[11px] font-bold uppercase tracking-widest text-blue-500 mb-1">{product.brand}</p>
                    )}
                    <Link to={`/products/${product._id}`}>
                      <h3 className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors leading-snug line-clamp-2 mb-2">{product.name}</h3>
                    </Link>
                    <div className="mt-auto">
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-lg font-extrabold text-blue-600">{formatBDT(product.price)}</span>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <span className="text-xs text-slate-400 line-through">{formatBDT(product.compareAtPrice)}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock === 0}
                        className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-2.5 transition-all shadow-sm ${
                          product.stock === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-200'
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
