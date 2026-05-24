import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface Category {
  _id: string
  name: string
  slug: string
  level: number
  productCount?: number
  children?: Category[]
}

interface CategorySidebarProps {
  categories: Category[]
  selectedCategory?: string
  onSelectCategory: (slug: string) => void
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  )

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const renderCategory = (category: Category, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedCategories.has(category._id)
    const isSelected = selectedCategory === category.slug

    return (
      <div key={category._id}>
        <div className="flex items-center">
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(category._id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          <button
            onClick={() => onSelectCategory(category.slug)}
            className={`flex-1 text-left px-2 py-2 rounded text-sm transition-colors ${
              isSelected
                ? 'bg-blue-100 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{category.name}</span>
            {category.productCount !== undefined && (
              <span className="text-xs text-gray-500 ml-1">
                ({category.productCount})
              </span>
            )}
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-4 border-l border-gray-200">
            {category.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
      <div className="space-y-1">
        {categories.map((category) => renderCategory(category))}
      </div>
    </div>
  )
}
