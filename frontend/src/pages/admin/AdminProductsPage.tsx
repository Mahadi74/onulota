import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import MDEditor from '@uiw/react-md-editor'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ImageUploader } from '@/components/ImageUploader'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Tag,
  Package,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

// ─── Schema ──────────────────────────────────────────────────────────────────

const imageSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  alt: z.string().optional(),
  thumbnail: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

const productSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().min(0, 'Price must be ≥ 0'),
  compareAtPrice: z.coerce.number().min(0).optional().or(z.literal('')),
  stock: z.coerce.number().int().min(0, 'Stock must be ≥ 0'),
  category: z.string().min(1, 'Category is required'),
  isFeatured: z.boolean().optional(),
  tags: z.string().optional(),
  colors: z.string().optional(),
  sizes: z.string().optional(),
  brand: z.string().optional(),
  images: z.array(imageSchema).min(1, 'At least one image is required'),
})

type ProductFormData = z.infer<typeof productSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductImage {
  url: string
  thumbnail?: string
  mobile?: string
  alt?: string
}

interface AdminProduct {
  _id: string
  name: string
  price: number
  compareAtPrice?: number
  stock: number
  category: string
  categoryId: string
  sku: string
  description: string
  images: ProductImage[]
  isActive: boolean
  isFeatured: boolean
  averageRating?: number
  tags: string[]
  colors: string[]
  sizes: string[]
  brand?: string
}

