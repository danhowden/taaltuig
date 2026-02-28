// ============================================================================
// Type Definitions - Synced with OpenAPI spec at /docs/design/backend/openapi.yaml
// ============================================================================

export type Direction = 'forward' | 'reverse'
export type State = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
export type Grade = 0 | 2 | 3 | 4 // Again, Hard, Good, Easy
export type CardSource = 'manual' | 'anki'

// Insight types for AI-generated card insights
export type InsightType =
  | 'compound'
  | 'verb_forms'
  | 'root'
  | 'pronunciation'
  | 'confusable'
  | 'example'
  | 'plural'
  | 'separable_verb'

// Proficiency level for insight complexity
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced'
export type InsightStatus = 'pending' | 'approved' | 'rejected'
export type InsightReviewer = 'ai' | 'human'

export interface CardInsight {
  type: InsightType
  content: string
  status: InsightStatus
  generated_at: string
  reviewed_at?: string
  reviewed_by?: InsightReviewer
  rejection_reason?: string
}

// ============================================================================
// Core Entities
// ============================================================================

export interface User {
  id: string // UUID
  google_sub: string
  email: string
  name: string
  picture_url?: string
  created_at: string // ISO 8601 date-time
  last_login?: string // ISO 8601 date-time
}

export interface Card {
  id: string // DynamoDB SK value (CARD#{uuid})
  card_id: string // Card UUID
  user_id: string // UUID
  front: string // Dutch phrase
  back: string // English translation
  explanation?: string // Optional notes or grammar explanation
  category?: string // User-defined category
  source?: CardSource // How the card was created (manual or anki)
  tags?: string[] // Optional tags (frontend extension, not in OpenAPI spec)
  created_at: string // ISO 8601 date-time
  updated_at?: string // ISO 8601 date-time
  // AI-generated insights
  insights?: CardInsight[]
  insights_generated_at?: string
}

export interface UserSettings {
  user_id: string // UUID
  new_cards_per_day: number // 0-100, default 20
  max_reviews_per_day: number | null // null = unlimited
  learning_steps: number[] // Minutes, default [1, 10]
  relearning_steps: number[] // Minutes, default [10]
  graduating_interval: number // Days, default 1
  easy_interval: number // Days, default 4
  starting_ease: number // Minimum 1.3, default 2.5
  easy_bonus: number // Default 1.3
  interval_modifier: number // Default 1.0
  maximum_interval?: number // Days, default 36500 (~100 years)
  lapse_new_interval: number // Percentage (0-100), default 0 (like Anki)
  disabled_categories?: string[] | null // Categories to exclude from review (frontend extension, not in OpenAPI spec yet)
  show_unreviewed_insights: boolean // Display AI-approved insights before human review (default: true)
  proficiency_level?: ProficiencyLevel // User's Dutch proficiency level for tailoring insights (default: beginner)
  updated_at: string // ISO 8601 date-time
}

// ReviewItem interface (internal representation, not exposed by API directly)
export interface ReviewItem {
  id: string
  card_id: string
  user_id: string
  direction: Direction
  state: State
  interval: number
  ease_factor: number
  repetitions: number
  step_index: number
  due_date: string
  last_reviewed?: string | null
  created_at: string
}

// ============================================================================
// Review System
// ============================================================================

export interface QueueItem {
  id?: string // Backwards compatibility (deprecated, use review_item_id)
  review_item_id: string // UUID
  card_id: string // UUID
  direction: Direction // forward = Dutch→English, reverse = English→Dutch
  state: State
  interval: number // Days
  ease_factor: number
  repetitions: number // Consecutive successful reviews
  step_index: number // Current position in learning/relearning steps
  due_date: string // ISO 8601 date-time
  last_reviewed: string | null // ISO 8601 date-time
  // Embedded card data
  front: string // Dutch phrase
  back: string // English translation
  explanation?: string
  category?: string
  // Denormalized insights (only approved insights)
  insights?: CardInsight[]
}

export interface QueueResponse {
  queue: QueueItem[]
  stats: {
    due_count: number // Number of due cards (LEARNING, REVIEW, RELEARNING)
    new_count: number // Number of NEW cards in queue
    new_remaining_today: number // Remaining new cards available today
    total_count?: number // Total cards (frontend extension)
    learning_count?: number // Learning cards (frontend extension)
  }
}

export interface SubmitReviewRequest {
  review_item_id: string // UUID
  grade: Grade // 0=Again, 2=Hard, 3=Good, 4=Easy
  duration_ms: number // Time spent reviewing in milliseconds
}

