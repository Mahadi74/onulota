import { Router } from 'express'
import { authenticateToken } from '../../middleware/auth'
import {
  initSSLCommerzHandler,
  handleSSLCommerzSuccessHandler,
  handleSSLCommerzFailHandler,
  handleSSLCommerzCancelHandler,
  confirmCODOrderHandler
} from './payment.controller'

const router = Router()

router.post('/sslcommerz/init', authenticateToken as any, initSSLCommerzHandler as any)
router.post('/sslcommerz/success', handleSSLCommerzSuccessHandler as any)
router.post('/sslcommerz/fail', handleSSLCommerzFailHandler as any)
router.post('/sslcommerz/cancel', handleSSLCommerzCancelHandler as any)
router.post('/cod/confirm', authenticateToken as any, confirmCODOrderHandler as any)

export default router
