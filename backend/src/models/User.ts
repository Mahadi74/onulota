import mongoose, { Schema, Document, Types } from 'mongoose'

// Address subdocument interface
export interface IAddress {
  _id: Types.ObjectId
  label: string
  recipientName: string
  phone: string
  street: string
  city: string
  postalCode: string
  country: string
  isDefault: boolean
}

// User document interface
export interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  password: string
  phone?: string
  profileImage?: string
  role: 'user' | 'admin'
  googleId?: string
  isActive: boolean
  addresses: IAddress[]
  createdAt: Date
  updatedAt: Date
}

// User model interface (static methods)
export interface IUserModel extends mongoose.Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>
}

// Address subdocument schema
const AddressSchema = new Schema<IAddress>(
  {
    label: { type: String, trim: true },
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: 'Bangladesh', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
)

// User schema
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        'Invalid email format',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    phone: {
      type: String,
      trim: true,
      default: undefined,
    },
    profileImage: {
      type: String,
      trim: true,
      default: undefined,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    googleId: {
      type: String,
      sparse: true,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addresses: {
      type: [AddressSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

// Indexes as specified in the design document
UserSchema.index({ email: 1 }, { unique: true })
UserSchema.index({ googleId: 1 }, { unique: true, sparse: true })

// Static method to find user by email
UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() })
}

export const User =
  (mongoose.models['User'] as mongoose.Model<IUser, IUserModel>) ||
  mongoose.model<IUser, IUserModel>('User', UserSchema)
