import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { User, IUser, IAddress } from '../../models/User'
import { AppError } from '../../middleware/errorHandler'

export interface UserProfileResult {
  id: string; name: string; email: string; phone: string | undefined
  profileImage: string | undefined; role: string; addresses: IAddress[]; createdAt: Date
}
export interface UpdateProfileInput { name?: string; phone?: string }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }
export interface ChangePasswordResult { message: string }
export interface AddAddressInput {
  label?: string; recipientName: string; phone: string; street: string
  city: string; postalCode: string; country?: string; isDefault?: boolean
}
export interface UpdateAddressInput {
  label?: string; recipientName?: string; phone?: string; street?: string
  city?: string; postalCode?: string; country?: string; isDefault?: boolean
}
export interface UploadProfileImageResult { profileImage: string }

const BD_PHONE_REGEX = /^\+880[1-9]\d{9}$/
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

export async function getUserProfile(userId: string): Promise<UserProfileResult> {
  const user = await User.findById(userId).select('-password').lean<IUser>()
  if (!user) throw new AppError('User not found', 404)
  return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, profileImage: user.profileImage, role: user.role, addresses: user.addresses, createdAt: user.createdAt }
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfileResult> {
  const { name, phone } = input
  if (name !== undefined && (name.length < 2 || name.length > 100)) throw new AppError('Name must be between 2 and 100 characters', 400)
  if (phone !== undefined && !BD_PHONE_REGEX.test(phone)) throw new AppError('Phone number must be in Bangladesh format (+880XXXXXXXXXX)', 400)
  const updateFields: Partial<Pick<IUser, 'name' | 'phone'>> = {}
  if (name !== undefined) updateFields.name = name
  if (phone !== undefined) updateFields.phone = phone
  const user = await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true, runValidators: true }).select('-password').lean<IUser>()
  if (!user) throw new AppError('User not found', 404)
  return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, profileImage: user.profileImage, role: user.role, addresses: user.addresses, createdAt: user.createdAt }
}

export async function uploadProfileImage(userId: string, imageBuffer: Buffer, mimetype: string): Promise<UploadProfileImageResult> {
  if (!ALLOWED_MIMETYPES.includes(mimetype)) throw new AppError('Invalid image format. Only JPEG, PNG, and WebP are allowed', 400)
  if (imageBuffer.length > MAX_FILE_SIZE) throw new AppError('Image size must not exceed 5MB', 400)
  const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles')
  await fs.mkdir(uploadsDir, { recursive: true })
  const filename = `${userId}-${Date.now()}.webp`
  const filePath = path.join(uploadsDir, filename)
  const urlPath = `/uploads/profiles/${filename}`
  await sharp(imageBuffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toFile(filePath)
  const user = await User.findByIdAndUpdate(userId, { $set: { profileImage: urlPath } }, { new: true }).lean<IUser>()
  if (!user) throw new AppError('User not found', 404)
  return { profileImage: urlPath }
}

export async function getAddresses(userId: string): Promise<IAddress[]> {
  const user = await User.findById(userId).select('addresses').lean<IUser>()
  if (!user) throw new AppError('User not found', 404)
  return user.addresses
}

export async function addAddress(userId: string, input: AddAddressInput): Promise<IAddress> {
  const user = await User.findById(userId).select('addresses')
  if (!user) throw new AppError('User not found', 404)
  if (user.addresses.length >= 10) throw new AppError('You can only have up to 10 addresses', 400)
  const newAddress = { label: input.label, recipientName: input.recipientName, phone: input.phone, street: input.street, city: input.city, postalCode: input.postalCode, country: input.country ?? 'Bangladesh', isDefault: input.isDefault ?? false }
  user.addresses.push(newAddress as IAddress)
  await user.save()
  return user.addresses[user.addresses.length - 1]
}

export async function updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<IAddress> {
  const user = await User.findById(userId).select('addresses')
  if (!user) throw new AppError('User not found', 404)
  const address = user.addresses.find((a) => a._id.toString() === addressId)
  if (!address) throw new AppError('Address not found', 404)
  if (input.label !== undefined) address.label = input.label
  if (input.recipientName !== undefined) address.recipientName = input.recipientName
  if (input.phone !== undefined) address.phone = input.phone
  if (input.street !== undefined) address.street = input.street
  if (input.city !== undefined) address.city = input.city
  if (input.postalCode !== undefined) address.postalCode = input.postalCode
  if (input.country !== undefined) address.country = input.country
  if (input.isDefault !== undefined) address.isDefault = input.isDefault
  await user.save()
  return address
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const user = await User.findById(userId).select('addresses')
  if (!user) throw new AppError('User not found', 404)
  const index = user.addresses.findIndex((a) => a._id.toString() === addressId)
  if (index === -1) throw new AppError('Address not found', 404)
  user.addresses.splice(index, 1)
  await user.save()
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<IAddress> {
  const user = await User.findById(userId).select('addresses')
  if (!user) throw new AppError('User not found', 404)
  const address = user.addresses.find((a) => a._id.toString() === addressId)
  if (!address) throw new AppError('Address not found', 404)
  user.addresses.forEach((a) => { a.isDefault = false })
  address.isDefault = true
  await user.save()
  return address
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const user = await User.findById(userId).select('+password').lean<IUser>()
  if (!user) throw new AppError('User not found', 404)
  const isMatch = await bcrypt.compare(input.currentPassword, user.password)
  if (!isMatch) throw new AppError('Current password is incorrect', 401)
  if (!PASSWORD_STRENGTH_REGEX.test(input.newPassword)) throw new AppError('Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character', 400)
  const hashedPassword = await bcrypt.hash(input.newPassword, 10)
  await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } })
  return { message: 'Password updated successfully' }
}
