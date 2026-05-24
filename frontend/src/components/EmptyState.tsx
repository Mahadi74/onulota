import { ShoppingCart, Search, Package } from 'lucide-react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  type?: 'cart' | 'search' | 'orders' | 'default'
}

const defaultIcons = {
  cart: <ShoppingCart className="w-16 h-16 text-gray-400" />,
  search: <Search className="w-16 h-16 text-gray-400" />,
  orders: <Package className="w-16 h-16 text-gray-400" />,
  default: <Package className="w-16 h-16 text-gray-400" />,
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  type = 'default',
}) => {
  const displayIcon = icon || defaultIcons[type]

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-4">{displayIcon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center mb-6 max-w-md">{description}</p>
      {action && (
        <Link
          to={action.href}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
