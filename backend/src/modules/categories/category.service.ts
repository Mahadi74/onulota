import { Category } from '../../models/Category'
import { Product } from '../../models/Product'
import { cacheGet, cacheSet } from '../../config/redis'
import { logger } from '../../utils/logger'

const CACHE_KEY = 'categories:tree'
const CACHE_TTL = 3600 // 1 hour in seconds

export interface CategoryTreeNode {
  _id: string
  name: string
  slug: string
  level: number
  icon?: string
  image?: string
  order: number
  isActive: boolean
  productCount: number
  children: CategoryTreeNode[]
}

/**
 * Fetches the full category tree with product counts per category.
 *
 * Strategy:
 * 1. Check Redis cache (key: 'categories:tree', TTL 1hr)
 * 2. On cache miss: fetch all active categories from MongoDB,
 *    count products per category, build tree structure
 * 3. Cache result in Redis with 1hr TTL
 * 4. Return the tree
 *
 * Requirement 7.3: WHEN a User requests the category tree, THE Platform SHALL
 * return the complete hierarchy with category names and product counts.
 * Requirement 29.2: THE Backend SHALL cache frequently accessed data (categories)
 * using Redis.
 */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  // Step 1: Check Redis cache
  try {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      logger.debug('Category tree served from Redis cache')
      return JSON.parse(cached) as CategoryTreeNode[]
    }
  } catch (err) {
    // Cache read failure is non-fatal — fall through to DB fetch
    logger.warn('Redis cache read failed for category tree:', err)
  }

  // Step 2: Cache miss — fetch from MongoDB
  const [categories, productCounts] = await Promise.all([
    Category.find({ isActive: true })
      .select('_id name slug parent level icon image order isActive')
      .sort({ level: 1, order: 1, name: 1 })
      .lean(),
    // Count active products grouped by category
    Product.aggregate<{ _id: string; count: number }>([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ])

  // Build a map of categoryId → product count
  const countMap = new Map<string, number>()
  for (const entry of productCounts) {
    countMap.set(entry._id.toString(), entry.count)
  }

  // Build a map of categoryId → node (with empty children array)
  const nodeMap = new Map<string, CategoryTreeNode>()
  for (const cat of categories) {
    nodeMap.set(cat._id.toString(), {
      _id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      level: cat.level,
      icon: cat.icon,
      image: cat.image,
      order: cat.order,
      isActive: cat.isActive,
      productCount: countMap.get(cat._id.toString()) ?? 0,
      children: [],
    })
  }

  // Wire up parent → children relationships and collect root nodes
  const roots: CategoryTreeNode[] = []
  for (const cat of categories) {
    const node = nodeMap.get(cat._id.toString())!
    if (cat.parent) {
      const parentNode = nodeMap.get(cat.parent.toString())
      if (parentNode) {
        parentNode.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  // Step 3: Cache the result in Redis
  try {
    await cacheSet(CACHE_KEY, JSON.stringify(roots), CACHE_TTL)
    logger.debug('Category tree cached in Redis')
  } catch (err) {
    // Cache write failure is non-fatal
    logger.warn('Redis cache write failed for category tree:', err)
  }

  return roots
}
