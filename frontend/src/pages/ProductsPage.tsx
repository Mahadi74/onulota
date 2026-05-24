import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import {
  Star, ShoppingCart, SlidersHorizontal, X, ChevronDown,
  LayoutGrid, List, Heart, Package, Zap, ArrowRight, ShoppingBag,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Product {
  _id: string; name: string; price: number; compareAtPrice?: number
  images?: Array<{ url: string; thumbnail?: string }>
  averageRating?: number; reviewCount?: number; stock: number
  brand?: string; isFeatured?: boolean
}
interface Category { _id: string; name: string; slug: string; children?: Category[] }

/* ─── Custom Checkbox ────────────────────────────────────────────────── */
function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: React.ReactNode }) {
  return (
    <button onClick={onChange} className="flex items-center gap-3 w-full group py-1 text-left">
      <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150
        ${checked
          ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200'
          : 'border-slate-300 bg-white group-hover:border-blue-400'}`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={`text-sm leading-tight transition-colors ${checked ? 'text-blue-700 font-semibold' : 'text-slate-600 group-hover:text-slate-900'}`}>
        {label}
      </span>
    </button>
  )
}

/* ─── Radio ──────────────────────────────────────────────────────────── */
function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: React.ReactNode }) {
  return (
    <button onClick={onChange} className="flex items-center gap-3 w-full group py-1 text-left">
      <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150
        ${checked
          ? 'border-blue-600 shadow-sm shadow-blue-200'
          : 'border-slate-300 bg-white group-hover:border-blue-400'}`}
      >
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block" />}
      </span>
      <span className={`text-sm transition-colors ${checked ? 'text-blue-700 font-semibold' : 'text-slate-600 group-hover:text-slate-900'}`}>
        {label}
      </span>
    </button>
  )
}

