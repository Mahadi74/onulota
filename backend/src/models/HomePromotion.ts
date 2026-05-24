import mongoose, { Schema, Document, Types } from 'mongoose'

export type HomepageSectionType = 'hero' | 'carousel' | 'ad' | 'deal' | 'banner' | 'feature' | 'brand' | 'category_highlight' | 'cta'

export interface IHomePromotion extends Document {
  _id: Types.ObjectId
  title: string
  subtitle?: string
  description?: string
  image: string
  actionText?: string
  actionUrl?: string
  section: HomepageSectionType
  order: number
  isActive: boolean
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface IHomePromotionModel extends mongoose.Model<IHomePromotion> {}

const HomePromotionSchema = new Schema<IHomePromotion>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    actionText: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      enum: ['hero', 'carousel', 'ad', 'deal', 'banner', 'feature', 'brand', 'category_highlight', 'cta'],
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

HomePromotionSchema.index({ section: 1, order: 1 })

export const HomePromotion = mongoose.models.HomePromotion
  ? (mongoose.model<IHomePromotion>('HomePromotion') as mongoose.Model<IHomePromotion>)
  : mongoose.model<IHomePromotion>('HomePromotion', HomePromotionSchema)
