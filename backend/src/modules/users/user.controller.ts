import { Request, Response, NextFunction } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler'
import { AuthenticatedRequest } from '../../middleware/auth'
import { getUserProfile, updateProfile, changePassword, uploadProfileImage, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from './user.service'

export const getProfile = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  res.status(200).json(await getUserProfile(userId))
})

export const updateProfileHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { name, phone } = req.body as { name?: string; phone?: string }
  res.status(200).json(await updateProfile(userId, { name, phone }))
})

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
  res.status(200).json(await changePassword(userId, { currentPassword, newPassword }))
})

export const uploadProfileImageHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  if (!req.file) throw new AppError('No image file provided', 400)
  res.status(200).json(await uploadProfileImage(userId, req.file.buffer, req.file.mimetype))
})

export const getAddressesHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  res.status(200).json(await getAddresses(userId))
})

export const addAddressHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { label, recipientName, phone, street, city, postalCode, country, isDefault } = req.body as {
    label?: string; recipientName: string; phone: string; street: string
    city: string; postalCode: string; country?: string; isDefault?: boolean
  }
  res.status(201).json(await addAddress(userId, { label, recipientName, phone, street, city, postalCode, country, isDefault }))
})

export const updateAddressHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { id: addressId } = req.params
  const { label, recipientName, phone, street, city, postalCode, country, isDefault } = req.body as {
    label?: string; recipientName?: string; phone?: string; street?: string
    city?: string; postalCode?: string; country?: string; isDefault?: boolean
  }
  res.status(200).json(await updateAddress(userId, addressId, { label, recipientName, phone, street, city, postalCode, country, isDefault }))
})

export const deleteAddressHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { id: addressId } = req.params
  await deleteAddress(userId, addressId)
  res.status(200).json({ message: 'Address deleted successfully' })
})

export const setDefaultAddressHandler = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = (req as AuthenticatedRequest).user!.userId
  const { id: addressId } = req.params
  res.status(200).json(await setDefaultAddress(userId, addressId))
})
