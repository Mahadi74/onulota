/**
 * Admin user controller for managing users.
 * 
 * Handles:
 * - Listing users with search and pagination
 * - Activating/deactivating user accounts
 */

import { Request, Response, NextFunction } from 'express'
import { User } from '../../models/User'
import { Order } from '../../models/Order'
import { asyncHandler } from '../../utils/asyncHandler'

/**
 * GET /api/admin/users
 * 
 * Get paginated user list with search.
 * 
 * Query parameters:
 * - search: Search by name or email
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 * 
 * Requirement 22.4: WHEN an Admin requests the user list, THE Platform SHALL return all Users with pagination and search by name or email
 */
export const getUsersHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { search, page = 1, limit = 20 } = req.query

  // Build filter
  const filter: any = {}

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ]
  }

  // Get total count
  const total = await User.countDocuments(filter)

  // Get users with pagination
  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip((parseInt(page as string) - 1) * parseInt(limit as string))
    .limit(parseInt(limit as string))

  // Enrich with order stats
  const enrichedUsers = await Promise.all(
    users.map(async (user) => {
      const orderCount = await Order.countDocuments({ user: user._id })
      const totalSpending = await Order.aggregate([
        { $match: { user: user._id, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])

      return {
        ...user.toObject(),
        orderCount,
        totalSpending: totalSpending.length > 0 ? totalSpending[0].total : 0
      }
    })
  )

  res.json({
    users: enrichedUsers,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string))
    }
  })
})

/**
 * PUT /api/admin/users/:id
 * 
 * Activate or deactivate user account.
 * 
 * Request body:
 * - isActive: Boolean (true to activate, false to deactivate)
 * 
 * Requirement 22.5: WHEN an Admin deactivates a User account, THE Platform SHALL prevent the User from logging in
 * Requirement 22.5: WHEN an Admin reactivates a User account, THE Platform SHALL restore login access
 */
export const updateUserStatusHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: userId } = req.params
  const { isActive } = req.body

  // Find user
  const user = await User.findById(userId)
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' })
  }

  // Update status
  user.isActive = isActive

  await user.save()

  res.json({
    message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      isActive: user.isActive
    }
  })
})
