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
import { readFileSync, existsSync } from 'fs'
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

function getSpaHtml(id: string): string {
  // Try common Vite/React build output locations
  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(process.cwd(), 'index.html'),
    join(process.cwd(), 'public', 'index.html'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf-8')
  }
  // Final fallback: minimal HTML shell that lets the SPA boot via JS
  // NOTE: uses history.replaceState so it doesn't trigger the Vercel rewrite again
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loading…</title>
  <script>
    // Replace current history entry so the SPA sees /products/:id
    history.replaceState(null, '', '/products/${id}');
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || ''
  const ua = (req.headers['user-agent'] as string) || ''

  // ── Browser: serve the SPA index.html (do NOT redirect — causes loop) ────
  if (!isCrawler(ua)) {
    const html = getSpaHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
    return res.status(200).send(html)
  }

  // ── Crawler: proxy pre-rendered OG HTML from backend ─────────────────────
  const backendUrl = (process.env.VITE_API_URL || 'https://api.onulota.com').replace(/\/+$/, '')
  const shareUrl = `${backendUrl}/share/products/${id}`

  try {
    const upstream = await fetch(shareUrl, {
      headers: { 'user-agent': ua },
      signal: AbortSignal.timeout(8000),
    })

    if (!upstream.ok) {
      // Backend unreachable — serve SPA so the page still loads for the user
      const html = getSpaHtml(id)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(200).send(html)
    }

    const html = await upstream.text()

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    return res.status(200).send(html)
  } catch {
    const html = getSpaHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  }
}