export interface SubmitReviewResponse {
  next_review: string // ISO 8601 date-time
  interval_days: number
  state: State
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetCurrentUserResponse {
  user: User
}

export interface ListCardsResponse {
  cards: Card[]
}

// Paginated cards response
export interface CardPagination {
  cursor: string | null
  hasMore: boolean
  pageSize: number
}

export interface PaginatedListCardsResponse {
  cards: Card[]
  pagination: CardPagination
}

// Query params for listing cards with pagination
export interface ListCardsParams {
  limit?: number
  cursor?: string
  category?: string
  insightStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'any'
  search?: string
}

export interface CreateCardRequest {
  front: string
  back: string
  explanation?: string
  category?: string
  tags?: string[] // Frontend extension
  source?: string // Frontend extension
}

export interface CreateCardResponse {
  card: Card
}

export interface UpdateCardRequest {
  front?: string
  back?: string
  explanation?: string
  category?: string
}

export interface UpdateCardResponse {
  card: Card
}

export interface DeleteCardResponse {
  success: boolean
}

export interface RenameCategoryRequest {
  old_name?: string // OpenAPI spec field (snake_case)
  new_name?: string // OpenAPI spec field (snake_case)
  oldCategory?: string // Frontend uses this (camelCase)
  newCategory?: string // Frontend uses this (camelCase)
}

export interface RenameCategoryResponse {
  updated_count: number // OpenAPI spec field
  success?: boolean // Backend may include this
  cardsUpdated?: number // Frontend expects this
  reviewItemsUpdated?: number // Frontend expects this
  settingsUpdated?: boolean // Frontend expects this
}

export interface GetUploadUrlRequest {
  filename: string
}

export interface GetUploadUrlResponse {
  upload_url: string // Presigned S3 URL (valid for 5 minutes) - snake_case from API
  uploadUrl?: string // Backwards compatibility (deprecated)
  s3_key: string // S3 object key - snake_case from API
  s3Key?: string // Backwards compatibility (deprecated)
  s3_bucket?: string // Backend may include this
  s3Bucket?: string // Backwards compatibility (deprecated)
}

export interface ImportAnkiRequest {
  s3_key?: string
  s3Key?: string // Backwards compatibility
  s3_bucket?: string
  s3Bucket?: string // Backwards compatibility
  connection_id: string // WebSocket connection ID
}

export interface ImportAnkiResponse {
  imported: number
  success?: boolean // Backend may include this
  skipped?: number // Backend may include this
  total?: number // Backend may include this
}

export interface ResetDailyReviewsResponse {
  success: boolean
  deleted_count?: number // Backend may include this
}

export interface ClearInsightsResponse {
  message: string
  cleared_cards: number
  cleared_review_items: number
}

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, unknown>
}

// ============================================================================
// Insights API Types
// ============================================================================

export interface GenerateInsightsRequest {
  card_ids: string[] // Max 20 per batch
}

export interface GeneratedInsight {
  card_id: string
  insights_count: number
}

export interface GenerateInsightsResponse {
  generated: GeneratedInsight[]
  failed?: string[] // Card IDs that failed to generate
}

export interface ValidateInsightsRequest {
  card_ids: string[] // Cards with pending insights
}

export interface ValidatedInsight {
  card_id: string
  insights: Array<{
    type: InsightType
    content: string
    approved: boolean
    reason?: string
  }>
}

export interface ValidateInsightsResponse {
  validated: ValidatedInsight[]
  failed?: string[]
}

export interface ReviewInsightRequest {
  insight_index: number
  action: 'approve' | 'reject' | 'edit'
  content?: string // For edit action
  rejection_reason?: string // For reject action
}

export interface ReviewInsightResponse {
  card: Card
}

export interface InsightsQueueItem {
  card_id: string
  front: string
  back: string
  insights: CardInsight[]
}

export interface InsightsQueueResponse {
  cards: InsightsQueueItem[]
  total: number
}

// ============================================================================
// Metrics API Types
// ============================================================================

export interface MetricDatapoint {
  timestamp: string
  approved: number
  rejected: number
  cardsProcessed: number
}

export interface InsightsMetricsResponse {
  period: 'hour' | 'day' | 'week'
  datapoints: MetricDatapoint[]
  totals: {
    approved: number
    rejected: number
    cardsProcessed: number
    approvalRate: number
  }
}
