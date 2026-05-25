import 'dotenv/config'
import { createApp } from './app'
import { connectDatabase } from './config/database'
import { connectRedis } from './config/redis'
import { logger } from './utils/logger'

const PORT = parseInt(process.env.PORT || '5000', 10)

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase()
    await connectRedis()

    const app = createApp()

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`)
    })

    // Keep connections alive longer than load balancer timeout (prevents dropped connections)
    server.keepAliveTimeout = 65000
    server.headersTimeout = 66000

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`)
      server.close(async () => {
        const { disconnectDatabase } = await import('./config/database')
        const { disconnectRedis } = await import('./config/redis')
        await disconnectDatabase()
        await disconnectRedis()
        logger.info('Server closed')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason)
      process.exit(1)
    })

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error)
      process.exit(1)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

bootstrap()
