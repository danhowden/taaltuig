import type { Card } from './index'

/**
 * Form data for creating a new card
 */
export interface NewCardForm {
  front: string
  back: string
  explanation: string
  tags: string[]
}

/**
 * Cards grouped by category name
 */
export interface CategorizedCards {
  [category: string]: Card[]
}

/**
 * UI state for a single category
 */
export interface CategoryState {
  isCollapsed: boolean
  isActive: boolean
}