interface FlatCategory {
  _id: string
  name: string
  level: number
  parentName?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenCategories(cats: any[], level = 0, result: FlatCategory[] = []): FlatCategory[] {
  for (const cat of cats) {
    result.push({ _id: cat._id, name: cat.name, level })
    if (cat.children?.length) {
      flattenCategories(cat.children, level + 1, result)
    }
  }
  return result
}

const indent = (level: number) => '\u00A0'.repeat(level * 4)

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStock, setFilterStock] = useState<'all' | 'in' | 'out'>('all')
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'featured'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Debounce search
  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val)
    clearTimeout((handleSearchChange as any)._t)
    ;(handleSearchChange as any)._t = setTimeout(() => {
      setDebouncedSearch(val)
      setCurrentPage(1)
    }, 400)
  }, [])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      images: [{ url: '', alt: '' }],
      isFeatured: false,
    },
  })

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control,
    name: 'images',
  })

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['admin-products', currentPage, debouncedSearch, filterBrand, filterCategory, filterStock, filterFeatured],
    queryFn: async () => {
      const params: Record<string, string | undefined> = {
        page: String(currentPage),
        limit: String(itemsPerPage),
        search: debouncedSearch || undefined,
        brand: filterBrand || undefined,
        categoryId: filterCategory || undefined,
        inStock: filterStock === 'in' ? 'true' : filterStock === 'out' ? 'false' : undefined,
        isFeatured: filterFeatured === 'featured' ? 'true' : undefined,
      }
      const res = await apiClient.get('/api/admin/products', { params })
      return res.data
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-flat'],
    queryFn: async () => {
      const res = await apiClient.get('/api/categories')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const flatCategories: FlatCategory[] = categoriesData?.categories
    ? flattenCategories(categoriesData.categories)
    : []

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { mutate: saveProduct, isPending: isSaving } = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        name: data.name,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAtPrice || undefined,
        stock: data.stock,
        category: data.category,
        isFeatured: data.isFeatured ?? false,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        colors: data.colors ? data.colors.split(',').map((c) => c.trim()).filter(Boolean) : [],
        sizes: data.sizes ? data.sizes.split(',').map((s) => s.trim()).filter(Boolean) : [],
        brand: data.brand?.trim() || undefined,
        images: data.images.filter((img) => img.url.trim()),
      }
      if (editingProduct) {
        return apiClient.put(`/api/admin/products/${editingProduct._id}`, payload)
      }
      return apiClient.post('/api/admin/products', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      closeForm()
    },
  })

  const { mutate: deleteProduct } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openAddForm = () => {
    setEditingProduct(null)
    reset({
      name: '',
      description: '',
      price: 0,
      compareAtPrice: '',
      stock: 0,
      category: '',
      isFeatured: false,
      tags: '',
      colors: '',
      sizes: '',
      brand: '',
      images: [{ url: '', alt: '', thumbnail: '' }],
    })
    setIsFormOpen(true)
  }

  const openEditForm = (product: AdminProduct) => {
    setEditingProduct(product)
    reset({
      name: product.name,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? '',
      stock: product.stock,
      category: product.categoryId || product.category,
      isFeatured: product.isFeatured,
      tags: product.tags?.join(', ') || '',
      colors: product.colors?.join(', ') || '',
      sizes: product.sizes?.join(', ') || '',
      brand: product.brand || '',
      images:
        product.images?.length
          ? product.images.map((img) => ({ url: img.url, alt: img.alt || '', thumbnail: img.thumbnail || '' }))
          : [{ url: '', alt: '', thumbnail: '' }],
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
    reset()
  }

  const onSubmit = (data: ProductFormData) => saveProduct(data)

  // ── Derived data ───────────────────────────────────────────────────────────

  const products: AdminProduct[] = productsData?.products || []
  const total: number = productsData?.total || 0
  const totalPages = Math.ceil(total / itemsPerPage)

  const isFeatured = watch('isFeatured')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total products</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Brand */}
        <input
          type="text"
          placeholder="Filter by brand…"
          value={filterBrand}
          onChange={(e) => { setFilterBrand(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-44"
        />

        {/* Category */}
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1) }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Categories</option>
          {flatCategories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {' '.repeat(cat.level * 4)}{cat.name}
            </option>
          ))}
        </select>

        {/* Stock status */}
        <select
          value={filterStock}
          onChange={(e) => { setFilterStock(e.target.value as 'all' | 'in' | 'out'); setCurrentPage(1) }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Stock</option>
          <option value="in">In Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {/* Featured */}
        <select
          value={filterFeatured}
          onChange={(e) => { setFilterFeatured(e.target.value as 'all' | 'featured'); setCurrentPage(1) }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Products</option>
          <option value="featured">Featured Only</option>
        </select>

        {/* Clear filters */}
        {(filterBrand || filterCategory || filterStock !== 'all' || filterFeatured !== 'all') && (
          <button
            onClick={() => {
              setFilterBrand('')
              setFilterCategory('')
              setFilterStock('all')
              setFilterFeatured('all')
              setCurrentPage(1)
            }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-red-600 underline transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isProductsLoading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No products found</p>
            <p className="text-slate-400 text-sm mt-1">
              {debouncedSearch ? 'Try a different search term' : 'Add your first product to get started'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Category</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Stock</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.images?.[0]?.url ? (
                            <img
                              src={product.images[0].thumbnail || product.images[0].url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.isFeatured && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                  <Star className="w-3 h-3" /> Featured
                                </span>
                              )}
                              {product.averageRating ? (
                                <span className="text-xs text-slate-400">★ {product.averageRating.toFixed(1)}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <Tag className="w-3 h-3" />
                          {product.category || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-semibold text-slate-900">{formatBDT(product.price)}</p>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <p className="text-xs text-slate-400 line-through">{formatBDT(product.compareAtPrice)}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-medium ${
                            product.stock === 0
                              ? 'text-red-600'
                              : product.stock < 10
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEditForm(product)}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${product.name}"?`)) deleteProduct(product._id)
                            }}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {products.map((product) => (
                <div key={product._id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].thumbnail || product.images[0].url}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          <Tag className="w-3 h-3" />{product.category || '—'}
                        </span>
                        {product.isFeatured && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Star className="w-3 h-3" /> Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Price</p>
                      <p className="font-semibold text-slate-900">{formatBDT(product.price)}</p>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <p className="text-xs text-slate-400 line-through">{formatBDT(product.compareAtPrice)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Stock</p>
                      <p className={`font-medium ${product.stock === 0 ? 'text-red-600' : product.stock < 10 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {product.stock}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-blue-600 border border-blue-200 hover:bg-blue-50 transition text-sm font-medium"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${product.name}"?`)) deleteProduct(product._id) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-red-500 border border-red-200 hover:bg-red-50 transition text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={closeForm} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Row 1: Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Samsung Galaxy A54"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              {/* Row 2: Price + Discount + Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Price (৳) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('price')}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Original Price (৳)
                    <span className="ml-1 text-xs text-slate-400 font-normal">for discount</span>
                  </label>
                  <input
                    {...register('compareAtPrice')}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('stock')}
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.stock && <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p>}
                </div>
              </div>

              {/* Row 3: Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Select a category —</option>
                  {flatCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {indent(cat.level)}{cat.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
              </div>

              {/* Row 4: Description (rich text) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <div data-color-mode="light">
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <MDEditor
                        value={field.value}
                        onChange={(val) => field.onChange(val || '')}
                        height={220}
                        preview="edit"
                      />
                    )}
                  />
                </div>
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Row 5: Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Images <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => appendImage({ url: '', alt: '', thumbnail: '' })}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <ImagePlus className="w-3.5 h-3.5" /> Add image
                  </button>
                </div>

                <div className="space-y-4">
                  {imageFields.map((field, index) => (
                    <div key={field.id} className="rounded-xl border border-slate-200 p-3 space-y-2 relative">
                      {imageFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <p className="text-xs font-semibold text-slate-500">Image {index + 1}</p>
                      {/* Main image — URL or upload */}
                      <ImageUploader
                        value={watch(`images.${index}.url`) || ''}
                        onChange={(url) => {
                          setValue(`images.${index}.url`, url, { shouldValidate: true })
                        }}
                        onUpload={(urls) => {
                          setValue(`images.${index}.url`, urls.desktop, { shouldValidate: true })
                          setValue(`images.${index}.thumbnail`, urls.thumbnail)
                        }}
                        type="product"
                        placeholder="https://example.com/image.jpg"
                      />
                      {/* Alt + thumbnail row */}
                      <div className="flex gap-2">
                        <input
                          {...register(`images.${index}.alt`)}
                          placeholder="Alt text (optional)"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          {...register(`images.${index}.thumbnail`)}
                          placeholder="Thumbnail URL (auto-filled on upload)"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {errors.images && (
                  <p className="mt-1 text-xs text-red-600">
                    {typeof errors.images.message === 'string'
                      ? errors.images.message
                      : 'Please add at least one valid image URL'}
                  </p>
                )}
              </div>

              {/* Row 6: Tags + Featured */}
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tags
                    <span className="ml-1 text-xs text-slate-400 font-normal">comma-separated</span>
                  </label>
                  <input
                    {...register('tags')}
                    placeholder="e.g. smartphone, android, samsung"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-7">
                  <button
                    type="button"
                    onClick={() => setValue('isFeatured', !isFeatured)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700"
                  >
                    {isFeatured ? (
                      <ToggleRight className="w-8 h-8 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                    Featured
                  </button>
                </div>
              </div>

              {/* Row 7: Brand */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand</label>
                <input
                  {...register('brand')}
                  placeholder="e.g. Samsung, Nike, Unilever"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Row 8: Colors + Sizes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Colors
                    <span className="ml-1 text-xs text-slate-400 font-normal">comma-separated hex or names</span>
                  </label>
                  <input
                    {...register('colors')}
                    placeholder="e.g. #FF0000, #000000, Navy"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Color preview dots */}
                  {watch('colors') && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {watch('colors')!.split(',').map(c => c.trim()).filter(Boolean).map((c, i) => (
                        <span key={i} className="w-5 h-5 rounded-full border border-slate-200 inline-block shadow-sm" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Sizes
                    <span className="ml-1 text-xs text-slate-400 font-normal">comma-separated</span>
                  </label>
                  <input
                    {...register('sizes')}
                    placeholder="e.g. S, M, L, XL, XXL"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Size chips preview */}
                  {watch('sizes') && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {watch('sizes')!.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs font-medium border border-slate-300 rounded-md text-slate-600">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {isSaving ? 'Saving…' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
