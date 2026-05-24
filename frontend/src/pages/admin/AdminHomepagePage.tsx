import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import { ImageUploadField } from '@/components/ImageUploadField'

type SectionType =
  | 'hero'
  | 'carousel'
  | 'ad'
  | 'deal'
  | 'banner'
  | 'feature'
  | 'brand'
  | 'category_highlight'
  | 'cta'

interface HomepageSection {
  _id: string
  title: string
  subtitle?: string
  description?: string
  image: string
  actionText?: string
  actionUrl?: string
  section: SectionType
  order: number
  isActive: boolean
}

interface FormData {
  title: string
  subtitle: string
  description: string
  image: string
  actionText: string
  actionUrl: string
  section: SectionType
  order: number
  isActive: boolean
}

const SECTION_TYPES: SectionType[] = [
  'hero',
  'carousel',
  'ad',
  'deal',
  'banner',
  'feature',
  'brand',
  'category_highlight',
  'cta',
]

const SECTION_BADGE_COLORS: Record<SectionType, string> = {
  hero: 'bg-blue-100 text-blue-800',
  carousel: 'bg-purple-100 text-purple-800',
  ad: 'bg-yellow-100 text-yellow-800',
  deal: 'bg-red-100 text-red-800',
  banner: 'bg-green-100 text-green-800',
  feature: 'bg-indigo-100 text-indigo-800',
  brand: 'bg-pink-100 text-pink-800',
  category_highlight: 'bg-orange-100 text-orange-800',
  cta: 'bg-teal-100 text-teal-800',
}

const emptyForm: FormData = {
  title: '',
  subtitle: '',
  description: '',
  image: '',
  actionText: '',
  actionUrl: '',
  section: 'hero',
  order: 0,
  isActive: true,
}

export default function AdminHomepagePage() {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-homepage'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/homepage')
      return response.data as { promotions: HomepageSection[] }
    },
  })

  const { mutate: saveSection, isPending: isSaving } = useMutation({
    mutationFn: async (payload: FormData) => {
      const body = {
        title: payload.title,
        subtitle: payload.subtitle || undefined,
        description: payload.description || undefined,
        image: payload.image,
        actionText: payload.actionText || undefined,
        actionUrl: payload.actionUrl || undefined,
        section: payload.section,
        order: payload.order,
        isActive: payload.isActive,
      }
      if (editingSection) {
        return apiClient.put(`/api/admin/homepage/${editingSection._id}`, body)
      }
      return apiClient.post('/api/admin/homepage', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] })
      handleCloseForm()
    },
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.put(`/api/admin/homepage/${id}`, { isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] })
    },
  })

  const { mutate: deleteSection } = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/api/admin/homepage/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] })
    },
  })

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.image.trim()) newErrors.image = 'Image URL is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) saveSection(form)
  }

  const handleEdit = (section: HomepageSection) => {
    setEditingSection(section)
    setForm({
      title: section.title,
      subtitle: section.subtitle || '',
      description: section.description || '',
      image: section.image,
      actionText: section.actionText || '',
      actionUrl: section.actionUrl || '',
      section: section.section,
      order: section.order,
      isActive: section.isActive,
    })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingSection(null)
    setForm(emptyForm)
    setErrors({})
  }

  if (isLoading) return <LoadingSpinner />

  const promotions = data?.promotions || []

  // Group by section type
  const grouped = SECTION_TYPES.reduce<Record<SectionType, HomepageSection[]>>(
    (acc, type) => {
      acc[type] = promotions.filter((p) => p.section === type).sort((a, b) => a.order - b.order)
      return acc
    },
    {} as Record<SectionType, HomepageSection[]>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Homepage Sections</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      <div className="space-y-8">
        {SECTION_TYPES.map((type) => {
          const sections = grouped[type]
          if (sections.length === 0) return null
          return (
            <div key={type}>
              <h2 className="text-lg font-semibold text-gray-700 capitalize mb-3">
                {type.replace('_', ' ')}
              </h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">Order</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => (
                      <tr key={section._id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{section.title}</div>
                          {section.subtitle && (
                            <div className="text-sm text-gray-500">{section.subtitle}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${SECTION_BADGE_COLORS[section.section]}`}
                          >
                            {section.section.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">{section.order}</td>
                        <td className="text-center py-3 px-4">
                          <button
                            onClick={() =>
                              toggleActive({ id: section._id, isActive: !section.isActive })
                            }
                            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                              section.isActive
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {section.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(section)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this section permanently?')) {
                                  deleteSection(section._id)
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
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
            </div>
          )
        })}

        {promotions.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            No homepage sections yet. Click "Add Section" to create one.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSection ? 'Edit Section' : 'Add Section'}
              </h2>
              <button onClick={handleCloseForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Type
                  </label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value as SectionType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <ImageUploadField
                    label="Image"
                    required
                    value={form.image}
                    onChange={(url) => setForm({ ...form, image: url })}
                    uploadType="category"
                    error={errors.image}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Text
                  </label>
                  <input
                    type="text"
                    value={form.actionText}
                    onChange={(e) => setForm({ ...form, actionText: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action URL
                  </label>
                  <input
                    type="text"
                    value={form.actionUrl}
                    onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
