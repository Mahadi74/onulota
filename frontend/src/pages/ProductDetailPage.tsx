import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  Star, ShoppingCart, Minus, Plus, Heart, ChevronLeft,
  ChevronRight, Package, Shield, Truck, RotateCcw, ChevronDown,
  Share2, Copy, Check,
} from 'lucide-react'

interface ProductImage { url: string; thumbnail?: string }
interface RelatedProduct {
  _id: string; name: string; price: number; compareAtPrice?: number
  stock?: number; images?: ProductImage[]; averageRating?: number; reviewCount?: number
}

/* ─── Zoom hook ───────────────────────────────────────────────────────── */
function useZoom() {
  const [zoom, setZoom] = useState(false)
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.round(((e.clientX - left) / width) * 100),
      y: Math.round(((e.clientY - top) / height) * 100),
    })
  }, [])

  return { zoom, setZoom, pos, ref, onMove }
}

/* ─── Accordion ───────────────────────────────────────────────────────── */
function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 animate-fade-in">{children}</div>}
    </div>
  )
}

/* ─── Star rating ─────────────────────────────────────────────────────── */
function StarRating({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-${size} h-${size} ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`}
        />
      ))}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addItem } = useCartStore()
  const { ids: wishlistIds, toggle: wishlistToggle } = useWishlistStore()
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [thumbStart, setThumbStart] = useState(0)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { zoom, setZoom, pos, ref: zoomRef, onMove } = useZoom()
  const THUMB_VISIBLE = 6

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await apiClient.get(`/api/products/${id}`)).data,
    enabled: !!id,
  })

  const categoryId = typeof product?.category === 'string'
    ? product.category : product?.category?._id ?? ''

  const { data: relatedProductsData, isLoading: relatedLoading } = useQuery<RelatedProduct[]>({
    queryKey: ['related-products', categoryId, id],
    queryFn: async () => (await apiClient.get(`/api/products/${id}/related?limit=12`)).data,
    enabled: !!categoryId && !!id,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message="Failed to load product details" />
  if (!product) return <ErrorMessage message="Product not found" />

  const images: ProductImage[] = product.images?.length ? product.images : []
  const activeUrl = images[activeImg]?.url || ''
  const productUrl = typeof window !== 'undefined' ? window.location.href : ''
  const ogImage = images[0]?.url || ''
  const metaDescription = product.description
    ? product.description.slice(0, 160)
    : `Buy ${product.name} at the best price. ${product.brand ? `Brand: ${product.brand}.` : ''} Fast delivery across Bangladesh.`
  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0
  const categoryName = typeof product.category === 'string'
    ? product.category : product.category?.name || 'Uncategorized'
  const relatedProducts: RelatedProduct[] = relatedProductsData || []
  const isWishlisted = wishlistIds.includes(product._id)
  const colors: string[] = product.colors || []
  const sizes: string[] = product.sizes || []

  // In production nginx routes /share → backend on same origin.
  // Share the canonical product URL — the Vercel OG function serves rich
  // meta tags to crawlers at /products/:id, so Facebook/WhatsApp pick up
  // the image correctly. The old /share path was a backend-only route that
  // the frontend Vercel project doesn't know about.
  const backendShareUrl = `${window.location.origin}/products/${product._id}`

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(backendShareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(backendShareUrl)}`, '_blank', 'width=600,height=400')
  }

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(product.name + ' — ' + backendShareUrl)}`, '_blank')
  }

  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(product.name)}&url=${encodeURIComponent(backendShareUrl)}`, '_blank', 'width=600,height=400')
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  const handleNativeShare = () => {
    // Use native share sheet only on real mobile devices (Android/iOS)
    // On desktop it shows system apps (AirDrop, Mail) instead of WhatsApp/Facebook
    if (isMobile && navigator.share) {
      navigator.share({ title: product.name, text: metaDescription, url: backendShareUrl })
    } else {
      setShareOpen(o => !o)
    }
  }

  const handleAddToCart = () => {
    addItem({ _id: product._id, product: { _id: product._id, name: product.name, price: product.price, image: activeUrl }, quantity, price: product.price })
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleBuyNow = () => {
    addItem({ _id: product._id, product: { _id: product._id, name: product.name, price: product.price, image: activeUrl }, quantity, price: product.price })
    navigate('/checkout')
  }

  const prevImg = () => setActiveImg(i => (i - 1 + images.length) % images.length)
  const nextImg = () => setActiveImg(i => (i + 1) % images.length)

  return (
    <div className="min-h-screen bg-background">

      {/* ── SEO Meta Tags ── */}
      <Helmet>
        <title>{product.name} — {product.brand ? `${product.brand} | ` : ''}Onulota</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={productUrl} />

        {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={productUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        {ogImage && <meta property="og:image:width" content="1200" />}
        {ogImage && <meta property="og:image:height" content="630" />}
        <meta property="og:site_name" content="Onulota" />
        <meta property="product:price:amount" content={String(product.price)} />
        <meta property="product:price:currency" content="BDT" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={product.name} />
        <meta name="twitter:description" content={metaDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}

        {/* Product Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description || metaDescription,
            image: images.map((img: ProductImage) => img.url),
            brand: { '@type': 'Brand', name: product.brand || 'Onulota' },
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: 'BDT',
              availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: 'Onulota' },
            },
            ...(product.averageRating > 0 ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.averageRating,
                reviewCount: product.reviewCount || 1,
              },
            } : {}),
          })}
        </script>
      </Helmet>

      {/* ── Breadcrumb ── */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-[57px] z-30">
        <div className="page-container py-2.5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <Link to="/products" className="hover:text-foreground transition-colors">Products</Link>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="text-foreground font-medium truncate max-w-[240px]">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="page-container py-4 lg:py-8">

        {/* ── External zoom panel ── */}
        {zoom && activeUrl && (
          <div
            className="hidden lg:block fixed z-50 w-[500px] h-[500px] rounded-3xl border border-border shadow-2xl overflow-hidden pointer-events-none"
            style={{
              top: zoomRef.current?.getBoundingClientRect().top ?? 100,
              left: (zoomRef.current?.getBoundingClientRect().right ?? 800) + 20,
              backgroundImage: `url(${activeUrl})`,
              backgroundSize: '300% 300%',
              backgroundPosition: `${pos.x}% ${pos.y}%`,
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'hsl(220 14% 97%)',
            }}
          />
        )}

        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 xl:gap-20 items-start">

          {/* ── LEFT: Gallery ── */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-28">

            {/* Main image */}
            <div
              ref={zoomRef}
              className="relative bg-[#f8f8f8] rounded-3xl overflow-hidden select-none cursor-crosshair"
              style={{ aspectRatio: '1/1' }}
              onMouseEnter={() => setZoom(true)}
              onMouseLeave={() => setZoom(false)}
              onMouseMove={onMove}
            >
              {activeUrl ? (
                <img
                  src={activeUrl}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ padding: '6%' }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-24 h-24 text-muted-foreground/10" />
                </div>
              )}

              {/* Lens */}
              {zoom && activeUrl && (
                <div
                  className="absolute pointer-events-none border border-foreground/20 bg-white/10 rounded"
                  style={{ width: 80, height: 80, top: `calc(${pos.y}% - 40px)`, left: `calc(${pos.x}% - 40px)` }}
                />
              )}

              {/* Discount badge */}
              {discount > 0 && (
                <span className="absolute top-4 left-4 z-10 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  -{discount}%
                </span>
              )}

              {/* Out of stock */}
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <span className="bg-foreground text-background text-sm font-bold px-5 py-2 rounded-full shadow-lg tracking-wide">
                    Out of Stock
                  </span>
                </div>
              )}

              {/* Wishlist */}
              <button
                onClick={() => wishlistToggle(product._id)}
                className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border transition-all duration-200 hover:scale-110 active:scale-95 ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-100'
                    : 'bg-white/90 border-border hover:bg-white'
                }`}
              >
                <Heart className={`w-5 h-5 transition-all ${isWishlisted ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
              </button>

              {/* Prev / Next */}
              {images.length > 1 && (
                <>
                  <button onClick={prevImg} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-sm border border-border flex items-center justify-center hover:bg-white hover:shadow-md transition-all">
                    <ChevronLeft className="w-4 h-4 text-foreground" />
                  </button>
                  <button onClick={nextImg} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-sm border border-border flex items-center justify-center hover:bg-white hover:shadow-md transition-all">
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </button>
                </>
              )}

              {/* Zoom hint */}
              {!zoom && activeUrl && (
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full whitespace-nowrap pointer-events-none border border-border/50">
                  Hover to zoom
                </span>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={() => setThumbStart(s => Math.max(0, s - 1))}
                  disabled={thumbStart === 0}
                  className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-20 hover:bg-muted transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                <div className="flex gap-2 flex-1 overflow-hidden">
                  {images.slice(thumbStart, thumbStart + THUMB_VISIBLE).map((img, i) => {
                    const realIdx = thumbStart + i
                    return (
                      <button
                        key={realIdx}
                        onClick={() => setActiveImg(realIdx)}
                        className={`w-[60px] h-[60px] flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-[#f8f8f8] ${
                          activeImg === realIdx
                            ? 'border-foreground scale-105 shadow-sm'
                            : 'border-transparent opacity-50 hover:opacity-100 hover:border-border'
                        }`}
                      >
                        <img src={img.thumbnail || img.url} alt={`View ${realIdx + 1}`} className="w-full h-full object-contain p-1" loading="lazy" />
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setThumbStart(s => Math.min(images.length - THUMB_VISIBLE, s + 1))}
                  disabled={thumbStart + THUMB_VISIBLE >= images.length}
                  className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center disabled:opacity-20 hover:bg-muted transition-colors flex-shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Product info ── */}
          <div className="space-y-6 lg:py-2">

            {/* Brand + category pill + Share */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {product.brand && (
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">{product.brand}</span>
                )}
                {product.brand && <span className="text-border">·</span>}
                <span className="text-xs text-muted-foreground">{categoryName}</span>
              </div>

              {/* Share button */}
              <div className="relative">
                <button
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>

                {/* Share dropdown */}
                {shareOpen && (
                  <div className="absolute right-0 top-9 z-50 w-56 bg-background border border-border rounded-2xl shadow-xl overflow-hidden animate-fade-in">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1">Share this product</p>

                    {/* Facebook */}
                    <button onClick={handleShareFacebook} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1877F2] text-white text-xs font-bold flex-shrink-0">f</span>
                      Facebook
                    </button>

                    {/* WhatsApp */}
                    <button onClick={handleShareWhatsApp} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-[#25D366] text-white flex-shrink-0">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.131.558 4.13 1.533 5.864L0 24l6.278-1.506A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.214-3.727.894.944-3.631-.235-.374A9.818 9.818 0 1112 21.818z"/></svg>
                      </span>
                      WhatsApp
                    </button>

                    {/* Twitter / X */}
                    <button onClick={handleShareTwitter} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-black text-white flex-shrink-0">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </span>
                      Twitter / X
                    </button>

                    {/* Copy link */}
                    <button onClick={handleCopyLink} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground border-t border-border mt-1">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-muted border border-border flex-shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </span>
                      {copied ? 'Link copied!' : 'Copy link'}
                    </button>

                    <div className="px-4 pb-3 pt-2">
                      <p className="text-[10px] text-muted-foreground truncate">{backendShareUrl}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Click-outside to close share dropdown */}
            {shareOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
            )}

            {/* Name */}
            <h1 className="text-[1.65rem] sm:text-[2rem] font-extrabold text-foreground leading-[1.15] tracking-tight">
              {product.name}
            </h1>

            {/* Rating */}
            {product.averageRating > 0 && (
              <div className="flex items-center gap-2.5">
                <StarRating rating={product.averageRating} />
                <span className="text-sm font-semibold text-foreground">{product.averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({product.reviewCount || 0} reviews)</span>
              </div>
            )}

            {/* Price block */}
            <div className="py-2 border-y border-border">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">{formatBDT(product.price)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <>
                    <span className="text-xl text-muted-foreground line-through font-medium">{formatBDT(product.compareAtPrice)}</span>
                    <span className="badge badge-danger text-xs">{discount}% off</span>
                  </>
                )}
              </div>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <p className="text-sm text-green-600 font-semibold mt-1">
                  You save {formatBDT(product.compareAtPrice - product.price)}
                </p>
              )}
            </div>

            {/* Color selector */}
            {colors.length > 0 && (
              <div>
                <p className="label">
                  Color — <span className="font-normal text-muted-foreground">{selectedColor || 'Select one'}</span>
                </p>
                <div className="flex gap-2.5 flex-wrap mt-1">
                  {colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                      title={color}
                      className={`w-9 h-9 rounded-full transition-all hover:scale-110 ${
                        selectedColor === color
                          ? 'ring-2 ring-foreground ring-offset-2'
                          : 'ring-1 ring-border hover:ring-muted-foreground'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {sizes.length > 0 && (
              <div>
                <p className="label">
                  Size — <span className="font-normal text-muted-foreground">{selectedSize || 'Select one'}</span>
                </p>
                <div className="flex gap-2 flex-wrap mt-1">
                  {sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                      className={`min-w-[48px] px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                        selectedSize === size
                          ? 'border-foreground bg-foreground text-background shadow-sm'
                          : 'border-border text-foreground hover:border-foreground/50 bg-background'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            
            <div className='flex'>
              {/* Quantity */}
              {product.stock > 0 && (
                <div className="flex items-center gap-4">
                  <p className="label mb-0 flex-shrink-0">Qty</p>
                  <div className="flex items-center border border-border rounded-xl overflow-hidden bg-background w-fit">
                    <button
                      onClick={() => quantity > 1 && setQuantity(q => q - 1)}
                      disabled={quantity <= 1}
                      className="px-4 py-2.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-5 py-2.5 font-bold text-foreground border-x border-border min-w-[52px] text-center tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => quantity < product.stock && setQuantity(q => q + 1)}
                      disabled={quantity >= product.stock}
                      className="px-4 py-2.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {quantity > 1 && (
                    <span className="text-sm text-muted-foreground">
                      = <span className="font-bold text-foreground">{formatBDT(product.price * quantity)}</span>
                    </span>
                  )}
                </div>
              )}
              {/* Stock indicator */}
              <div className="flex items-center gap-2 ml-2">
                {product.stock > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      {product.stock <= 10 ? `Only ${product.stock} left` : 'In Stock'}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    Out of Stock
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="flex sm:flex-row flex-col gap-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className={`btn btn-lg w-full text-[0.95rem] font-bold tracking-tight shadow-sm ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : 'bg-foreground text-background hover:bg-foreground/85'
                }`}
              >
                <ShoppingCart className="w-[18px] h-[18px]" />
                {addedToCart ? '✓ Added to Cart' : 'Add to cart'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="btn btn-lg w-full text-[0.95rem] font-bold tracking-tight border-2 border-blue-600 hover:border-foreground/60 bg-background text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-30 disabled:border-border"
              >
                Buy it now
              </button>
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { icon: Truck,     label: 'Free Delivery', sub: 'Orders over ৳2,000' },
                { icon: RotateCcw, label: 'Easy Returns',  sub: '7-day policy' },
                { icon: Shield,    label: 'Secure Pay',    sub: 'SSL encrypted' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/50 border border-border/60 text-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                  <p className="text-[11px] font-bold text-foreground leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
                </div>
              ))}
            </div>

            {/* Accordions */}
            <div className="pt-2">
              <AccordionSection title="Description">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description || 'No description available.'}
                </p>
              </AccordionSection>
              <AccordionSection title="Shipping & Returns">
                <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                  <p>Free shipping on orders over ৳2,000. Standard delivery 3–5 business days across Bangladesh.</p>
                  <p>Easy 7-day returns on all items. Items must be unused and in original packaging.</p>
                </div>
              </AccordionSection>
              <AccordionSection title="Details">
                <dl className="text-sm text-muted-foreground space-y-2">
                  {[
                    { label: 'Category', value: categoryName },
                    ...(product.brand ? [{ label: 'Brand', value: product.brand }] : []),
                    { label: 'SKU', value: product._id.slice(-8).toUpperCase() },
                    { label: 'Stock', value: `${product.stock} units available` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3">
                      <dt className="w-20 flex-shrink-0 text-muted-foreground/70">{label}</dt>
                      <dd className="font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionSection>
            </div>
          </div>
        </div>

        {/* ── Related Products ── */}
        <section className="mt-16 pt-12 border-t border-border">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-subtitle">You may also like</p>
              <h2 className="section-title">Related Products</h2>
            </div>
            {relatedProducts.length > 0 && (
              <span className="text-sm text-muted-foreground">{relatedProducts.length} items</span>
            )}
          </div>

          {relatedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-square rounded-2xl mb-3" />
                  <div className="skeleton h-3 rounded w-3/4 mb-2" />
                  <div className="skeleton h-4 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : relatedProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No related products found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {relatedProducts.map((related) => {
                const relImg = related.images?.[0]?.url || ''
                const relDiscount = related.compareAtPrice && related.compareAtPrice > related.price
                  ? Math.round(((related.compareAtPrice - related.price) / related.compareAtPrice) * 100) : 0
                return (
                  <div
                    key={related._id}
                    onClick={() => navigate(`/products/${related._id}`)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-square bg-surface-50 rounded-2xl overflow-hidden mb-3 border border-border">
                      {relImg
                        ? <img src={relImg} alt={related.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground/20" /></div>
                      }
                      {relDiscount > 0 && (
                        <span className="badge badge-danger absolute top-2 left-2 text-[10px]">-{relDiscount}%</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug mb-1">{related.name}</p>
                    {(related.averageRating ?? 0) > 0 && (
                      <StarRating rating={related.averageRating!} size={3} />
                    )}
                    <p className="text-sm font-bold text-foreground mt-1">{formatBDT(related.price)}</p>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        addItem({ _id: related._id, product: { _id: related._id, name: related.name, price: related.price, image: relImg }, quantity: 1, price: related.price })
                      }}
                      disabled={related.stock === 0}
                      className="btn btn-secondary btn-sm mt-2 w-full hover:bg-foreground hover:text-background hover:border-foreground disabled:opacity-40"
                    >
                      {related.stock === 0 ? 'Out of Stock' : 'Add to cart'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
