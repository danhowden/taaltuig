/**
 * Card insight from DynamoDB
 */
interface CardInsight {
  type: string
  content: string
  status: string
  generated_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
}

/**
 * Card data from DynamoDB
 */
interface CardData {
  card_id: string
  user_id: string
  front: string
  back: string
  explanation?: string
  category?: string
  source: string
  tags?: string[]
  created_at: string
  updated_at: string
  insights?: CardInsight[]
  insights_generated_at?: string
}

/**
 * Map Card to API response format
 */
export function mapCardToResponse(card: CardData) {
  return {
    id: card.card_id,
    card_id: card.card_id,
    user_id: card.user_id,
    front: card.front,
    back: card.back,
    explanation: card.explanation,
    category: card.category,
    source: card.source,
    tags: card.tags,
    created_at: card.created_at,
    updated_at: card.updated_at,
    insights: card.insights,
    insights_generated_at: card.insights_generated_at,
  }
}
