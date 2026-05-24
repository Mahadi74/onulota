/**
 * Vercel serverless entry point.
 *
 * - Exports Express app directly (no app.listen)
 * - Connects MongoDB/Redis lazily on first request
 * - Single retry, short timeout — fits Vercel 10s limit
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { createApp } from '../src/app'
import { connectRedis } from '../src/config/redis'

let initialized = false

async function ensureConnected() {
  if (initialized) return

  // MongoDB — single attempt, 5s timeout
  if (mongoose.connection.readyState === 0) {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    })
  }

  // Redis — don't crash if it fails (graceful degradation)
  try {
    await connectRedis()
  } catch (_) {
    console.warn('Redis connection skipped')
  }

  initialized = true
}

const app = createApp()

export default async function handler(req: any, res: any) {
  try {
    await ensureConnected()
  } catch (err) {
    console.error('DB connection failed:', err)
    res.status(503).json({ error: 'Service temporarily unavailable' })
    return
  }
  app(req, res)
}
