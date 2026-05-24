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

const router = Router()

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
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />` : ''}
  <meta property="product:price:amount" content="${price}" />
  <meta property="product:price:currency" content="BDT" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}

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

