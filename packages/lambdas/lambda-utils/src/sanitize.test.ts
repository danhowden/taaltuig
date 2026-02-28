import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeTags } from './sanitize'

describe('sanitizeText', () => {
  it('should return undefined for undefined input', () => {
    expect(sanitizeText(undefined)).toBeUndefined()
  })

  it('should return undefined for null input', () => {
    expect(sanitizeText(null)).toBeUndefined()
  })

  it('should return empty string for empty input', () => {
    expect(sanitizeText('')).toBe('')
    expect(sanitizeText('   ')).toBe('')
  })

  it('should strip HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")')
    expect(sanitizeText('<b>bold</b>')).toBe('bold')
    expect(sanitizeText('<a href="evil.com">click</a>')).toBe('click')
    expect(sanitizeText('Hello <br> World')).toBe('Hello World')
    expect(sanitizeText('<div class="test">content</div>')).toBe('content')
  })

  it('should decode HTML entities', () => {
    expect(sanitizeText('&lt;script&gt;')).toBe('<script>')
    expect(sanitizeText('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(sanitizeText('&quot;quoted&quot;')).toBe('"quoted"')
    expect(sanitizeText('It&#39;s fine')).toBe("It's fine")
  })

  it('should decode numeric HTML entities', () => {
    expect(sanitizeText('&#60;')).toBe('<')
    expect(sanitizeText('&#x3C;')).toBe('<')
    expect(sanitizeText('&#65;&#66;&#67;')).toBe('ABC')
  })

  it('should normalize whitespace', () => {
    expect(sanitizeText('  hello   world  ')).toBe('hello world')
    expect(sanitizeText('line1\n\nline2')).toBe('line1 line2')
    expect(sanitizeText('tab\there')).toBe('tab here')
  })

  it('should handle combined XSS attempts', () => {
    expect(sanitizeText('<img src="x" onerror="alert(1)">')).toBe('')
    expect(sanitizeText('Hello <script>evil()</script> World')).toBe('Hello evil() World')
    expect(sanitizeText('<style>body{display:none}</style>visible')).toBe('body{display:none}visible')
  })

  it('should preserve normal text', () => {
    expect(sanitizeText('Hello, World!')).toBe('Hello, World!')
    expect(sanitizeText('Ik hou van Nederland')).toBe('Ik hou van Nederland')
    expect(sanitizeText('café résumé')).toBe('café résumé')
    expect(sanitizeText('日本語')).toBe('日本語')
  })
})

describe('sanitizeTags', () => {
  it('should return undefined for undefined input', () => {
    expect(sanitizeTags(undefined)).toBeUndefined()
  })

  it('should return undefined for null input', () => {
    expect(sanitizeTags(null)).toBeUndefined()
  })

  it('should return empty array for empty input', () => {
    expect(sanitizeTags([])).toEqual([])
  })

  it('should sanitize each tag', () => {
    expect(sanitizeTags(['<b>tag</b>', 'normal', '  spaced  '])).toEqual([
      'tag',
      'normal',
      'spaced',
    ])
  })

  it('should filter out empty tags', () => {
    expect(sanitizeTags(['valid', '', '   ', 'also-valid'])).toEqual([
      'valid',
      'also-valid',
    ])
  })

  it('should handle XSS in tags', () => {
    expect(sanitizeTags(['<script>x</script>', 'safe'])).toEqual(['x', 'safe'])
  })
})
