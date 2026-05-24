import { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../../middleware/errorHandler'
import { SiteSettings } from '../../models/SiteSettings'

const DEFAULT_SETTINGS = {
  siteName: 'onulota',
  tagline: 'Bangladesh\'s Premium Shopping',
  contactPhone: ['+880 1234 567890'],
  contactEmail: 'support@onulota.com.bd',
  contactAddress: 'Dhaka, Bangladesh',
  paymentMethods: [
    { name: 'Cash on Delivery', isActive: true },
    { name: 'SSLCommerz', isActive: true },
    { name: 'bKash', isActive: true },
    { name: 'Nagad', isActive: true },
  ],
  socialLinks: [],
}

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  let settings = await SiteSettings.findOne().lean()
  if (!settings) {
    await SiteSettings.create(DEFAULT_SETTINGS)
    settings = await SiteSettings.findOne().lean()
  }
  res.status(200).json(settings)
})

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: req.body },
    { new: true, upsert: true }
  ).lean()
  res.status(200).json(settings)
})
