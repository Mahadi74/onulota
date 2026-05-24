import { Router, RequestHandler } from 'express'
import { getSettingsHandler, updateSettingsHandler } from './settings.controller'
import { authenticateToken, requireRole } from '../../middleware/auth'

const router = Router()
const auth = authenticateToken as RequestHandler
const adminOnly = requireRole('admin') as RequestHandler

router.get('/', getSettingsHandler)
router.put('/', auth, adminOnly, updateSettingsHandler)
export default router
