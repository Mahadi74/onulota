/**
 * Email service for sending notifications.
 * 
 * Supports:
 * - Order status change notifications
 * - Uses nodemailer for email delivery
 */

import * as nodemailer from 'nodemailer'
import { logger } from './logger'

// Create transporter (configure based on environment)
const createTransporter = () => {
  // For development/testing, use ethereal email
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_EMAIL || 'test@ethereal.email',
        pass: process.env.ETHEREAL_PASSWORD || 'test'
      }
    })
  }

  // For production, use configured SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })
}

const transporter = createTransporter()

/**
 * Send order status change email notification.
 * 
 * @param email - Recipient email address
 * @param name - Recipient name
 * @param orderNumber - Order number
 * @param oldStatus - Previous order status
 * @param newStatus - New order status
 * @param trackingNumber - Optional tracking number (for shipped status)
 */
export async function sendOrderStatusChangeEmail(
  email: string,
  name: string,
  orderNumber: string,
  oldStatus: string,
  newStatus: string,
  trackingNumber?: string
): Promise<void> {
  try {
    // Build email content based on status
    let statusMessage = ''
    let actionText = ''

    switch (newStatus) {
      case 'processing':
        statusMessage = 'Your order is being processed and will be shipped soon.'
        actionText = 'We are preparing your order for shipment.'
        break
      case 'shipped':
        statusMessage = 'Your order has been shipped!'
        actionText = trackingNumber
          ? `You can track your package using tracking number: ${trackingNumber}`
          : 'You will receive tracking information shortly.'
        break
      case 'delivered':
        statusMessage = 'Your order has been delivered!'
        actionText = 'Thank you for your purchase. We hope you enjoy your items!'
        break
      case 'cancelled':
        statusMessage = 'Your order has been cancelled.'
        actionText = 'If you have any questions, please contact our support team.'
        break
      default:
        statusMessage = `Your order status has been updated to ${newStatus}.`
        actionText = 'Thank you for your business.'
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .content { margin-bottom: 20px; }
            .footer { background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; font-size: 12px; }
            .order-number { font-weight: bold; color: #007bff; }
            .status-badge { display: inline-block; padding: 5px 10px; background-color: #28a745; color: white; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Status Update</h1>
              <p>Hello ${name},</p>
            </div>
            
            <div class="content">
              <p>Your order <span class="order-number">${orderNumber}</span> status has been updated:</p>
              <p><span class="status-badge">${newStatus.toUpperCase()}</span></p>
              <p>${statusMessage}</p>
              <p>${actionText}</p>
            </div>
            
            <div class="footer">
              <p>Thank you for shopping with us!</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@onulota.com',
      to: email,
      subject: `Order ${orderNumber} - Status Update: ${newStatus.toUpperCase()}`,
      html: htmlContent,
      text: `
Order Status Update

Hello ${name},

Your order ${orderNumber} status has been updated to: ${newStatus}

${statusMessage}

${actionText}

Thank you for shopping with us!
      `
    }

    await transporter.sendMail(mailOptions)
    logger.info(`Order status change email sent to ${email} for order ${orderNumber}`)
  } catch (error) {
    logger.error(`Failed to send order status change email: ${error}`)
    throw error
  }
}

/**
 * Verify email transporter connection.
 * Useful for testing email configuration.
 */
export async function verifyEmailTransporter(): Promise<boolean> {
  try {
    await transporter.verify()
    logger.info('Email transporter verified successfully')
    return true
  } catch (error) {
    logger.error(`Email transporter verification failed: ${error}`)
    return false
  }
}
