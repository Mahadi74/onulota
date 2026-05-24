import 'dotenv/config'
import type { IncomingMessage, ServerResponse } from 'http'

let appHandler: any = null
let initialized = false
// Cache the in-flight connection promise so concurrent cold-start requests
// all await the same connection rather than racing to open multiple.
let mongoConnectPromise: Promise<void> | null = null

async function ensureMongoConnected(): Promise<void> {
  const mongoose = await import('mongoose')
  const state = mongoose.default.connection.readyState
  // 1 = connected, already good
  if (state === 1) return
  // 2 = connecting — wait for the existing promise instead of opening another
  if (mongoConnectPromise) return mongoConnectPromise

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  const uriHasDbName = /\.net\/[^?/]+/.test(uri) || /localhost:\d+\/[^?/]+/.test(uri)

  mongoConnectPromise = mongoose.default
    .connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,  // slightly longer for cold starts
      socketTimeoutMS: 15000,
      ...(uriHasDbName ? {} : { dbName: 'onulota' }),
    })
    .then(() => {
      console.log('MongoDB connected')
    })
    .catch((err) => {
      // Reset so the next request retries rather than waiting on a dead promise
      mongoConnectPromise = null
      throw err
    })

  return mongoConnectPromise
}

async function getApp() {
  if (appHandler && initialized) return appHandler

  try {
    await ensureMongoConnected()
  } catch (err) {
    console.error('MongoDB connection error:', err)
    throw err
  }

  try {
    const { connectRedis } = await import('../src/config/redis')
    await connectRedis()
  } catch (err) {
    console.warn('Redis skipped:', (err as Error).message)
  }

  const { createApp } = await import('../src/app')
  appHandler = createApp()
  initialized = true
  return appHandler
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp()
    app(req, res)
  } catch (err) {
    console.error('Handler error:', err)
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Service unavailable', message: (err as Error).message }))
  }
}
