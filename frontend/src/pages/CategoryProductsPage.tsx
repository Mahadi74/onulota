import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '@/store/cartStore'
import apiClient from '@/services/api/client'
import { formatBDT } from '@/utils/currency'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ShoppingCart } from 'lucide-react'

interface Product {
  _id: string
  name: string
  price: number
  image?: string
  rating?: number
}

interface Category {
  _id: string
  name: string
  slug: string
  parent?: string
}

export default function CategoryProductsPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { addItem } = useCartStore()
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const response = await apiClient.get(`/api/categories/${slug}`)
      return response.data
    },
    enabled: !!slug,
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['category-products', slug, page, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: sortBy,
      })
      const response = await apiClient.get(`/api/categories/${slug}/products?${params}`)
      return response.data
    },
    enabled: !!slug,
  })

  const handleAddToCart = (product: Product) => {
    addItem({
      _id: product._id,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
      },
      quantity: 1,
      price: product.price,
    })
  }

  if (categoryLoading) return <LoadingSpinner />
  if (!categoryData) return <ErrorMessage message="Category not found" />

  const category: Category = categoryData
  const products: Product[] = productsData?.products || []
  const totalPages = productsData?.totalPages || 1

  const categoryName = category?.name || slug || 'Category'

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEO
        title={`${categoryName} — Shop Online`}
        description={`Shop ${categoryName} products on Onulota. Best prices and fast delivery across Bangladesh.`}
      />
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/categories' },
          { label: category.name },
        ]}
      />

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{category.name}</h1>
        <p className="text-gray-600">{products.length} products available</p>
      </div>

      {/* Sort Options */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {productsLoading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No products found in this category</p>
          <button
            onClick={() => navigate('/categories')}
            className="text-blue-600 hover:underline"
          >
            Browse other categories
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {products.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Product Image */}
                <div
                  onClick={() => navigate(`/products/${product._id}`)}
                  className="w-full h-48 bg-gray-200 overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <ShoppingCart className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3
                    onClick={() => navigate(`/products/${product._id}`)}
                    className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer line-clamp-2 mb-2"
                  >
                    {product.name}
                  </h3>

                  {/* Rating */}
                  {product.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-sm text-yellow-500">★</span>
                      <span className="text-sm text-gray-600">{product.rating.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Price & Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-blue-600">{formatBDT(product.price)}</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => navigate(`/products/${product._id}`)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Order Now
                      </button>
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="p-1.5 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Add to cart"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`px-4 py-2 rounded-lg ${
                    page === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
