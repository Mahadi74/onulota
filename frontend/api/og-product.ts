/**
 * Vercel Serverless Function — Product OG Tag Proxy
 *
 * Intercepts /products/:id requests (rewritten from vercel.json).
 *
 * Social media crawlers don't run JavaScript so they see an empty SPA shell.
 * This function solves that:
 *   - Crawlers  → fetch pre-rendered OG HTML from backend /share/products/:id
 *   - Browsers  → serve index.html so React SPA takes over normally
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

const SOCIAL_BOTS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'whatsapp',
  'telegrambot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'googlebot',
  'bingbot',
  'applebot',
  'ia_archiver',
  'pinterest',
  'vkshare',
  'redditbot',
  'skypeuripreview',
  'viber',
  'outbrain',
  'tumblr',
]

function isCrawler(ua: string): boolean {
  const lower = ua.toLowerCase()
  return SOCIAL_BOTS.some((b) => lower.includes(b))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || ''
  const ua = (req.headers['user-agent'] as string) || ''

  // ── Browser: serve the SPA index.html ──────────────────────────────────
  if (!isCrawler(ua)) {
    try {
      const html = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
      return res.status(200).send(html)
    } catch {
      // index.html not available (dev mode) — redirect
      return res.redirect(302, `/products/${id}`)
    }
  }

  // ── Crawler: proxy pre-rendered OG HTML from backend ───────────────────
  const backendUrl = process.env.VITE_API_URL || 'https://api.onulota.com'
  const shareUrl = `${backendUrl}/share/products/${id}`

  try {
    const upstream = await fetch(shareUrl, {
      headers: { 'user-agent': ua },
      signal: AbortSignal.timeout(8000),
    })

    if (!upstream.ok) {
      return res.redirect(302, `https://www.onulota.com/products/${id}`)
    }

    const html = await upstream.text()

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    return res.status(200).send(html)
  } catch {
    return res.redirect(302, `https://www.onulota.com/products/${id}`)
  }
}
