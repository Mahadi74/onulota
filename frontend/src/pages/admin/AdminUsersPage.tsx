import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/services/api/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Search, ToggleLeft } from 'lucide-react'

interface User {
  _id: string
  name: string
  email: string
  phone?: string
  isActive: boolean
  createdAt: string
  role: string
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', currentPage, searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/users', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
        },
      })
      return response.data
    },
  })

  // Toggle user active status mutation
  const { mutate: toggleUserStatus } = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.put(`/api/admin/users/${userId}`, {
        isActive: !usersData?.users.find((u: User) => u._id === userId)?.isActive,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  if (isLoading) return <LoadingSpinner />

  const users = usersData?.users || []
  const totalPages = Math.ceil((usersData?.total || 0) / itemsPerPage)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Users</h1>

      {/* Search */}
      <div className="mb-6 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Joined</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: User) => (
              <tr key={user._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-900 font-medium">{user.name}</td>
                <td className="py-3 px-4 text-gray-600">{user.email}</td>
                <td className="py-3 px-4 text-gray-600">{user.phone || '-'}</td>
                <td className="py-3 px-4">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleUserStatus(user._id)}
                    className={`p-2 rounded ${
                      user.isActive
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <ToggleLeft className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`px-3 py-2 rounded ${
              currentPage === page
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  )
}
