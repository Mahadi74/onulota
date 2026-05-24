import { Router } from 'express'
import { getHomepageDataHandler } from './homepage.controller'

const router = Router()

router.get('/', getHomepageDataHandler)

export default router
