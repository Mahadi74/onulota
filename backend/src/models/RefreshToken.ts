import mongoose, { Schema, Document, Types } from 'mongoose'

// Interface for RefreshToken Document
export interface IRefreshToken extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  token: string // hashed
  expiresAt: Date
  createdAt: Date
}

// Interface for RefreshToken Model (static methods)
export interface IRefreshTokenModel extends mongoose.Model<IRefreshToken> {
  findByToken(token: string): Promise<IRefreshToken | null>
  findByUser(userId: string | Types.ObjectId): Promise<IRefreshToken[]>
  deleteByToken(token: string): Promise<void>
  deleteByUser(userId: string | Types.ObjectId): Promise<void>
}

// RefreshToken Schema
const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
)

// Indexes as specified in the design document
RefreshTokenSchema.index({ token: 1 }, { unique: true })
RefreshTokenSchema.index({ user: 1 })
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Static method to find a refresh token by its hashed value
RefreshTokenSchema.statics.findByToken = function (token: string) {
  return this.findOne({ token })
}

// Static method to find all refresh tokens for a user
RefreshTokenSchema.statics.findByUser = function (userId: string | Types.ObjectId) {
  return this.find({ user: userId })
}

// Static method to delete a specific refresh token
RefreshTokenSchema.statics.deleteByToken = async function (token: string) {
  await this.deleteOne({ token })
}

// Static method to delete all refresh tokens for a user (logout all devices)
RefreshTokenSchema.statics.deleteByUser = async function (userId: string | Types.ObjectId) {
  await this.deleteMany({ user: userId })
}

export const RefreshToken = mongoose.model<IRefreshToken, IRefreshTokenModel>(
  'RefreshToken',
  RefreshTokenSchema
)
