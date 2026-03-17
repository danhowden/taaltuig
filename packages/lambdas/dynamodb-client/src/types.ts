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
  // Writing exercise settings
  writing_exercises_per_day: number // Max writing exercises per session (default: 10)
  writing_session_enabled: boolean // Whether writing practice appears after flashcard review (default: true)
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

// Writing exercise types
export type ExerciseType = 'translation' | 'fill_blank' | 'word_reorder' | 'guided_write' | 'paragraph_write'
export type ExerciseStatus = 'pending' | 'failed' | 'completed' | 'rejected'
export type ExerciseSource = 'auto' | 'user_requested'
export type ExercisePriority = 'normal' | 'high'
export type AssessmentMatchType = 'exact' | 'alternative' | 'fuzzy' | 'wrong'

// Stored exercise entity in DynamoDB
export interface WritingExercise {
  PK: string // USER#<user_id>
  SK: string // EXERCISE#<exercise_id>
  GSI2PK: string // USER#<user_id>#WRITING_POOL
  GSI2SK: string // <status>#<generated_at>
  exercise_id: string
  type: ExerciseType
  status: ExerciseStatus
  source: ExerciseSource
  priority: ExercisePriority
  prompt: string // What the user sees (e.g., English sentence to translate)
  reference_answer: string // Correct Dutch answer
  alternatives: string[] // Other valid answers
  target_vocabulary: string[] // card_ids used as generation input
  grammar_focus?: string // e.g., "past tense", "word order"
  cefr_level?: string
  generated_at: string
  completed_at?: string
  rejected_at?: string
  rejection_reason?: string
  retry_after?: string  // ISO timestamp — don't serve before this time (set on failed attempt)
  attempt_count?: number // how many times this exercise has been attempted
}

// Denormalized link for "show exercises for this card" queries
export interface CardExerciseLink {
  PK: string // USER#<user_id>
  SK: string // CARD_EXERCISE#<card_id>#<exercise_id>
  exercise_id: string
  exercise_type: ExerciseType
  exercise_status: ExerciseStatus
  prompt: string // denormalized for display without join
  generated_at: string
}

export interface WritingAttempt {
  PK: string // USER#<user_id>
  SK: string // ATTEMPT#<timestamp>#<exercise_id>
  GSI2PK: string // USER#<user_id>#WRITING#<YYYY-MM-DD>
  GSI2SK: string // <timestamp>
  user_id: string
  exercise_id: string
  exercise_type: ExerciseType
  user_answer: string
  score: Grade
  feedback: string
  match_type: AssessmentMatchType
  confidence: number // 1.0 for deterministic
  assessment_mode_used: 'deterministic' | 'ai_fallback' | 'ai'
  duration_ms: number
  flagged: boolean
  flagged_reason?: string
  created_at: string
}

export interface AssessmentResult {
  correct: boolean
  grade: Grade
  feedback: string
  match_type: AssessmentMatchType
  reference_answer: string
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
  writing_exercises_per_day: 10,
  writing_session_enabled: true,
}
