/**
 * Review System Constants
 */

// iOS detection regex
export const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

// FlashCard styling
export const CARD_SHADOW = '0 10px 40px rgba(0, 0, 0, 0.15)'

// Grade button configurations
export const GRADE_CONFIG = {
  AGAIN: {
    value: 0 as const,
    label: 'Again',
    color: 'bg-red-500 hover:bg-red-600',
    shortcut: '1',
  },
  HARD: {
    value: 2 as const,
    label: 'Hard',
    color: 'bg-orange-500 hover:bg-orange-600',
    shortcut: '2',
  },
  GOOD: {
    value: 3 as const,
    label: 'Good',
    color: 'bg-green-500 hover:bg-green-600',
    shortcut: '3',
  },
  EASY: {
    value: 4 as const,
    label: 'Easy',
    color: 'bg-blue-500 hover:bg-blue-600',
    shortcut: '4',
  },
} as const
