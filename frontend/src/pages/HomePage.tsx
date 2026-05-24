import { SEO } from '@/components/SEO'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { decodeHtml, decodeUrl } from '@/utils/decodeHtml'
import {
  ShoppingCart,
  Truck,
  Shield,
  Tag,
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowRight,
  Zap,
  Package,
  Headphones,
  ShoppingBag
} from 'lucide-react'

interface Product {
  _id: string
  name: string
  price: number
  compareAtPrice?: number
  images?: Array<{ url: string; thumbnail?: string }>
  image?: string
  averageRating?: number
  rating?: number
  reviewCount?: number
  stock?: number
}

interface HomepageSectionItem {
  _id: string
  title: string
  subtitle?: string
  description?: string
  image: string
  actionText?: string
  actionUrl?: string
  section?: string
  order?: number
}

/* ─── Fallback data ─────────────────────────────────────────────────── */

const CATEGORY_COLORS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-red-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-yellow-500 to-amber-600',
]

interface ApiCategory { _id: string; name: string; slug: string; image?: string }

const fallbackCarousel: HomepageSectionItem[] = [
  {
    _id: 'slide-1',
    title: 'Mega Brand Sale',
    description: 'Up to 70% off on top fashion and electronics',
    actionText: 'Shop Now',
    actionUrl: '/products',
    image: 'https://placehold.co/1200x600/1e1b4b/ffffff?text=Mega+Brand+Sale',
  },
  {
    _id: 'slide-2',
    title: 'Daily Flash Deals',
    description: 'New deals every hour for a limited time',
    actionText: 'See Offers',
    actionUrl: '/products',
    image: 'https://placehold.co/1200x600/0c4a6e/ffffff?text=Daily+Flash+Deals',
  },
  {
    _id: 'slide-3',
    title: 'Top Rated Picks',
    description: 'Products rated 4.5+ stars by our shoppers',
    actionText: 'Browse Top Picks',
    actionUrl: '/products',
    image: 'https://placehold.co/1200x600/064e3b/ffffff?text=Top+Rated+Picks',
  },
]

const fallbackAds: HomepageSectionItem[] = [
  { _id: 'ad-1', title: 'Free Delivery', subtitle: 'On orders above ৳2,000', image: 'https://placehold.co/480x300/6d28d9/ffffff?text=Free+Delivery' },
  { _id: 'ad-2', title: 'Easy Returns', subtitle: '7-day return policy', image: 'https://placehold.co/480x300/be185d/ffffff?text=Easy+Returns' },
  { _id: 'ad-3', title: 'Secure Pay', subtitle: 'SSLCommerz & bKash', image: 'https://placehold.co/480x300/0369a1/ffffff?text=Secure+Pay' },
  { _id: 'ad-4', title: 'Best Sellers', subtitle: 'Trending daily', image: 'https://placehold.co/480x300/0f766e/ffffff?text=Best+Sellers' },
]

const fallbackDeals: { label: string; title: string; description: string; image: string; href: string; actionText?: string }[] = [
  { label: 'Up to 50% OFF', title: 'Mobile Accessories', description: 'Chargers, cases, earbuds and more', image: 'https://placehold.co/600x400/1e40af/ffffff?text=Accessories', href: '/products', actionText: 'Shop Now' },
  { label: 'Buy 1 Get 1', title: 'Fashion Essentials', description: 'T-shirts, sandals, bags', image: 'https://placehold.co/600x400/7e22ce/ffffff?text=Fashion', href: '/products', actionText: 'See Offers' },
  { label: 'Free Delivery', title: 'Home & Kitchen', description: 'Cookware, furniture, decor', image: 'https://placehold.co/600x400/0c4a6e/ffffff?text=Home', href: '/products', actionText: 'Browse Now' },
]

const fallbackPromoBanners: HomepageSectionItem[] = [
  { _id: 'p1', title: 'Flash Sale — 70% OFF', description: 'Limited time deals on top brands', image: 'https://placehold.co/700x380/1e3a5f/ffffff?text=Flash+Sale', actionText: 'Shop Deals', actionUrl: '/products' },
  { _id: 'p2', title: 'Daily Essentials', description: 'Everything for home and family', image: 'https://placehold.co/700x380/1e3a5f/ffffff?text=Daily+Essentials', actionText: 'Browse Now', actionUrl: '/products' },
]

