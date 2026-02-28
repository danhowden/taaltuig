/**
 * Currency conversion utilities
 * Uses exchangerate-api.com for USD to EUR conversion
 */

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD'
const CACHE_KEY = 'usd-eur-rate'
const CACHE_DURATION = 1000 * 60 * 60 * 12 // 12 hours

interface CachedRate {
  rate: number
  timestamp: number
}

let cachedRate: CachedRate | null = null

/**
 * Get USD to EUR exchange rate
 * Cached for 12 hours to avoid excessive API calls
 */
export async function getUsdToEurRate(): Promise<number> {
  // Check memory cache first
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate
  }

  // Check localStorage cache
  try {
    const stored = localStorage.getItem(CACHE_KEY)
    if (stored) {
      const parsed: CachedRate = JSON.parse(stored)
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        cachedRate = parsed
        return parsed.rate
      }
    }
  } catch (error) {
    console.error('Failed to load cached exchange rate:', error)
  }

  // Fetch fresh rate
  try {
    const response = await fetch(EXCHANGE_RATE_API)
    const data = await response.json()
    const rate = data.rates.EUR

    if (!rate) {
      throw new Error('EUR rate not found in response')
    }

    // Cache the rate
    cachedRate = { rate, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedRate))

    return rate
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error)
    // Fallback to approximate rate if API fails
    return 0.92 // Approximate USD to EUR rate
  }
}

/**
 * Convert USD to EUR
 */
export async function convertUsdToEur(usd: number): Promise<number> {
  const rate = await getUsdToEurRate()
  return usd * rate
}

/**
 * Format amount in EUR
 */
export function formatEur(amount: number): string {
  if (amount < 0.00001) {
    return `€${amount.toFixed(8)}`
  }
  if (amount < 0.001) {
    return `€${amount.toFixed(6)}`
  }
  if (amount < 0.01) {
    return `€${amount.toFixed(5)}`
  }
  return `€${amount.toFixed(4)}`
}
