/**
 * Vite dev-server plugin: OG / social-share meta tag injector
 *
 * When a social media crawler (Facebook, WhatsApp, Twitter, LinkedIn, Telegram …)
 * requests a product page, it doesn't run JavaScript so it only sees the blank
 * index.html shell.  This middleware intercepts those requests, fetches the product
 * data from the API, and returns a fully-formed HTML page with all Open Graph /
 * Twitter Card meta tags – then redirects real browsers to the React SPA.
 */

import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

/* Social media / link-preview crawlers */
const BOT_UA = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|redditbot|Baiduspider|GoogleBot|bingbot|Applebot|msnbot/i

const API_BASE = 'http://localhost:5000'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildOgHtml(product: {
  _id: string
  name: string
  description?: string
  price: number
  compareAtPrice?: number
  brand?: string
  images?: Array<{ url: string }>
  averageRating?: number
  reviewCount?: number
  category?: { name?: string } | string
}, siteUrl: string): string {
  const title = escapeHtml(product.name)
  const image = product.images?.[0]?.url || ''
  const categoryName = typeof product.category === 'string'
    ? product.category
    : product.category?.name || ''
  const rawDesc = product.description
    ? product.description.slice(0, 200)
    : `Buy ${product.name}${product.brand ? ` by ${product.brand}` : ''} at the best price. ${categoryName} — Fast delivery across Bangladesh.`
  const description = escapeHtml(rawDesc)
  const price = product.price
  const productUrl = `${siteUrl}/products/${product._id}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary -->
  <title>${title} — Onulota</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${productUrl}" />

  <!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Onulota" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${productUrl}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />` : ''}
  <meta property="product:price:amount" content="${price}" />
  <meta property="product:price:currency" content="BDT" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}

  <!-- Redirect real users to the React SPA immediately -->
  <meta http-equiv="refresh" content="0; url=${productUrl}" />
  <script>window.location.replace("${productUrl}")</script>
</head>
<body>
  <p>Redirecting to <a href="${productUrl}">${title}</a>…</p>
</body>
</html>`
}

export function ogTagsPlugin(options: { siteUrl?: string } = {}): Plugin {
  const siteUrl = options.siteUrl || 'http://localhost:3000'

  return {
    name: 'vite-og-tags',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const ua = req.headers['user-agent'] || ''
        const url = req.url || ''

        /* Only intercept product pages requested by crawlers */
        const match = url.match(/^\/products\/([a-f0-9]{24})/i)
        if (!match || !BOT_UA.test(ua)) {
          return next()
        }

        const productId = match[1]
        try {
          const response = await fetch(`${API_BASE}/api/products/${productId}`)
          if (!response.ok) return next()
          const product = await response.json()
          const html = buildOgHtml(product, siteUrl)
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
        } catch {
          next()
        }
      })
    },
  }
}
