/**
 * Social Share / OG Tag Routes
 *
 * GET /share/products/:id
 *
 * Returns a static HTML page with full Open Graph + Twitter Card meta tags so
 * that social media crawlers (Facebook, WhatsApp, Telegram, LinkedIn …) show a
 * rich link preview when someone shares a product URL.
 *
 * Real browsers are immediately redirected back to the React SPA product page.
 *
 * Usage:
 *   Share URL: https://yourdomain.com/share/products/:id
 *   (or configure nginx to proxy /products/:id crawler requests here)
 */

import { Router, Request, Response } from 'express'
import { Product } from '../models'
import sharp from 'sharp'
import https from 'https'
import http from 'http'

const router = Router()

// ---------------------------------------------------------------------------
// Helper: fetch a remote image as a Buffer
// ---------------------------------------------------------------------------
function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Helper: build the "Order Now" SVG badge overlay
// ---------------------------------------------------------------------------
function buildOrderNowBadge(width: number, height: number): Buffer {
  const btnW = Math.round(width * 0.32)
  const btnH = Math.round(height * 0.11)
  const btnX = width - btnW - Math.round(width * 0.03)
  const btnY = height - btnH - Math.round(height * 0.04)
  const radius = Math.round(btnH / 2)
  const fontSize = Math.round(btnH * 0.38)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <!-- semi-transparent dark scrim at bottom for readability -->
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${Math.round(height * 0.55)}" width="${width}" height="${Math.round(height * 0.45)}" fill="url(#scrim)"/>

    <!-- Order Now pill button -->
    <rect x="${btnX}" y="${btnY}" width="${btnW}" height="${btnH}"
          rx="${radius}" ry="${radius}"
          fill="#FF6B00" opacity="0.95"/>
    <!-- subtle drop shadow -->
    <rect x="${btnX + 2}" y="${btnY + 3}" width="${btnW}" height="${btnH}"
          rx="${radius}" ry="${radius}"
          fill="#000" opacity="0.18"/>
    <rect x="${btnX}" y="${btnY}" width="${btnW}" height="${btnH}"
          rx="${radius}" ry="${radius}"
          fill="#FF6B00" opacity="0.97"/>

    <!-- Button text -->
    <text x="${btnX + btnW / 2}" y="${btnY + btnH / 2 + fontSize * 0.37}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          fill="#ffffff"
          text-anchor="middle"
          letter-spacing="0.5">🛒 Order Now</text>
  </svg>`

  return Buffer.from(svg)
}

const SITE_NAME = process.env.SITE_NAME || 'Onulota'

function getSiteUrl(req: Request): string {
  // Use explicit env var first (production)
  if (process.env.FRONTEND_URL) {
    const base = process.env.FRONTEND_URL.split(',')[0].trim()
    // Always use the www variant as canonical to avoid non-www ↔ www redirect loops
    try {
      const url = new URL(base)
      if (!url.hostname.startsWith('www.') && !url.hostname.includes('localhost')) {
        return `${url.protocol}//www.${url.hostname}`
      }
    } catch { /* ignore */ }
    return base
  }
  // Derive from request host so ngrok / staging URLs work automatically
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  return `${proto}://${host}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// GET /share/og-image/:id  — returns the product image with "Order Now" badge
// ---------------------------------------------------------------------------
router.get('/og-image/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const siteUrl = getSiteUrl(req)

  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).send('Invalid id')
  }

  try {
    const product = await Product.findById(id).select('images').lean()
    if (!product) return res.status(404).send('Not found')

    const rawImageUrl = product.images?.[0]?.url || ''
    const imageUrl = rawImageUrl
      ? rawImageUrl.startsWith('http')
        ? rawImageUrl
        : `${siteUrl}${rawImageUrl.startsWith('/') ? '' : '/'}${rawImageUrl}`
      : ''

    if (!imageUrl) return res.status(404).send('No image')

    // Target OG dimensions
    const OG_W = 1200
    const OG_H = 630

    // Fetch & resize the product image to OG dimensions
    const rawBuffer = await fetchImageBuffer(imageUrl)
    const baseImage = await sharp(rawBuffer)
      .resize(OG_W, OG_H, { fit: 'cover', position: 'centre' })
      .toBuffer()

    // Build SVG overlay with "Order Now" badge
    const overlayBuffer = buildOrderNowBadge(OG_W, OG_H)

    // Composite badge onto product image
    const final = await sharp(baseImage)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer()

    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600') // 1 hr
    res.status(200).send(final)
  } catch (err) {
    console.error('[og-image] error:', err)
    res.status(500).send('Image generation failed')
  }
})

// ---------------------------------------------------------------------------
// GET /share/products/:id  — OG tag page + browser redirect
// ---------------------------------------------------------------------------
router.get('/products/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const siteUrl = getSiteUrl(req)

  // Basic ObjectId validation
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.redirect(`${siteUrl}/products/${id}`)
  }

  try {
    const product = await Product.findById(id)
      .select('name description price compareAtPrice images brand averageRating reviewCount category')
      .populate('category', 'name')
      .lean()

    if (!product) {
      return res.redirect(`${siteUrl}/products/${id}`)
    }

    const productUrl = `${siteUrl}/products/${id}`
    const rawImageUrl = product.images?.[0]?.url || ''
    // Make image URL absolute so social crawlers can fetch it
    const ogImage = rawImageUrl
      ? rawImageUrl.startsWith('http')
        ? rawImageUrl
        : `${siteUrl}${rawImageUrl.startsWith('/') ? '' : '/'}${rawImageUrl}`
      : ''

    const categoryName =
      typeof product.category === 'object' && product.category !== null
        ? (product.category as { name?: string }).name || ''
        : ''

    const rawDesc = product.description
      ? product.description.slice(0, 200)
      : `Buy ${product.name}${product.brand ? ` by ${product.brand}` : ''}${categoryName ? ` — ${categoryName}` : ''}. Fast delivery across Bangladesh.`

    const title = escapeHtml(product.name)
    const description = escapeHtml(rawDesc)
    const price = product.price

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary SEO -->
  <title>${title} — ${SITE_NAME}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${productUrl}" />

  <!-- Open Graph (Facebook, WhatsApp, LinkedIn, Telegram) -->
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${productUrl}" />
  ${ogImage ? `<meta property="og:image" content="${siteUrl}/share/og-image/${id}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />` : ''}
  <meta property="product:price:amount" content="${price}" />
  <meta property="product:price:currency" content="BDT" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${ogImage ? `<meta name="twitter:image" content="${siteUrl}/share/og-image/${id}" />` : ''}

  <!-- Redirect real browsers to React SPA -->
  <meta http-equiv="refresh" content="0; url=${productUrl}" />
  <script>window.location.replace("${productUrl}")</script>
</head>
<body style="font-family:sans-serif;padding:2rem;text-align:center">
  <p>Loading product… <a href="${productUrl}">Click here if not redirected</a></p>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300') // 5 min cache
    res.status(200).send(html)
  } catch (err) {
    res.redirect(`${getSiteUrl(req)}/products/${id}`)
  }
})

export default router

