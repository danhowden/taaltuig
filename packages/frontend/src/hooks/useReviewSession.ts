import { useReducer, useCallback, useEffect, useRef } from 'react'
import type { QueueItem, Grade } from '@/types'

// =============================================================================
// Session Phases - Explicit states make transitions predictable
// =============================================================================

export type SessionPhase =
  | 'loading'    // Initial data fetch
  | 'empty'      // No cards available
  | 'reviewing'  // Actively showing a card
  | 'waiting'    // Waiting for scheduled cards
  | 'complete'   // Session finished

// =============================================================================
// State
// =============================================================================

interface ReviewSessionState {
  phase: SessionPhase

  // Card queues
  currentCard: QueueItem | null
  availableCards: QueueItem[]
  waitingCards: ScheduledCard[]

  // Session stats
  totalCards: number        // Total cards seen this session
  reviewedCount: number     // Reviews completed (including repeats)
  againCount: number        // Times "Again" was pressed
  againReviewed: number     // AGAIN cards that were re-reviewed
  againCardIds: Set<string> // Track cards that were marked Again

  // UI state
  showAnswer: boolean
  startTime: number         // When current card was shown

  // Extra cards loading
  loadingExtraCards: number | null
}

interface ScheduledCard {
  card: QueueItem
  availableAt: Date
}

// =============================================================================
// Actions - All state changes go through explicit actions
// =============================================================================

type ReviewSessionAction =
  | { type: 'INIT_QUEUE'; cards: QueueItem[] }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'MOVE_TO_NEXT'; grade: Grade }  // Optimistic - move immediately
  | { type: 'SCHEDULE_CARD'; card: QueueItem; dueDate: string; isAgain: boolean }  // After API response
  | { type: 'CARD_BECAME_AVAILABLE'; cardId: string }
  | { type: 'ADD_EXTRA_CARDS'; cards: QueueItem[] }
  | { type: 'SET_LOADING_EXTRA'; count: number | null }

// =============================================================================
// Initial State
// =============================================================================

const initialState: ReviewSessionState = {
  phase: 'loading',
  currentCard: null,
  availableCards: [],
  waitingCards: [],
  totalCards: 0,
  reviewedCount: 0,
  againCount: 0,
  againReviewed: 0,
  againCardIds: new Set(),
  showAnswer: false,
  startTime: Date.now(),
  loadingExtraCards: null,
}

// =============================================================================
// Helpers
// =============================================================================

// Exported for testing
export function computePhase(
  currentCard: QueueItem | null,
  availableCards: QueueItem[],
  waitingCards: ScheduledCard[],
  totalCards: number
): SessionPhase {
  if (currentCard) return 'reviewing'
  if (availableCards.length > 0) return 'reviewing' // Will pick up next card
  if (waitingCards.length > 0) return 'waiting'
  if (totalCards > 0) return 'complete'
  return 'empty'
}

function getNextCard(availableCards: QueueItem[]): {
  next: QueueItem | null
  remaining: QueueItem[]
} {
  if (availableCards.length === 0) {
    return { next: null, remaining: [] }
  }
  return {
    next: availableCards[0],
    remaining: availableCards.slice(1),
  }
}

// =============================================================================
// Reducer
// =============================================================================

