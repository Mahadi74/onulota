import { Request, Response, NextFunction } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler'
import { HomePromotion, IHomePromotion } from '../../models/HomePromotion'
import { Types } from 'mongoose'
import { getCachedData, setCachedData, invalidateCacheKey } from '../../utils/cacheService'

const HOMEPAGE_CACHE_KEY = 'homepage:data'

function formatPromotion(promotion: IHomePromotion) {
  return {
    _id: promotion._id.toString(),
    title: promotion.title,
    subtitle: promotion.subtitle,
    description: promotion.description,
    image: promotion.image,
    actionText: promotion.actionText,
    actionUrl: promotion.actionUrl,
    section: promotion.section,
    order: promotion.order,
    metadata: promotion.metadata,
  }
}

export const getHomepageDataHandler = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    // Serve from Redis cache if available
    const cached = await getCachedData<typeof grouped>(HOMEPAGE_CACHE_KEY)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    const promotions = await HomePromotion.find({ isActive: true })
      .sort({ section: 1, order: 1 })
      .lean()

    const grouped = {
      heroBanners: [] as ReturnType<typeof formatPromotion>[],
      carouselItems: [] as ReturnType<typeof formatPromotion>[],
      ads: [] as ReturnType<typeof formatPromotion>[],
      deals: [] as ReturnType<typeof formatPromotion>[],
      promoBanners: [] as ReturnType<typeof formatPromotion>[],
      features: [] as ReturnType<typeof formatPromotion>[],
      brands: [] as ReturnType<typeof formatPromotion>[],
      categoryHighlights: [] as ReturnType<typeof formatPromotion>[],
      ctas: [] as ReturnType<typeof formatPromotion>[],
    }

    promotions.forEach((promotion) => {
      const formatted = formatPromotion(promotion as IHomePromotion)
      switch (promotion.section) {
        case 'hero':
          grouped.heroBanners.push(formatted)
          break
        case 'carousel':
          grouped.carouselItems.push(formatted)
          break
        case 'ad':
          grouped.ads.push(formatted)
          break
        case 'deal':
          grouped.deals.push(formatted)
          break
        case 'banner':
          grouped.promoBanners.push(formatted)
          break
        case 'feature':
          grouped.features.push(formatted)
          break
        case 'brand':
          grouped.brands.push(formatted)
          break
        case 'category_highlight':
          grouped.categoryHighlights.push(formatted)
          break
        case 'cta':
          grouped.ctas.push(formatted)
          break
      }
    })

    // Store in Redis for next requests
    await setCachedData(HOMEPAGE_CACHE_KEY, grouped)
    res.setHeader('X-Cache', 'MISS')
    res.json(grouped)
  }
)

export const getHomepageSectionsHandler = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const promotions = await HomePromotion.find().sort({ section: 1, order: 1 })
    res.json({ promotions: promotions.map(formatPromotion) })
  }
)

export const createHomepageSectionHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const {
      title,
      subtitle,
      description,
      image,
      actionText,
      actionUrl,
      section,
      order,
      isActive,
      metadata,
    } = req.body

    const promotion = new HomePromotion({
      title: title.trim(),
      subtitle: subtitle?.trim(),
      description: description?.trim(),
      image: image.trim(),
      actionText: actionText?.trim(),
      actionUrl: actionUrl?.trim(),
      section,
      order: order ?? 0,
      isActive: isActive ?? true,
      metadata: metadata || {},
    })

    await promotion.save()
    await invalidateCacheKey(HOMEPAGE_CACHE_KEY)

    res.status(201).json({ promotion: formatPromotion(promotion) })
  }
)

export const updateHomepageSectionHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid homepage section ID', 400)
    }

    const promotion = await HomePromotion.findById(id)
    if (!promotion) {
      throw new AppError('Homepage section not found', 404)
    }

    const {
      title,
      subtitle,
      description,
      image,
      actionText,
      actionUrl,
      section,
      order,
      isActive,
      metadata,
    } = req.body

    if (title !== undefined) promotion.title = title.trim()
    if (subtitle !== undefined) promotion.subtitle = subtitle?.trim()
    if (description !== undefined) promotion.description = description?.trim()
    if (image !== undefined) promotion.image = image.trim()
    if (actionText !== undefined) promotion.actionText = actionText?.trim()
    if (actionUrl !== undefined) promotion.actionUrl = actionUrl?.trim()
    if (section !== undefined) promotion.section = section
    if (order !== undefined) promotion.order = order
    if (isActive !== undefined) promotion.isActive = isActive
    if (metadata !== undefined) promotion.metadata = metadata

    await promotion.save()
    await invalidateCacheKey(HOMEPAGE_CACHE_KEY)

    res.json({ promotion: formatPromotion(promotion) })
  }
)

export const deleteHomepageSectionHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid homepage section ID', 400)
    }

    const promotion = await HomePromotion.findByIdAndDelete(id)
    if (!promotion) {
      throw new AppError('Homepage section not found', 404)
    }

    await invalidateCacheKey(HOMEPAGE_CACHE_KEY)
    res.status(204).end()
  }
)