/* ─── Filter Section ─────────────────────────────────────────────────── */
function FilterSection({ title, children, defaultOpen = true, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-4 text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{title}</span>
          {badge ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">{badge}</span>
          ) : null}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

/* ─── Price Slider ───────────────────────────────────────────────────── */
const PRICE_PRESETS = [
  { label: 'Under ৳500', min: '', max: '500' },
  { label: '৳500–2K', min: '500', max: '2000' },
  { label: '৳2K–5K', min: '2000', max: '5000' },
  { label: '৳5K+', min: '5000', max: '' },
]

/* ─── Skeleton ───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
        <div className="h-4 bg-slate-100 rounded-full w-4/5" />
        <div className="h-3 bg-slate-100 rounded-full w-3/5" />
        <div className="h-3 bg-slate-100 rounded-full w-1/4" />
        <div className="h-10 bg-slate-100 rounded-xl mt-1" />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [gridView, setGridView] = useState<'grid' | 'list'>('grid')
  const [showMoreBrands, setShowMoreBrands] = useState(false)
  const [localMin, setLocalMin] = useState('')
  const [localMax, setLocalMax] = useState('')
  const { addItem } = useCartStore()
  const { ids: wishlistIds, toggle: wishlistToggle } = useWishlistStore()
  const priceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const page     = parseInt(searchParams.get('page') || '1')
  const search   = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const brand    = searchParams.get('brand') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const minRating = searchParams.get('minRating') || ''
  const inStock  = searchParams.get('inStock') === 'true'
  const sortBy   = searchParams.get('sort') || 'newest'

  useEffect(() => { setLocalMin(minPrice); setLocalMax(maxPrice) }, [minPrice, maxPrice])

  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      value === null || value === '' ? n.delete(key) : n.set(key, value)
      n.delete('page'); return n
    })
  }, [setSearchParams])

  const setPrice = (min: string, max: string) => {
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      min ? n.set('minPrice', min) : n.delete('minPrice')
      max ? n.set('maxPrice', max) : n.delete('maxPrice')
      n.delete('page'); return n
    })
  }

  const hasActiveFilters = !!(category || brand || minPrice || maxPrice || minRating || inStock)

  const activeFilterCount = [category, brand, (minPrice || maxPrice), minRating, inStock].filter(Boolean).length

  const clearAllFilters = () => setSearchParams(prev => {
    const n = new URLSearchParams()
    if (prev.get('search')) n.set('search', prev.get('search')!)
    if (prev.get('sort')) n.set('sort', prev.get('sort')!)
    return n
  })

  /* ── Data ── */
  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, category, brand, minPrice, maxPrice, minRating, inStock, sortBy],
    queryFn: async () => {
      const params: Record<string, string> = { page: page.toString(), limit: '24', sortBy }
      if (search) params.q = search
      if (category) params.categoryId = category
      if (brand) params.brand = brand
      if (minPrice) params.minPrice = minPrice
      if (maxPrice) params.maxPrice = maxPrice
      if (minRating) params.minRating = minRating
      if (inStock) params.inStock = 'true'
      const endpoint = search ? '/api/products/search' : '/api/products'
      return (await apiClient.get(endpoint, { params })).data
    },
    placeholderData: prev => prev,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await apiClient.get('/api/categories')).data,
    staleTime: 300_000,
  })

  const { data: brandsData } = useQuery({
    queryKey: ['product-brands'],
    queryFn: async () => (await apiClient.get('/api/products/brands')).data,
    staleTime: 300_000,
  })

  const products: Product[]  = data?.products || []
  const pagination           = data?.pagination || { page: 1, pages: 1, total: 0 }
  const categories: Category[] = categoriesData?.categories || []
  const brands: string[]     = brandsData?.brands || []
  const visibleBrands        = showMoreBrands ? brands : brands.slice(0, 8)

  const toggleWishlist = (id: string) => wishlistToggle(id)

  /* ── Sidebar ── */
  const Sidebar = () => (
    <div>
      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-2 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Active</span>
            <button onClick={clearAllFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {category && (
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm shadow-blue-200">
                Category <button onClick={() => setParam('category', null)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {brand && (
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm shadow-blue-200">
                {brand} <button onClick={() => setParam('brand', null)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm shadow-blue-200">
                ৳{minPrice||'0'}–{maxPrice?`৳${maxPrice}`:'∞'}
                <button onClick={() => setPrice('', '')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {minRating && (
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm shadow-blue-200">
                {minRating}★+ <button onClick={() => setParam('minRating', null)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {inStock && (
              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm shadow-blue-200">
                In Stock <button onClick={() => setParam('inStock', null)}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <FilterSection title="Category" badge={category ? 1 : 0}>
          <div className="space-y-0.5">
            <Radio
              checked={!category}
              onChange={() => setParam('category', null)}
              label="All Categories"
            />
            {categories.map(cat => (
              <div key={cat._id}>
                <Radio
                  checked={category === cat._id}
                  onChange={() => setParam('category', cat._id)}
                  label={cat.name}
                />
                {cat.children?.map(child => (
                  <div key={child._id} className="pl-5">
                    <Radio
                      checked={category === child._id}
                      onChange={() => setParam('category', child._id)}
                      label={<span className="text-slate-500">{child.name}</span>}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Brand */}
      {brands.length > 0 && (
        <FilterSection title="Brand" badge={brand ? 1 : 0}>
          <div className="space-y-0.5">
            {visibleBrands.map(b => (
              <Checkbox
                key={b}
                checked={brand === b}
                onChange={() => setParam('brand', brand === b ? null : b)}
                label={b}
              />
            ))}
            {brands.length > 8 && (
              <button
                onClick={() => setShowMoreBrands(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 mt-2 pl-[30px]"
              >
                {showMoreBrands ? 'Show less' : `+${brands.length - 8} more brands`}
              </button>
            )}
          </div>
        </FilterSection>
      )}

      {/* Price */}
      <FilterSection title="Price Range" badge={(minPrice || maxPrice) ? 1 : 0}>
        <div className="space-y-3">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map(p => {
              const active = minPrice === p.min && maxPrice === p.max
              return (
                <button
                  key={p.label}
                  onClick={() => active ? setPrice('', '') : setPrice(p.min, p.max)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'border-slate-200 text-slate-600 bg-white hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {/* Custom range */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
              <input
                type="number"
                value={localMin}
                onChange={e => {
                  setLocalMin(e.target.value)
                  if (priceDebounce.current) clearTimeout(priceDebounce.current)
                  priceDebounce.current = setTimeout(() => setPrice(e.target.value, localMax), 600)
                }}
                placeholder="Min"
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
              />
            </div>
            <div className="w-4 h-px bg-slate-300 flex-shrink-0" />
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">৳</span>
              <input
                type="number"
                value={localMax}
                onChange={e => {
                  setLocalMax(e.target.value)
                  if (priceDebounce.current) clearTimeout(priceDebounce.current)
                  priceDebounce.current = setTimeout(() => setPrice(localMin, e.target.value), 600)
                }}
                placeholder="Max"
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
              />
            </div>
          </div>
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection title="Customer Rating" badge={minRating ? 1 : 0}>
        <div className="space-y-0.5">
          {[4, 3, 2].map(r => (
            <Radio
              key={r}
              checked={minRating === String(r)}
              onChange={() => setParam('minRating', minRating === String(r) ? null : String(r))}
              label={
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-slate-500 text-xs">& up</span>
                </div>
              }
            />
          ))}
        </div>
      </FilterSection>

      {/* Availability */}
      <FilterSection title="Availability" defaultOpen={true}>
        <Checkbox
          checked={inStock}
          onChange={() => setParam('inStock', inStock ? null : 'true')}
          label={
            <div className="flex items-center gap-2">
              <span>In Stock only</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          }
        />
      </FilterSection>
    </div>
  )

  /* ── Product Card ── */
  const ProductCard = ({ product }: { product: Product }) => {
    const img = product.images?.[0]?.thumbnail || product.images?.[0]?.url || ''
    const discount = product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0
    const isList = gridView === 'list'

    return (
      <div className={`group relative bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${isList ? 'rounded-2xl flex' : 'rounded-2xl flex flex-col'}`}>
        {/* Wishlist */}
        <button
          onClick={e => { e.preventDefault(); toggleWishlist(product._id) }}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 ${wishlistIds.includes(product._id) ? 'bg-rose-50 shadow-rose-100' : 'bg-white'}`}
        >
          <Heart className={`w-4 h-4 transition-all duration-200 ${wishlistIds.includes(product._id) ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-300'}`} />
        </button>

        {/* Image */}
        <Link to={`/products/${product._id}`} className={`relative bg-slate-50 overflow-hidden flex-shrink-0 ${isList ? 'w-40 h-40' : 'aspect-[4/3]'}`}>
          {img
            ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-slate-200" /></div>
          }
          {/* Badges */}
          {discount > 0 && (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-0.5 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <Zap className="w-2.5 h-2.5" />-{discount}%
            </span>
          )}
          {product.isFeatured && !discount && (
            <span className="absolute top-2.5 left-2.5 bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              Featured
            </span>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
        </Link>

        {/* Info */}
        <div className={`flex flex-col ${isList ? 'flex-1 p-5 justify-between' : 'p-4 flex-1'}`}>
          <div>
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-500 mb-1">{product.brand}</p>
            )}
            <Link to={`/products/${product._id}`}>
              <h3 className={`font-semibold text-slate-900 hover:text-blue-600 transition-colors leading-snug line-clamp-2 ${isList ? 'text-base' : 'text-sm'}`}>
                {product.name}
              </h3>
            </Link>
            {(product.averageRating ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(product.averageRating!) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'}`} />
                  ))}
                </div>
                <span className="text-xs text-slate-400">({product.reviewCount || 0})</span>
              </div>
            )}
          </div>

          <div className={`${isList ? '' : 'mt-3'}`}>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-lg font-extrabold text-blue-600">{formatBDT(product.price)}</span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs text-slate-400 line-through">{formatBDT(product.compareAtPrice)}</span>
              )}
            </div>
            {product.stock > 0 && product.stock <= 10 && (
              <p className="text-xs text-amber-600 font-semibold mb-2">Only {product.stock} left!</p>
            )}
            {product.stock === 0 ? (
              <span className="inline-flex items-center justify-center text-sm font-semibold rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed w-full py-2.5">
                Out of Stock
              </span>
            ) : (
              <div className="flex gap-1.5">
                {/* Order Now — icon-only on mobile 2-col grid, text+icon on sm+ */}
                <Link
                  to={`/products/${product._id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm shadow-blue-200 py-2.5 px-2 sm:px-3 min-w-0"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate">Order Now</span>
                </Link>
                {/* Add to Cart */}
                <button
                  onClick={e => {
                    e.preventDefault()
                    addItem({ _id: `${product._id}-${Date.now()}`, product: { _id: product._id, name: product.name, price: product.price, image: img }, quantity: 1, price: product.price })
                  }}
                  className="flex-none inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 w-10 py-2.5 text-blue-600 hover:bg-blue-100 active:scale-[0.98] transition-all"
                  title="Add to Cart"
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── Render ── */
  const pageTitle = search
    ? `"${search}" — Search Results`
    : category
    ? `${category} Products — Shop Online`
    : brand
    ? `${brand} — Shop Online`
    : 'All Products — Shop Online'

  const pageDescription = search
    ? `Search results for "${search}" on Onulota. Find the best deals and fast delivery across Bangladesh.`
    : category
    ? `Shop ${category} products on Onulota. Best prices and fast delivery across Bangladesh.`
    : 'Browse all products on Onulota. Best deals on fashion, electronics, home & more with fast delivery across Bangladesh.'

  return (
    <div className="min-h-screen bg-slate-50">

      <SEO title={pageTitle} description={pageDescription} noIndex={!!search} />

      {/* Page Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="sm:flex block items-center justify-between gap-4">
            <div className='mb-1'>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
                {search ? 'Search Results' : 'Explore'} : <h3 className="text-xl inline-block sm:text-sm font-extrabold text-slate-900">
                {search ? `"${search}"` : 'All Products'}
              </h3>
              </p>
              
              {!isLoading && (
                <p className="text-sm text-slate-400">
                  {pagination.total.toLocaleString()} products found
                  {hasActiveFilters && ' with active filters'}
                </p>
              )}
            </div>
            {/* Toolbar — Browse Categories + Filters + Sort + Grid in one row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Browse Categories */}
              <Link
                to="/categories"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 shadow-sm transition"
              >
                <ArrowRight className="w-4 h-4" /> Categories
              </Link>
              {/* Mobile filter button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                Filters
                {hasActiveFilters && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Mobile active filter chips */}
              {hasActiveFilters && (
                <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  {category && <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">Cat <button onClick={() => setParam('category', null)}><X className="w-3 h-3" /></button></span>}
                  {brand && <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">{brand} <button onClick={() => setParam('brand', null)}><X className="w-3 h-3" /></button></span>}
                  {(minPrice || maxPrice) && <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">Price <button onClick={() => setPrice('', '')}><X className="w-3 h-3" /></button></span>}
                  {minRating && <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">{minRating}★+ <button onClick={() => setParam('minRating', null)}><X className="w-3 h-3" /></button></span>}
                  {inStock && <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">In Stock <button onClick={() => setParam('inStock', null)}><X className="w-3 h-3" /></button></span>}
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setParam('sort', e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                  <option value="rating">Top Rated</option>
                  <option value="isFeatured">Featured</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Grid/List toggle */}
              <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {(['grid', 'list'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setGridView(v)}
                    className={`p-2.5 transition ${gridView === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    {v === 'grid' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* ── Desktop Sidebar ── */}
          <aside className="hidden lg:block w-[260px] flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-24">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Filters</h2>
                </div>
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="px-5">
                <Sidebar />
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="flex-1 min-w-0">

            {/* Grid */}
            {isLoading ? (
              <div className={`grid gap-4 ${gridView === 'grid' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-24 text-center">
                <Package className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-bold text-slate-700">No products found</p>
                <p className="text-sm text-slate-400 mt-1 mb-6">Try adjusting your filters or search terms</p>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm shadow-blue-200">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className={`grid gap-4 ${gridView === 'grid' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
                {products.map(p => <ProductCard key={p._id} product={p} />)}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-10">
                <button
                  disabled={page === 1}
                  onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page-1)); return n })}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                >
                  ← Prev
                </button>

                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 2)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i-1] as number) > 1) acc.push('...')
                    acc.push(p); return acc
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`e${i}`} className="w-9 text-center text-slate-400">…</span>
                    : (
                      <button
                        key={p}
                        onClick={() => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })}
                        className={`w-10 h-10 rounded-xl text-sm font-semibold transition shadow-sm ${
                          page === p ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                }

                <button
                  disabled={page === pagination.pages}
                  onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page+1)); return n })}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
                >
                  Next →
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-[300px] max-w-full bg-white z-50 lg:hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900">Filters</h2>
                {hasActiveFilters && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                )}
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5">
              <Sidebar />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-white">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-200"
              >
                Show {pagination.total.toLocaleString()} Results
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
