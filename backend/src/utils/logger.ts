import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const { combine, timestamp, errors, json, colorize, simple } = winston.format

const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'cookie']

const redactSensitive = winston.format((info) => {
  const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result = { ...obj }
    for (const key of Object.keys(result)) {
      if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
        result[key] = '[REDACTED]'
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = redact(result[key] as Record<string, unknown>)
      }
    }
    return result
  }
  return redact(info as unknown as Record<string, unknown>) as typeof info
})()

// On Vercel (read-only filesystem), only use console transport
const isVercel = Boolean(process.env.VERCEL)

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), simple()),
  }),
]

if (!isVercel) {
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), errors({ stack: true }), redactSensitive, json()),
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), errors({ stack: true }), redactSensitive, json()),
    })
  )
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports,
})
