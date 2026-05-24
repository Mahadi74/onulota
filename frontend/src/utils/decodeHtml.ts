/**
 * Decodes HTML entities in strings returned from the API.
 * Needed because the old backend middleware over-encoded text
 * (apostrophes → &#x27;, slashes → &#x2F;, etc.) before storing in DB.
 */
export function decodeHtml(str?: string | null): string {
  if (!str) return ''
  return str
    .replace(/&#x2F;/gi, '/').replace(/&#47;/gi, '/')
    .replace(/&#x27;/gi, "'").replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&apos;/gi, "'")
}

/** Decodes a URL — same as decodeHtml but makes intent clear */
export const decodeUrl = decodeHtml
