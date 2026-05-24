import mongoose from 'mongoose'
import { logger } from '../utils/logger'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      const uriHasDbName = /\.net\/[^?/]+/.test(uri) || /localhost:\d+\/[^?/]+/.test(uri)
      await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        ...(uriHasDbName ? {} : { dbName: 'onulota' }),
      })
      logger.info('MongoDB connected successfully')
      return
    } catch (error) {
      attempt++
      logger.error(`MongoDB connection attempt ${attempt} failed:`, error)
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
  throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`)
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err)
})
