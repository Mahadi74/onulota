import express from 'express'
import { Router } from 'express'
import Joi from 'joi'
import { authenticateToken, requireRole } from '../../middleware/auth'
import { validateBody, validateParams } from '../../middleware/validate'
import {
  getHomepageSectionsHandler,
  createHomepageSectionHandler,
  updateHomepageSectionHandler,
  deleteHomepageSectionHandler,
} from '../homepage/homepage.controller'

const router = Router()

const auth = authenticateToken as express.RequestHandler
const adminOnly = requireRole('admin') as express.RequestHandler

const homepageSectionIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'id must be a valid MongoDB ObjectId',
      'any.required': 'Homepage section ID is required',
    }),
})

const homepageSectionSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    'any.required': 'Title is required',
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title must not exceed 200 characters',
  }),
  subtitle: Joi.string().max(200).optional(),
  description: Joi.string().max(1000).optional(),
  image: Joi.string().uri().required().messages({
    'any.required': 'Image URL is required',
    'string.uri': 'Image URL must be a valid URL',
  }),
  actionText: Joi.string().max(100).optional(),
  actionUrl: Joi.string().uri().optional(),
  section: Joi.string().valid('hero', 'carousel', 'ad', 'deal', 'banner', 'feature', 'brand', 'category_highlight', 'cta').required().messages({
    'any.only': 'Section must be one of hero, carousel, ad, deal, banner, feature, brand, category_highlight, cta',
    'any.required': 'Section is required',
  }),
  order: Joi.number().integer().min(0).optional().default(0),
  isActive: Joi.boolean().optional().default(true),
  metadata: Joi.object().optional(),
})

const homepageSectionUpdateSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  subtitle: Joi.string().max(200).optional(),
  description: Joi.string().max(1000).optional(),
  image: Joi.string().uri().optional(),
  actionText: Joi.string().max(100).optional(),
  actionUrl: Joi.string().uri().optional(),
  section: Joi.string().valid('hero', 'carousel', 'ad', 'deal', 'banner', 'feature', 'brand', 'category_highlight', 'cta').optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
})

router.get('/', auth, adminOnly, getHomepageSectionsHandler as express.RequestHandler)
router.post('/', auth, adminOnly, validateBody(homepageSectionSchema) as express.RequestHandler, createHomepageSectionHandler as express.RequestHandler)
router.put('/:id', auth, adminOnly, validateParams(homepageSectionIdSchema) as express.RequestHandler, validateBody(homepageSectionUpdateSchema) as express.RequestHandler, updateHomepageSectionHandler as express.RequestHandler)
router.delete('/:id', auth, adminOnly, validateParams(homepageSectionIdSchema) as express.RequestHandler, deleteHomepageSectionHandler as express.RequestHandler)

export default router
