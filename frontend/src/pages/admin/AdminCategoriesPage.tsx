import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Plus, Edit2, Trash2, X, ChevronRight, ImageIcon } from 'lucide-react'
import { ImageUploader } from '@/components/ImageUploader'

const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  image: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  icon: z.string().max(500).optional(),
})

type CategoryFormData = z.infer<typeof categorySchema>

interface Category {
  _id: string
  name: string
  description?: string
  parentId?: string
  level: number
  productCount: number
  image?: string
  icon?: string
  children?: Category[]
}

function getTotalProductCount(category: Category): number {
  const own = category.productCount || 0
  const childTotal = (category.children || []).reduce(
    (sum, child) => sum + getTotalProductCount(child),
    0
  )
  return own + childTotal
}

/** Flatten category tree into a flat list for parent selector */
function flattenCategories(cats: Category[], level = 0, result: { _id: string; name: string; level: number }[] = []) {
  for (const cat of cats) {
    result.push({ _id: cat._id, name: cat.name, level })
    if (cat.children?.length) flattenCategories(cat.children, level + 1, result)
  }
  return result
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  })


  // Fetch categories
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const response = await apiClient.get('/api/categories')
      return response.data
    },
  })

  const { mutate: saveCategory, isPending: isSaving } = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        parent: data.parentId || undefined,
        image: data.image || undefined,
        icon: data.icon || undefined,
      }
      if (editingCategory) {
        return apiClient.put(`/api/admin/categories/${editingCategory._id}`, payload)
      }
      return apiClient.post('/api/admin/categories', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      handleCloseForm()
    },
  })

  const { mutate: deleteCategory } = useMutation({
    mutationFn: (categoryId: string) => apiClient.delete(`/api/admin/categories/${categoryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  })

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    reset({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
      icon: category.icon || '',
    })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCategory(null)
    reset()
  }

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId)
      return next
    })
  }

  if (isLoading) return <LoadingSpinner />

  const categories: Category[] = categoriesData?.categories || []
  const flatCats = flattenCategories(categories)

  const renderCategoryTree = (cats: Category[], level = 0): React.ReactNode => (
    <div>
      {cats.map((category) => (
        <div key={category._id}>
          <div
            className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 transition"
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {/* Expand toggle */}
            {category.children && category.children.length > 0 ? (
              <button onClick={() => toggleExpanded(category._id)} className="p-1 hover:bg-slate-200 rounded">
                <ChevronRight
                  className={`w-4 h-4 transition-transform text-slate-500 ${
                    expandedCategories.has(category._id) ? 'rotate-90' : ''
                  }`}
                />
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Category image thumbnail */}
            {category.image ? (
              <img
                src={category.image}
                alt={category.name}
                className="w-9 h-9 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                {category.icon ? (
                  <span className="text-lg">{category.icon}</span>
                ) : (
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{category.name}</p>
              <p className="text-xs text-slate-500">
                {getTotalProductCount(category)} products
                {(category.children?.length ?? 0) > 0 &&
                  category.productCount !== getTotalProductCount(category) && (
                    <span className="ml-1 text-slate-400">(incl. sub-categories)</span>
                  )}
              </p>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => handleEdit(category)}
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${category.name}"?`)) deleteCategory(category._id)
                }}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expandedCategories.has(category._id) &&
            category.children &&
            category.children.length > 0 &&
            renderCategoryTree(category.children, level + 1)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500 mt-0.5">{flatCats.length} total categories</p>
        </div>
        <button
          onClick={() => { reset(); setIsFormOpen(true) }}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Categories Tree */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No categories yet</p>
          </div>
        ) : (
          renderCategoryTree(categories)
        )}
      </div>

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={handleCloseForm} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit((data) => saveCategory(data))} className="p-6 space-y-5">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Electronics"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Short description (optional)"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Parent Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Parent Category</label>
                <select
                  {...register('parentId')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— None (Top Level) —</option>
                  {flatCats
                    .filter((c) => c._id !== editingCategory?._id)
                    .map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {' '.repeat(cat.level * 4)}{cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Image — URL or upload */}
              <ImageUploader
                label="Category Image"
                value={watch('image') || ''}
                onChange={(url) => setValue('image', url, { shouldValidate: true })}
                type="category"
                placeholder="https://example.com/category-image.jpg"
              />
              {errors.image && <p className="-mt-3 text-xs text-red-600">{errors.image.message}</p>}

              {/* Icon (emoji or icon name) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Icon
                  <span className="ml-1 text-xs text-slate-400 font-normal">emoji or icon name, shown when no image</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    {...register('icon')}
                    placeholder="e.g. 📱 or electronics"
                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {watch('icon') && (
                    <span className="text-2xl px-2">{watch('icon')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {isSaving ? 'Saving…' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
