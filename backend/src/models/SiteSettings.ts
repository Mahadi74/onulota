import mongoose, { Schema, Document } from 'mongoose'

export interface ISiteSettings extends Document {
  siteName: string
  logoUrl?: string
  tagline?: string
  contactPhone: string[]
  contactEmail: string
  contactAddress: string
  paymentMethods: Array<{ name: string; logo?: string; isActive: boolean }>
  bkashNumber?: string
  nagadNumber?: string
  socialLinks: Array<{ platform: string; url: string }>
  updatedAt: Date
}

const SiteSettingsSchema = new Schema<ISiteSettings>({
  siteName: { type: String, default: 'onulota' },
  logoUrl: String,
  tagline: String,
  contactPhone: [{ type: String }],
  contactEmail: { type: String, default: 'support@onulota.com.bd' },
  contactAddress: { type: String, default: 'Dhaka, Bangladesh' },
  bkashNumber: { type: String, default: '' },
  nagadNumber: { type: String, default: '' },
  paymentMethods: [{
    name: { type: String, required: true },
    logo: String,
    isActive: { type: Boolean, default: true },
  }],
  socialLinks: [{
    platform: String,
    url: String,
  }],
}, { timestamps: true })

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema)
