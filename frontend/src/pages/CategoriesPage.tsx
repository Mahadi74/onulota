import { useNavigate } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { ArrowRight, Grid3X3, ChevronRight, Package } from 'lucide-react'

interface Category {
  _id: string
  name: string
  slug: string
  description?: string
  image?: string
  productCount?: number
  parent?: string | null
  children?: Category[]
}

const CATEGORY_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-500',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-red-500 to-rose-700',
  'from-indigo-500 to-blue-700',
  'from-fuchsia-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-lime-500 to-green-600',
]

const CATEGORY_ICONS = ['📱', '👗', '🏠', '💻', '🎧', '👟', '📷', '🛋️', '🎮', '📚', '🍳', '⌚', '🧴', '🚗', '🌿']

function getTotalProductCount(category: Category): number {
  const own = category.productCount || 0
  const childTotal = (category.children || []).reduce(
    (sum, child) => sum + getTotalProductCount(child),
    0
  )
  return own + childTotal
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <div className="h-40 bg-slate-100" />
      <div className="p-5 space-y-2">
        <div className="h-4 bg-slate-100 rounded-full w-2/3" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  const navigate = useNavigate()

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const res = await apiClient.get('/api/categories')
      const list = res.data?.categories || res.data || []
      return Array.isArray(list) ? list : []
    },
    staleTime: 1000 * 60 * 5,
  })

  // API returns a tree — root nodes are parentCategories, their children are subCategories
  const parentCategories: Category[] = Array.isArray(categories) ? categories : []
  const subCategories: Category[] = parentCategories.flatMap((c) => c.children || [])

  return (
    <div className="min-h-screen bg-slate-50">

      <SEO
        title="All Categories — Shop by Category"
        description="Browse all product categories at Onulota. Find fashion, electronics, home & kitchen, beauty and more. Fast delivery across Bangladesh."
      />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-16 sm:py-20">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 60%, #3b82f6 0%, transparent 45%), radial-gradient(circle at 80% 40%, #06b6d4 0%, transparent 45%)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-blue-300/70 mb-8">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Home</button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium">Categories</span>
          </nav>

          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm mb-5">
                <Grid3X3 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-blue-300">All Categories</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Browse by<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Category</span>
              </h1>
              <p className="mt-4 text-slate-300 max-w-md text-lg leading-relaxed">
                Explore our full range of products — from electronics to fashion, home essentials and more.
              </p>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-6 shrink-0">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{parentCategories.length || '—'}</p>
                <p className="text-sm text-slate-400 mt-1">Categories</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{subCategories.length || '—'}</p>
                <p className="text-sm text-slate-400 mt-1">Sub-categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* ── Loading ── */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && parentCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No categories yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm">Categories will appear here once they're added by the admin.</p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Browse All Products <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Parent Categories Grid ── */}
        {!isLoading && parentCategories.length > 0 && (
          <section>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1.5">Explore</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Main Categories</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {parentCategories.map((category, index) => {
                const gradient = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length]
                const icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length]
                const childCount = subCategories.filter((s) => s.parent === category._id).length

                return (
                  <button
                    key={category._id}
                    onClick={() => navigate(`/categories/${category.slug}`)}
                    className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    {/* Image or gradient */}
                    <div className={`relative h-36 sm:h-40 bg-gradient-to-br ${gradient} overflow-hidden`}>
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.name}
                          className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-5xl transition-transform duration-300 group-hover:scale-110">{icon}</span>
                        </div>
                      )}
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                      {/* Product count badge */}
                      {(() => {
                        const total = getTotalProductCount(category)
                        return total > 0 ? (
                          <div className="absolute top-3 right-3 rounded-full bg-black/30 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-white">
                            {total} items
                          </div>
                        ) : null
                      })()}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight mb-1">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{category.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        {childCount > 0 && (
                          <span className="text-xs text-slate-400">{childCount} sub-categories</span>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
                          Browse <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Sub-categories ── */}
        {!isLoading && subCategories.length > 0 && (
          <section className="mt-16">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1.5">Drill Down</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Sub-categories</h2>
            </div>

            {/* Group sub-categories by parent — use nested children from API tree */}
            {parentCategories.map((parent) => {
              const children = parent.children || []
              if (children.length === 0) return null
              return (
                <div key={parent._id} className="mb-10">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => navigate(`/categories/${parent.slug}`)}
                      className="text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors"
                    >
                      {parent.name}
                    </button>
                    <div className="flex-1 h-px bg-slate-200" />
                    <button
                      onClick={() => navigate(`/categories/${parent.slug}`)}
                      className="text-sm text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      See all <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {children.map((child, i) => (
                      <button
                        key={child._id}
                        onClick={() => navigate(`/categories/${child.slug}`)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md transition-all"
                      >
                        <span>{CATEGORY_ICONS[(i + parentCategories.indexOf(parent) * 3) % CATEGORY_ICONS.length]}</span>
                        {child.name}
                        {child.productCount !== undefined && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                            {child.productCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ── Browse all products CTA ── */}
        {!isLoading && parentCategories.length > 0 && (
          <section className="mt-16">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-10 sm:p-14 text-center">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #fff 0%, transparent 50%)' }} />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-3">Can't find what you need?</p>
                <h3 className="text-3xl font-extrabold text-white mb-4">Browse All Products</h3>
                <p className="text-blue-100/90 mb-8 max-w-sm mx-auto">Search across all categories and find exactly what you're looking for.</p>
                <button
                  onClick={() => navigate('/products')}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-blue-700 shadow-xl hover:bg-slate-50 hover:scale-[1.02] transition-all"
                >
                  View All Products <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
