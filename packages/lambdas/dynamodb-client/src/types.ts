export type Direction = 'forward' | 'reverse'
export type State = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
export type Grade = 0 | 2 | 3 | 4 // Again, Hard, Good, Easy

// Insight types for AI-generated card insights
export type InsightType = 'compound' | 'verb_forms' | 'root' | 'pronunciation' | 'confusable' | 'example' | 'plural' | 'separable_verb'

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

export interface User {
  PK: string // USER#<google_sub>
  SK: string // PROFILE
  google_sub: string
  email: string
  name: string
  picture_url?: string
  created_at: string
  last_login?: string
}

export interface UserSettings {
  PK: string // USER#<user_id>
  SK: string // SETTINGS
  user_id: string
  new_cards_per_day: number
  max_reviews_per_day: number | null
  learning_steps: number[]
  relearning_steps: number[]
  graduating_interval: number
  easy_interval: number
  starting_ease: number
  easy_bonus: number
  interval_modifier: number
  maximum_interval: number
  lapse_new_interval: number // Percentage (0-100) of previous interval after lapse, default 0 (like Anki)
  disabled_categories?: string[] | null // Categories disabled from review (null/undefined/empty = all enabled)
  show_unreviewed_insights: boolean // Display AI-approved insights before human review (default: true)
  proficiency_level: ProficiencyLevel // User's Dutch proficiency level for tailoring insights (default: beginner)
  updated_at: string
}

export interface Card {
  PK: string // USER#<user_id>
  SK: string // CARD#<card_id>
  card_id: string
  user_id: string
  front: string
  back: string
  explanation?: string
  source: string
  category?: string // Format: "{collection}/{subdeck}" e.g., "Dutch Basics 2024/Verbs"
  tags?: string[]
  deck_id?: string
  created_at: string
  updated_at: string
  // AI-generated insights
  insights?: CardInsight[]
  insights_generated_at?: string
}

export interface ReviewItem {
  PK: string // USER#<user_id>
  SK: string // REVIEWITEM#<review_item_id>
  GSI1PK: string // USER#<user_id>#<state>
  GSI1SK: string // <due_date_iso>
  review_item_id: string
  card_id: string
  user_id: string
  direction: Direction
  state: State
  interval: number
  ease_factor: number
  repetitions: number
  step_index: number
  due_date: string
  last_reviewed?: string
  created_at: string
  updated_at: string
  // Denormalized card data
  front: string
  back: string
  explanation?: string
  category?: string
  // Denormalized insights (only approved insights are copied here)
  insights?: CardInsight[]
}

export interface ReviewHistory {
  PK: string // USER#<user_id>
  SK: string // HISTORY#<timestamp>#<review_item_id>
  GSI2PK: string // USER#<user_id>#HISTORY#<date_YYYY-MM-DD>
  GSI2SK: string // <timestamp>
  review_item_id: string
  user_id: string
  grade: Grade
  duration_ms: number
  state_before: State
  state_after: State
  interval_before: number
  interval_after: number
  ease_factor_before: number
  ease_factor_after: number
  reviewed_at: string
}

// Default settings
export const DEFAULT_SETTINGS: Omit<UserSettings, 'PK' | 'SK' | 'user_id' | 'updated_at'> = {
  new_cards_per_day: 20,
  max_reviews_per_day: null,
  learning_steps: [1, 10],
  relearning_steps: [10],
  graduating_interval: 1,
  easy_interval: 4,
  starting_ease: 2.5,
  easy_bonus: 1.3,
  interval_modifier: 1.0,
  maximum_interval: 36500, // 100 years in days
  lapse_new_interval: 0, // 0% = reset to minimum (1 day) after lapse, like Anki default
  disabled_categories: null,
  show_unreviewed_insights: true, // Show AI-approved insights before human review
  proficiency_level: 'beginner', // Default proficiency level
}