const fallbackFeatures = [
  { icon: Truck, title: 'Fast Delivery', description: 'Delivered across Bangladesh with trusted courier partners.' },
  { icon: Shield, title: 'Secure Payments', description: 'Multiple payment options with complete transaction protection.' },
  { icon: Heart, title: 'Customer First', description: 'Dedicated support and easy returns for every order.' },
]

/* ─── Skeleton Card ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="h-56 bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-100 rounded-full w-3/4" />
        <div className="h-4 bg-slate-100 rounded-full w-1/2" />
        <div className="h-10 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}

/* ─── Section Header ────────────────────────────────────────────────── */
function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between mb-8 gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1.5">{eyebrow}</p>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{title}</h2>
      </div>
      {action && onAction && (
        <button
          onClick={onAction}
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all"
        >
          {action} <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const navigate = useNavigate()
  const { addItem } = useCartStore()
  const { ids: wishlistIds, toggle: wishlistToggle } = useWishlistStore()
  const [activeSlide, setActiveSlide] = useState(0)
  const [wishlistToast, setWishlistToast] = useState<{ id: string; name: string; added: boolean } | null>(null)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Data fetching ── */
  const { data: homepageData } = useQuery<{
    heroBanners?: HomepageSectionItem[]
    carouselItems?: HomepageSectionItem[]
    ads?: HomepageSectionItem[]
    deals?: HomepageSectionItem[]
    promoBanners?: HomepageSectionItem[]
    features?: HomepageSectionItem[]
    brands?: HomepageSectionItem[]
    categoryHighlights?: HomepageSectionItem[]
    ctas?: HomepageSectionItem[]
  }>({
    queryKey: ['homepage-content'],
    queryFn: async () => (await apiClient.get('/api/homepage')).data,
    staleTime: 1000 * 60 * 5,
  })

  const { data: featuredProducts, isLoading: isFeaturedLoading } = useQuery<Product[]>({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const res = await apiClient.get('/api/products?limit=8&sortBy=rating')
      return res.data.products || []
    },
  })

  const { data: categoriesData } = useQuery<{ categories: ApiCategory[] }>({
    queryKey: ['categories-home'],
    queryFn: async () => (await apiClient.get('/api/categories')).data,
    staleTime: 1000 * 60 * 10,
  })

  /* ── Resolved data ── */
  const carouselItems = homepageData?.carouselItems?.length ? homepageData.carouselItems : fallbackCarousel
  const ads = homepageData?.ads?.length ? homepageData.ads : fallbackAds
  const promoBanners = homepageData?.promoBanners?.length ? homepageData.promoBanners : fallbackPromoBanners
  const dealCards = homepageData?.deals?.length
    ? homepageData.deals.map((d) => ({ label: d.subtitle, title: d.title, description: d.description || '', image: d.image, href: d.actionUrl || '/products', actionText: d.actionText }))
    : fallbackDeals

  // Use real categories with images from API; fall back to homepage highlights
  const categoryHighlights: { name: string; image?: string; href: string; color: string }[] = (() => {
    const apiCats = categoriesData?.categories
    if (apiCats?.length) {
      return apiCats.slice(0, 8).map((c, i) => ({
        name: c.name,
        image: c.image,
        href: `/categories/${c.slug}`,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
    }
    if (homepageData?.categoryHighlights?.length) {
      return homepageData.categoryHighlights.map((c, i) => ({
        name: c.title,
        image: c.image,
        href: c.actionUrl || '/categories',
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
    }
    return [
      { name: 'Mobile Phones', href: '/categories/electronics', color: CATEGORY_COLORS[0] },
      { name: 'Fashion', href: '/categories/fashion', color: CATEGORY_COLORS[1] },
      { name: 'Home & Living', href: '/categories/home', color: CATEGORY_COLORS[2] },
      { name: 'Electronics', href: '/categories/electronics', color: CATEGORY_COLORS[3] },
    ]
  })()
  const brands: HomepageSectionItem[] | null = homepageData?.brands?.length ? homepageData.brands : null
  const features = homepageData?.features?.length
    ? homepageData.features.map((f, i) => ({ icon: fallbackFeatures[i % fallbackFeatures.length].icon, image: f.image || null, title: f.title, description: f.description || f.subtitle || '' }))
    : fallbackFeatures.map((f) => ({ ...f, image: null }))
  const ctaData = homepageData?.ctas?.[0] || null

  const heroBanner = homepageData?.heroBanners?.[0] || null

  /* ── Mid-page carousel ── */
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselItems.length)
    }, 5000)
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current) }
  }, [carouselItems.length])

  const gotoSlide = (index: number) => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    setActiveSlide(index)
    autoPlayRef.current = setInterval(() => setActiveSlide((p) => (p + 1) % carouselItems.length), 5000)
  }

  const prevSlide = () => gotoSlide((activeSlide - 1 + carouselItems.length) % carouselItems.length)
  const nextSlide = () => gotoSlide((activeSlide + 1) % carouselItems.length)

  /* ── Cart & wishlist ── */
  const handleAddToCart = (product: Product) => {
    const img = product.images?.[0]?.thumbnail || product.images?.[0]?.url || product.image
    addItem({ _id: product._id, product: { _id: product._id, name: product.name, price: product.price, image: img }, quantity: 1, price: product.price })
  }
  const toggleWishlist = (id: string, name?: string) => {
    const added = !wishlistIds.includes(id)
    wishlistToggle(id)
    setWishlistToast({ id, name: name || '', added })
    setTimeout(() => setWishlistToast(null), 2500)
  }

  return (
    <div className="w-full bg-slate-50">

      <SEO
        title="Online Shopping Bangladesh — Best Deals & Fast Delivery"
        description="Shop the best deals on fashion, electronics, home & more. Free delivery on orders over ৳2,000. Daily flash sales and top brands — Onulota Bangladesh."
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Onulota',
          url: 'https://onulota.com',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://onulota.com/products?search={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      {/* ── Wishlist Toast ── */}
      {wishlistToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999]" style={{ animation: 'toastSlideUp 0.3s ease-out' }}>
          <style>{`@keyframes toastSlideUp { from { opacity:0; transform: translateX(-50%) translateY(16px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`}</style>
          <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl min-w-[240px]">
            <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${wishlistToast.added ? 'bg-rose-500' : 'bg-slate-600'}`}>
              <Heart className={`w-4 h-4 ${wishlistToast.added ? 'fill-white text-white' : 'text-white'}`} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{wishlistToast.name || 'Product'}</p>
              <p className="text-xs text-slate-400">{wishlistToast.added ? 'Added to wishlist' : 'Removed from wishlist'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO ════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        {/* Background: dynamic hero image or fallback gradient */}
        {heroBanner?.image
          ? <>
              <img
                src={decodeUrl(heroBanner.image)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/55" />
            </>
          : <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 75% 50%, #06b6d4 0%, transparent 50%)' }} />
        }

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] items-center">

            {/* Left: Hero copy */}
            <div className="space-y-6">
              { heroBanner?.subtitle && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                    {decodeHtml(heroBanner?.subtitle)}
                  </span>
                </div>
              )}
              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-white leading-[1.08] tracking-tight">
                {heroBanner?.title
                  && (decodeHtml(heroBanner.title).split(/\*(.+?)\*/).map((part, i) =>
                      i % 2 === 1
                        ? <span key={i} className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">{part}</span>
                        : <span key={i}>{part}</span>
                    )
                )}
              </h1>
              <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
                {decodeHtml(heroBanner?.description) || ''}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                { heroBanner?.actionText && heroBanner?.actionUrl && (
                  <button
                    onClick={() => navigate(decodeUrl(heroBanner?.actionUrl) || '/products')}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-all hover:scale-[1.02] active:scale-100"
                  >
                    {decodeHtml(heroBanner?.actionText) || 'Start Shopping'} <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => navigate('/products?sort=discount')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
                >
                  <Tag className="w-4 h-4" /> Flash Deals
                </button>
              </div>
              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
                {[{ icon: Truck, label: 'Fast Delivery' }, { icon: Shield, label: 'Secure Payment' }, { icon: Headphones, label: '24/7 Support' }].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-slate-400">
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Promo banners */}
            <div className="space-y-4 sm:block hidden">
              {promoBanners.slice(0, 2).map((banner) => (
                <button
                  key={banner._id}
                  onClick={() => navigate(decodeUrl(banner.actionUrl) || '/products')}
                  className="group relative w-full overflow-hidden rounded-2xl text-left"
                  style={{ minHeight: 160 }}
                >
                  <img src={decodeUrl(banner.image)} alt={decodeHtml(banner.title)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
                  <div className="relative p-6 flex flex-col justify-between h-full">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-300">{decodeHtml(banner.actionText) || 'Offer'}</p>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-3">{decodeHtml(banner.title)}</h3>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-1.5 text-xs font-semibold text-white group-hover:bg-white group-hover:text-blue-700 transition-colors">
                        Shop Now <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CAROUSEL + ADS ══════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] items-start">

          {/* Carousel */}
          <div className="relative group">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl aspect-[16/9] sm:aspect-[2/1]">
              {carouselItems.map((item, index) => (
                <div
                  key={item._id}
                  className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <img src={item.image} alt={item.title} className="h-full w-full object-contain" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                    <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">Limited Time</p>
                    <h3 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-200/90 mb-6 max-w-md hidden sm:block">{item.description}</p>
                    <button
                      onClick={() => navigate(item.actionUrl || '/products')}
                      className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-cyan-300 transition-all hover:scale-[1.02] shadow-lg shadow-cyan-500/30"
                    >
                      {item.actionText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Arrows */}
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-4 right-6 flex items-center gap-1.5">
                {carouselItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => gotoSlide(i)}
                    className={`rounded-full transition-all duration-300 ${i === activeSlide ? 'w-6 h-2 bg-cyan-400' : 'w-2 h-2 bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Ad cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
            {ads.slice(0, 4).map((ad) => (
              <div key={ad._id} className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                <div className="relative h-36 overflow-hidden">
                  <img src={ad.image} alt={ad.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{ad.subtitle}</p>
                    <h4 className="text-sm font-bold text-white leading-tight">{ad.title}</h4>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ DEALS ═══════════════════════════════════════════════════════ */}
      <section className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader eyebrow="Hot Deals" title="Limited Time Offers" action="View All" onAction={() => navigate('/products')} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dealCards.map((deal) => (
              <button
                key={deal.title}
                onClick={() => navigate(deal.href)}
                className="group relative overflow-hidden rounded-2xl text-left shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="relative h-52 overflow-hidden">
                  <img src={deal.image} alt={deal.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                </div>
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  { deal.label && (
                    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                      <Zap className="w-3 h-3" /> {deal.label}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white">{deal.title}</h3>
                  <p className="mt-1 text-sm text-slate-300/90">{deal.description}</p>
                  { deal?.actionText && (
                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-400 group-hover:gap-3 transition-all">
                      {deal?.actionText} <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    
      {/* ══ FEATURED PRODUCTS ═══════════════════════════════════════════ */}
      <section className="py-4 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader eyebrow="Featured" title="Top Picks for You" action="See All Products" onAction={() => navigate('/products')} />

          {isFeaturedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : featuredProducts && featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {featuredProducts.map((product) => (
                <div
                  key={product._id}
                  className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Wishlist */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(product._id, product.name) }}
                    className={`absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all duration-200 hover:scale-110 active:scale-95 ${wishlistIds.includes(product._id) ? 'bg-rose-50 shadow-rose-100' : 'bg-white'}`}
                  >
                    <Heart className={`w-4 h-4 transition-all duration-200 ${wishlistIds.includes(product._id) ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-300'}`} />
                  </button>

                  {/* Image */}
                  <div
                    onClick={() => navigate(`/products/${product._id}`)}
                    className="relative h-52 sm:h-56 bg-slate-50 overflow-hidden cursor-pointer"
                  >
                    {(() => {
                      const imgSrc = product.images?.[0]?.thumbnail || product.images?.[0]?.url || product.image || ''
                      const discountPct = product.compareAtPrice && product.compareAtPrice > product.price
                        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                        : 0
                      return (
                        <>
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={product.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="w-12 h-12 text-slate-300" />
                            </div>
                          )}
                          {discountPct > 0 && (
                            <span className="absolute top-3 left-3 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                              -{discountPct}%
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3
                      onClick={() => navigate(`/products/${product._id}`)}
                      className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      {product.name}
                    </h3>

                    {/* Star rating */}
                    {(() => {
                      const r = product.averageRating ?? product.rating
                      if (!r) return null
                      const full = Math.round(r)
                      return (
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < full ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'}`}
                            />
                          ))}
                          {product.reviewCount ? (
                            <span className="text-xs text-slate-400 ml-1">({product.reviewCount})</span>
                          ) : null}
                        </div>
                      )
                    })()}

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-lg font-bold text-blue-600">{formatBDT(product.price)}</span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-xs text-slate-400 line-through">{formatBDT(product.compareAtPrice)}</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/products/${product._id}`)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm shadow-blue-200"
                      >
                        <ShoppingBag className="w-4 h-4 shrink-0 sm:hidden inline" />
                        <span className="hidden sm:inline truncate">Order Now</span>
                      </button>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="flex-none inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-600 hover:bg-blue-100 active:scale-[0.98] transition-all"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="w-14 h-14 text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium">No products available yet</p>
            </div>
          )}

          {/* Mobile see all */}
          <div className="mt-8 text-center sm:hidden">
            <button onClick={() => navigate('/products')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
              See All Products <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

        {/* ══ CATEGORY CARDS ══════════════════════════════════════════════ */}
      <section className="bg-white py-10 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-500 mb-1">Shop by</p>
              <h2 className="text-2xl font-extrabold text-slate-900">Top Categories</h2>
            </div>
            <button
              onClick={() => navigate('/categories')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group"
            >
              See all <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categoryHighlights.map((cat) => (
              <button
                key={cat.name}
                onClick={() => navigate(cat.href)}
                className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left aspect-[3/2]"
              >
                {/* Real image or gradient fallback */}
                {cat.image ? (
                  <>
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent group-hover:from-slate-900/90 transition-all" />
                  </>
                ) : (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.color}`} />
                    <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
                  </>
                )}

                {/* Text overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-lg font-bold text-white leading-tight drop-shadow">{cat.name}</h3>
                  <div className="mt-1 inline-flex items-center gap-1 text-white/70 text-md font-medium group-hover:text-white transition-colors">
                    Shop now <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══ POPULAR BRANDS ══════════════════════════════════════════════ */}
      {brands && brands.length > 0 && (
        <section className="py-6 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader eyebrow="Brands" title="Popular Brands" />

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {brands.map((brand) => (
                <button
                  key={brand._id}
                  onClick={() => navigate(brand.actionUrl || '/products')}
                  className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-6 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md transition-all"
                >
                  <div className="h-12 w-full flex items-center justify-center overflow-hidden">
                    <img
                      src={brand.image}
                      alt={brand.title}
                      className="max-h-12 max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                      loading="lazy"
                    />
                  </div>
                  {brand.title && (
                    <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600 transition-colors text-center leading-tight">
                      {brand.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ WHY CHOOSE US ════════════════════════════════════════════════ */}
      <section className="py-4 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader eyebrow="Why Onulota" title="The Better Way to Shop" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon
              const gradients = [
                'from-blue-50 to-indigo-50 border-blue-100',
                'from-emerald-50 to-teal-50 border-emerald-100',
                'from-rose-50 to-pink-50 border-rose-100',
              ]
              const iconColors = ['text-blue-600 bg-blue-100', 'text-emerald-600 bg-emerald-100', 'text-rose-600 bg-rose-100']
              return (
                <div key={i} className={`rounded-2xl border bg-gradient-to-br ${gradients[i % gradients.length]} p-8`}>
                  {f.image ? (
                    <div className="h-14 w-14 mb-5 rounded-2xl overflow-hidden">
                      <img src={f.image} alt={f.title} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${iconColors[i % iconColors.length]} mb-5`}>
                      <Icon className="w-7 h-7" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden py-20"
        style={
          ctaData?.image
            ? { backgroundImage: `url(${ctaData.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {/* Gradient overlay — always shown; on top of bg image if present */}
        <div className={`absolute inset-0 ${ctaData?.image ? 'bg-gradient-to-br from-blue-900/75 via-blue-800/70 to-indigo-900/75' : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800'}`} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 0%, transparent 50%), radial-gradient(circle at 80% 50%, #93c5fd 0%, transparent 50%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-4">
            {ctaData?.subtitle || 'Ready to save?'}
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            {ctaData?.title || 'Shop the best deals in Bangladesh'}
          </h2>
          <p className="text-base sm:text-lg text-blue-100/90 mb-10 max-w-xl mx-auto leading-relaxed">
            {ctaData?.description || 'Explore trending deals, category promos, and curated products — all in one place.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate(ctaData?.actionUrl || '/products')}
              className="inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 text-sm font-bold text-blue-700 shadow-2xl shadow-blue-900/30 hover:bg-slate-50 hover:scale-[1.02] active:scale-100 transition-all"
            >
              {ctaData?.actionText || 'Browse Products'} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/products?sort=discount')}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-10 py-4 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              <Tag className="w-4 h-4" /> View Flash Deals
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
