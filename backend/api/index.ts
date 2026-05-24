import 'dotenv/config'
import type { IncomingMessage, ServerResponse } from 'http'

let appHandler: any = null
let initialized = false

async function getApp() {
  if (appHandler && initialized) return appHandler

  try {
    const mongoose = await import('mongoose')
    if (mongoose.default.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI
      if (!uri) throw new Error('MONGODB_URI is not set')
      await mongoose.default.connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      })
    }
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
