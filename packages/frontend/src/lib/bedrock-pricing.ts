/**
 * AWS Bedrock Model Pricing (per 1,000 tokens)
 * Updated: February 2026
 * Sources:
 * - Claude: https://aws.amazon.com/bedrock/pricing/
 * - Nova: https://aws.amazon.com/nova/pricing/
 */

interface ModelPricing {
  inputPer1k: number // USD per 1,000 input tokens
  outputPer1k: number // USD per 1,000 output tokens
}

const PRICING_MAP: Record<string, ModelPricing> = {
  // Claude 4.5 Models
  'claude-opus-4-5': {
    inputPer1k: 0.005,
    outputPer1k: 0.025,
  },
  'claude-sonnet-4-5': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
  'claude-sonnet-4': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
  'claude-haiku-4-5': {
    inputPer1k: 0.001,
    outputPer1k: 0.005,
  },

  // Claude 3.x Models
  'claude-3-7-sonnet': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
  },
  'claude-3-5-haiku': {
    inputPer1k: 0.001,
    outputPer1k: 0.005,
  },
  'claude-3-haiku': {
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
  },

  // Amazon Nova Models
  'nova-premier': {
    inputPer1k: 0.0025,
    outputPer1k: 0.0125,
  },
  'nova-pro': {
    inputPer1k: 0.0008,
    outputPer1k: 0.0032,
  },
  'nova-lite': {
    inputPer1k: 0.00006,
    outputPer1k: 0.00024,
  },
  'nova-micro': {
    inputPer1k: 0.000035,
    outputPer1k: 0.00014,
  },
}

export interface CostBreakdown {
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
  modelName: string
}

/**
 * Calculate cost for a Bedrock API response
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): CostBreakdown | null {
  // Extract model name from ID (handle inference profiles like "global.anthropic.claude-sonnet-4-5-20250929-v1:0")
  const modelKey = Object.keys(PRICING_MAP).find((key) => modelId.includes(key))

  if (!modelKey) {
    return null // Pricing not available for this model
  }

  const pricing = PRICING_MAP[modelKey]
  const inputCost = (inputTokens / 1000) * pricing.inputPer1k
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k

  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    modelName: modelKey,
  }
}

/**
 * Format cost as USD string with appropriate precision
 */
export function formatCost(cost: number): string {
  if (cost < 0.00001) {
    return `$${cost.toFixed(8)}`
  }
  if (cost < 0.001) {
    return `$${cost.toFixed(6)}`
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(5)}`
  }
  return `$${cost.toFixed(4)}`
}
