import { Router } from 'express'
import express from 'express'
import Joi from 'joi'
import { authenticateToken } from '../../middleware/auth'
import { validateBody, commonSchemas } from '../../middleware/validate'
import { getProfile, updateProfileHandler, changePasswordHandler, uploadProfileImageHandler, getAddressesHandler, addAddressHandler, updateAddressHandler, deleteAddressHandler, setDefaultAddressHandler } from './user.controller'
import { profileImageUpload } from './upload.middleware'

const router = Router()

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({ 'string.min': 'Name must be at least 2 characters', 'string.max': 'Name must not exceed 100 characters' }),
  phone: commonSchemas.phone,
}).min(1).messages({ 'object.min': 'At least one field (name or phone) must be provided' })

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({ 'any.required': 'Current password is required', 'string.empty': 'Current password is required' }),
  newPassword: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
    'any.required': 'New password is required', 'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters',
    'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
})

const addAddressSchema = Joi.object({
  label: Joi.string().max(50).optional(),
  recipientName: Joi.string().min(2).max(100).required().messages({ 'any.required': 'Recipient name is required', 'string.empty': 'Recipient name is required' }),
  phone: Joi.string().required().messages({ 'any.required': 'Phone number is required', 'string.empty': 'Phone number is required' }),
  street: Joi.string().min(2).max(200).required().messages({ 'any.required': 'Street address is required', 'string.empty': 'Street address is required' }),
  city: Joi.string().min(2).max(100).required().messages({ 'any.required': 'City is required', 'string.empty': 'City is required' }),
  postalCode: commonSchemas.postalCode.required().messages({ 'any.required': 'Postal code is required', 'string.empty': 'Postal code is required', 'string.pattern.base': 'Postal code must be a 4-digit Bangladesh format' }),
  country: Joi.string().max(100).optional().default('Bangladesh'),
  isDefault: Joi.boolean().optional(),
})

const updateAddressSchema = Joi.object({
  label: Joi.string().max(50).optional(),
  recipientName: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().optional(),
  street: Joi.string().min(2).max(200).optional(),
  city: Joi.string().min(2).max(100).optional(),
  postalCode: commonSchemas.postalCode.optional().messages({ 'string.pattern.base': 'Postal code must be a 4-digit Bangladesh format' }),
  country: Joi.string().max(100).optional(),
  isDefault: Joi.boolean().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' })

const auth = authenticateToken as express.RequestHandler

router.get('/profile', auth, getProfile as express.RequestHandler)
router.put('/profile', auth, validateBody(updateProfileSchema) as express.RequestHandler, updateProfileHandler as express.RequestHandler)
router.put('/password', auth, validateBody(changePasswordSchema) as express.RequestHandler, changePasswordHandler as express.RequestHandler)
router.post('/profile/image', auth, profileImageUpload.single('image') as express.RequestHandler, uploadProfileImageHandler as express.RequestHandler)
router.get('/addresses', auth, getAddressesHandler as express.RequestHandler)
router.post('/addresses', auth, validateBody(addAddressSchema) as express.RequestHandler, addAddressHandler as express.RequestHandler)
router.put('/addresses/:id', auth, validateBody(updateAddressSchema) as express.RequestHandler, updateAddressHandler as express.RequestHandler)
router.delete('/addresses/:id', auth, deleteAddressHandler as express.RequestHandler)
router.patch('/addresses/:id/default', auth, setDefaultAddressHandler as express.RequestHandler)

export default router