// Exported for testing purposes
export function reviewSessionReducer(
  state: ReviewSessionState,
  action: ReviewSessionAction
): ReviewSessionState {
  switch (action.type) {
    case 'INIT_QUEUE': {
      const { next, remaining } = getNextCard(action.cards)
      const phase = computePhase(next, remaining, [], action.cards.length)

      return {
        ...state,
        phase,
        currentCard: next,
        availableCards: remaining,
        waitingCards: [],
        totalCards: action.cards.length,
        reviewedCount: 0,
        againCount: 0,
        againReviewed: 0,
        againCardIds: new Set(),
        showAnswer: false,
        startTime: Date.now(),
      }
    }

    case 'REVEAL_ANSWER': {
      return { ...state, showAnswer: true }
    }

    case 'MOVE_TO_NEXT': {
      if (!state.currentCard) return state

      const { grade } = action
      const isAgain = grade === 0
      const wasAgainCard = state.againCardIds.has(state.currentCard.review_item_id)

      // Move to next card immediately (optimistic)
      const { next, remaining } = getNextCard(state.availableCards)

      // Compute phase, but if this was an "Again" grade and there's no next card,
      // go to 'waiting' instead of 'complete' since we know the card will be scheduled
      let phase = computePhase(next, remaining, state.waitingCards, state.totalCards)
      if (isAgain && phase === 'complete') {
        phase = 'waiting'
      }

      return {
        ...state,
        phase,
        currentCard: next,
        availableCards: remaining,
        reviewedCount: state.reviewedCount + 1,
        againCount: isAgain ? state.againCount + 1 : state.againCount,
        againReviewed: wasAgainCard ? state.againReviewed + 1 : state.againReviewed,
        showAnswer: false,
        startTime: Date.now(),
      }
    }

    case 'SCHEDULE_CARD': {
      const { card, dueDate, isAgain } = action

      const scheduledCard: ScheduledCard = {
        card,
        availableAt: new Date(dueDate),
      }

      // Insert sorted by availableAt
      const newWaitingCards = [...state.waitingCards, scheduledCard].sort(
        (a, b) => a.availableAt.getTime() - b.availableAt.getTime()
      )

      // Track Again cards so we can count re-reviews
      const newAgainCardIds = isAgain
        ? new Set([...state.againCardIds, card.review_item_id])
        : state.againCardIds

      // If we're in 'complete' phase but scheduling a card, switch to 'waiting'
      // This happens when the last card was marked "Again"
      const newPhase = state.phase === 'complete' && !state.currentCard
        ? 'waiting'
        : state.phase

      return {
        ...state,
        phase: newPhase,
        waitingCards: newWaitingCards,
        againCardIds: newAgainCardIds,
      }
    }

    case 'CARD_BECAME_AVAILABLE': {
      const cardIndex = state.waitingCards.findIndex(
        wc => wc.card.review_item_id === action.cardId
      )
      if (cardIndex === -1) return state

      const readyCard = state.waitingCards[cardIndex]
      const newWaitingCards = state.waitingCards.filter(
        wc => wc.card.review_item_id !== action.cardId
      )

      // If no current card, make this the current card
      if (!state.currentCard) {
        const phase = computePhase(readyCard.card, state.availableCards, newWaitingCards, state.totalCards)
        return {
          ...state,
          phase,
          currentCard: readyCard.card,
          waitingCards: newWaitingCards,
          showAnswer: false,
          startTime: Date.now(),
        }
      }

      // Otherwise add to front of available cards
      return {
        ...state,
        availableCards: [readyCard.card, ...state.availableCards],
        waitingCards: newWaitingCards,
      }
    }

    case 'ADD_EXTRA_CARDS': {
      if (action.cards.length === 0) return state

      // If no current card, make first extra card the current card
      if (!state.currentCard) {
        const { next, remaining } = getNextCard(action.cards)
        const newAvailable = [...state.availableCards, ...remaining]
        const phase = computePhase(next, newAvailable, state.waitingCards, state.totalCards + action.cards.length)

        return {
          ...state,
          phase,
          currentCard: next,
          availableCards: newAvailable,
          totalCards: state.totalCards + action.cards.length,
          showAnswer: false,
          startTime: Date.now(),
          loadingExtraCards: null,
        }
      }

      // Otherwise append to available cards
      return {
        ...state,
        availableCards: [...state.availableCards, ...action.cards],
        totalCards: state.totalCards + action.cards.length,
        loadingExtraCards: null,
      }
    }

    case 'SET_LOADING_EXTRA': {
      return { ...state, loadingExtraCards: action.count }
    }
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useReviewSession(initialCards: QueueItem[], isDataLoaded: boolean) {
  const [state, dispatch] = useReducer(reviewSessionReducer, initialState)
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const initializedRef = useRef(false)

  // Initialize when data is available (even if empty)
  useEffect(() => {
    if (isDataLoaded && !initializedRef.current) {
      initializedRef.current = true
      dispatch({ type: 'INIT_QUEUE', cards: initialCards })
    }
  }, [initialCards, isDataLoaded])

  // Set up timers for waiting cards
  useEffect(() => {
    const timers = timersRef.current

    // Clear old timers
    timers.forEach(timer => clearTimeout(timer))
    timers.clear()

    // Set up new timers
    state.waitingCards.forEach(({ card, availableAt }) => {
      const delayMs = Math.max(0, availableAt.getTime() - Date.now())
      const timer = setTimeout(() => {
        dispatch({ type: 'CARD_BECAME_AVAILABLE', cardId: card.review_item_id })
        timers.delete(card.review_item_id)
      }, delayMs)
      timers.set(card.review_item_id, timer)
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }
  }, [state.waitingCards])

  // Actions
  const revealAnswer = useCallback(() => {
    dispatch({ type: 'REVEAL_ANSWER' })
  }, [])

  const moveToNext = useCallback((grade: Grade) => {
    dispatch({ type: 'MOVE_TO_NEXT', grade })
  }, [])

  const scheduleCard = useCallback((card: QueueItem, dueDate: string, isAgain: boolean) => {
    dispatch({ type: 'SCHEDULE_CARD', card, dueDate, isAgain })
  }, [])

  const addExtraCards = useCallback((cards: QueueItem[]) => {
    dispatch({ type: 'ADD_EXTRA_CARDS', cards })
  }, [])

  const setLoadingExtra = useCallback((count: number | null) => {
    dispatch({ type: 'SET_LOADING_EXTRA', count })
  }, [])

  // Derived state
  const nextWaitingTime = state.waitingCards.length > 0
    ? state.waitingCards[0].availableAt
    : null

  const cardsRemaining =
    (state.currentCard ? 1 : 0) +
    state.availableCards.length +
    state.waitingCards.length

  return {
    // Phase
    phase: state.phase,

    // Current card
    currentCard: state.currentCard,
    showAnswer: state.showAnswer,
    startTime: state.startTime,

    // Stats
    totalCards: state.totalCards,
    reviewedCount: state.reviewedCount,
    againCount: state.againCount,
    againReviewed: state.againReviewed,
    cardsRemaining,

    // Waiting state
    nextWaitingTime,
    waitingCount: state.waitingCards.length,

    // Loading state
    loadingExtraCards: state.loadingExtraCards,

    // Actions
    revealAnswer,
    moveToNext,
    scheduleCard,
    addExtraCards,
    setLoadingExtra,
  }
}
