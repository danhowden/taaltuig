/**
 * Input sanitization utilities for preventing XSS attacks
 */

// HTML entities that should be decoded
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
}

/**
 * Strip all HTML tags from a string
 */
function stripHtmlTags(input: string): string {
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(input: string): string {
  let result = input
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, 'gi'), char)
  }
  // Handle numeric entities (&#123; or &#x1A;)
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  )
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )
  return result
}

/**
 * Sanitize a string by stripping HTML tags and decoding entities.
 * Returns undefined if input is undefined/null, empty string if input is empty.
 */
export function sanitizeText(input: string | undefined | null): string | undefined {
  if (input === undefined || input === null) {
    return undefined
  }

  let result = input.trim()
  if (result === '') {
    return ''
  }

  // Strip HTML tags
  result = stripHtmlTags(result)
  // Decode HTML entities
  result = decodeHtmlEntities(result)
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Sanitize an array of strings (e.g., tags)
 */
export function sanitizeTags(tags: string[] | undefined | null): string[] | undefined {
  if (tags === undefined || tags === null) {
    return undefined
  }

  return tags
    .map((tag) => sanitizeText(tag))
    .filter((tag): tag is string => tag !== undefined && tag !== '')
}
