import { createClient, RedisClientType } from 'redis'
import { logger } from '../utils/logger'

let redisClient: RedisClientType | null = null

export async function connectRedis(): Promise<RedisClientType> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'

  redisClient = createClient({ url }) as RedisClientType

  redisClient.on('error', (err) => logger.error('Redis error:', err))
  redisClient.on('connect', () => logger.info('Redis connected'))
  redisClient.on('disconnect', () => logger.warn('Redis disconnected'))

  await redisClient.connect()
  return redisClient
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.')
  }
  return redisClient
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getRedisClient().get(key)
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedisClient().setEx(key, ttlSeconds, value)
  } catch (err) {
    logger.warn('Redis cache set failed:', err)
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedisClient().del(key)
  } catch (err) {
    logger.warn('Redis cache delete failed:', err)
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect()
    redisClient = null
  }
}
