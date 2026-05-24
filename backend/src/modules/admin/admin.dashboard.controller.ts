/**
 * Admin dashboard controller for retrieving dashboard metrics.
 * 
 * Handles:
 * - Monthly revenue calculation
 * - Orders by status summary
 * - User count
 * - Top 10 best-selling products
 * - 30-day sales trend
 */

import { Request, Response, NextFunction } from 'express'
import { Order } from '../../models/Order'
import { User } from '../../models/User'
import { asyncHandler } from '../../utils/asyncHandler'

/**
 * GET /api/admin/dashboard
 * 
 * Get dashboard metrics.
 * 
 * Returns:
 * - monthlyRevenue: Total revenue for current month
 * - ordersByStatus: Count of orders by status
 * - userCount: Total number of registered users
 * - topProducts: Top 10 best-selling products
 * - salesTrend: 30-day sales trend data
 * 
 * Requirement 14.1: WHEN an Admin accesses the dashboard, THE Platform SHALL display total sales revenue for the current month
 * Requirement 14.2: WHEN an Admin accesses the dashboard, THE Platform SHALL display the total number of Orders by status (pending, processing, shipped, delivered, cancelled)
 * Requirement 14.3: WHEN an Admin accesses the dashboard, THE Platform SHALL display the total number of registered Users
 * Requirement 14.4: WHEN an Admin accesses the dashboard, THE Platform SHALL display the top 10 best-selling products by quantity sold
 * Requirement 14.5: WHEN an Admin accesses the dashboard, THE Platform SHALL display a sales trend chart for the last 30 days
 */
export const getDashboardHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  // Get current month start and end
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  // Get 30 days ago
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Helper match condition: online-paid OR COD-delivered (payment collected on delivery)
  const paidOrderMatch = {
    $or: [
      { paymentStatus: 'paid' },
      { paymentMethod: 'cod', status: 'delivered' }
    ]
  }

  // 1. Calculate monthly revenue (only paid orders)
  const monthlyRevenueResult = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: monthStart, $lte: monthEnd },
        ...paidOrderMatch
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' }
      }
    }
  ])

  const monthlyRevenue = monthlyRevenueResult.length > 0 ? monthlyRevenueResult[0].total : 0

  // 2. Get orders by status
  const ordersByStatusResult = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ])

  const ordersByStatus = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  }

  ordersByStatusResult.forEach((item: any) => {
    if (item._id in ordersByStatus) {
      ordersByStatus[item._id as keyof typeof ordersByStatus] = item.count
    }
  })

  // 3. Get user count
  const userCount = await User.countDocuments({ isActive: true })

  // 4. Get top 10 best-selling products
  const topProducts = await Order.aggregate([
    {
      $match: paidOrderMatch
    },
    {
      $unwind: '$items'
    },
    {
      $group: {
        _id: '$items.product',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    {
      $sort: { totalQuantity: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: {
        path: '$product',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        name: '$product.name',
        totalQuantity: 1,
        totalRevenue: 1
      }
    }
  ])

  // 5. Get 30-day sales trend
  const salesTrend = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        ...paidOrderMatch
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        revenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ])

  res.json({
    monthlyRevenue,
    ordersByStatus,
    userCount,
    topProducts,
    salesTrend
  })
})
