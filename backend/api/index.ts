/**
 * Vercel serverless entry point.
 * Exports the Express app directly — no app.listen() for serverless.
 */

import 'dotenv/config'
import { createApp } from '../src/app'
import { connectDatabase } from '../src/config/database'
import { connectRedis } from '../src/config/redis'

let isInitialized = false

async function initialize() {
  if (isInitialized) return
  await connectDatabase()
  await connectRedis()
  isInitialized = true
}

const app = createApp()

// Initialize DB/Redis on first request
const handler = async (req: any, res: any) => {
  await initialize()
  app(req, res)
}

export default handler
