import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
      <Link to="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Go Home
      </Link>
    </div>
  )
}
