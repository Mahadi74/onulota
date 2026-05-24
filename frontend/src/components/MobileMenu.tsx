import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface MobileMenuProps {
  onClose: () => void
  onLogout: () => void
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ onClose, onLogout }) => {
  const { user } = useAuthStore()

  const handleLinkClick = () => {
    onClose()
  }

  return (
    <nav className="md:hidden bg-white border-t border-gray-200">
      <div className="px-4 py-3 space-y-2">
        <Link
          to="/"
          onClick={handleLinkClick}
          className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Home
        </Link>
        <Link
          to="/products"
          onClick={handleLinkClick}
          className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Products
        </Link>
        <Link
          to="/categories"
          onClick={handleLinkClick}
          className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Categories
        </Link>

        <div className="border-t border-gray-200 my-2 pt-2">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  onClick={handleLinkClick}
                  className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Admin Dashboard
                </Link>
              )}
              <Link
                to="/profile"
                onClick={handleLinkClick}
                className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Profile
              </Link>
              <Link
                to="/orders"
                onClick={handleLinkClick}
                className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Orders
              </Link>
              <button
                onClick={() => {
                  onLogout()
                  handleLinkClick()
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={handleLinkClick}
                className="block px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={handleLinkClick}
                className="block px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
