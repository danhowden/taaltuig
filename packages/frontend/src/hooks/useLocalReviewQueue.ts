import { useState, useCallback, useRef, useEffect } from 'react'
import type { QueueItem } from '@/types'

interface QueuedCard {
  item: QueueItem
  availableAt: Date
}

interface LocalQueueState {
  currentCard: QueueItem | null
  availableCards: QueueItem[]
  waitingCards: QueuedCard[]
  completedCount: number
  reviewedCount: number // Total reviews done (including repeats)
  totalCards: number
  cardsRemaining: number // Cards left in session (available + waiting + current)
  isComplete: boolean
  nextWaitingTime: Date | null
  againCount: number // Total AGAIN grades given this session
  againReviewed: number // How many AGAIN cards have been re-reviewed
}

interface UseLocalReviewQueueReturn extends LocalQueueState {
  moveToNext: () => void
  scheduleCard: (card: QueueItem, dueDate: string, isAgain?: boolean) => void
  markComplete: () => void
  markAgainReviewed: () => void
  addCards: (newCards: QueueItem[]) => void
}

/**
 * Manages a local review queue with support for cards returning in the same session.
 *
 * Cards graded "AGAIN" or "HARD" in LEARNING state will be scheduled to reappear
 * after their learning interval (1 min, 10 min).
 *
 * Cards scheduled more than 24 hours out are removed from the session.
 */
export function useLocalReviewQueue(
  initialQueue: QueueItem[]
): UseLocalReviewQueueReturn {
  const [state, setState] = useState<LocalQueueState>(() => ({
    currentCard: initialQueue[0] || null,
    availableCards: initialQueue.slice(1),
    waitingCards: [],
    completedCount: 0,
    reviewedCount: 0,
    totalCards: initialQueue.length,
    cardsRemaining: initialQueue.length,
    isComplete: initialQueue.length === 0,
    nextWaitingTime: null,
    againCount: 0,
    againReviewed: 0,
  }))

  // Track active timers to clean them up
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set())

  // Track if we've initialized with real data
  const initializedRef = useRef(false)

  // Reset queue when initialQueue goes from empty to populated (data loads)
  useEffect(() => {
    if (initialQueue.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      setState({
        currentCard: initialQueue[0] || null,
        availableCards: initialQueue.slice(1),
        waitingCards: [],
        completedCount: 0,
        reviewedCount: 0,
        totalCards: initialQueue.length,
        cardsRemaining: initialQueue.length,
        isComplete: false,
        nextWaitingTime: null,
        againCount: 0,
        againReviewed: 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only trigger on length change (empty→populated)
  }, [initialQueue.length])

  // Clean up timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  /**
   * Move to the next available card
   */
  const moveToNext = useCallback(() => {
    setState((prev) => {
      const nextCard = prev.availableCards[0] || null
      const remainingAvailable = prev.availableCards.slice(1)

      // Update next waiting time
      const nextWaitingTime =
        prev.waitingCards.length > 0 ? prev.waitingCards[0].availableAt : null

      const isComplete =
        nextCard === null &&
        remainingAvailable.length === 0 &&
        prev.waitingCards.length === 0

      // Calculate cards remaining in session
      const cardsRemaining =
        (nextCard ? 1 : 0) + remainingAvailable.length + prev.waitingCards.length

      return {
        ...prev,
        currentCard: nextCard,
        availableCards: remainingAvailable,
        reviewedCount: prev.reviewedCount + 1,
        cardsRemaining,
        nextWaitingTime,
        isComplete,
      }
    })
  }, [])

  /**
   * Schedule a card to return later in the session
   * If due_date > 24 hours, the card is removed from session (graduated)
   */
  const scheduleCard = useCallback(
    (card: QueueItem, dueDate: string, isAgain = false) => {
      const availableAt = new Date(dueDate)
      const now = new Date()
      const hoursUntilDue = (availableAt.getTime() - now.getTime()) / (1000 * 60 * 60)

      // If due more than 24 hours from now, remove from session (graduated/postponed)
      if (hoursUntilDue >= 24) {
        return
      }

      // Calculate delay in milliseconds
      const delayMs = Math.max(0, availableAt.getTime() - now.getTime())

      // Add to waiting cards (keep sorted by availableAt)
      setState((prev) => {
        const newWaitingCard: QueuedCard = { item: card, availableAt }

        // Insert in sorted order (earliest first)
        const waitingCards = [...prev.waitingCards, newWaitingCard].sort(
          (a, b) => a.availableAt.getTime() - b.availableAt.getTime()
        )

        const nextWaitingTime = waitingCards[0]?.availableAt || null

        // If no current card and no available cards, immediately show waiting state
        const needsUpdate = prev.currentCard === null && prev.availableCards.length === 0

        // Calculate cards remaining
        const cardsRemaining =
          (prev.currentCard ? 1 : 0) + prev.availableCards.length + waitingCards.length

        return {
          ...prev,
          waitingCards,
          cardsRemaining,
          nextWaitingTime,
          isComplete: false, // Can't be complete if we have waiting cards
          againCount: isAgain ? prev.againCount + 1 : prev.againCount, // Only increment if graded as AGAIN
          ...(needsUpdate && { currentCard: null }), // Force re-render to show waiting UI
        }
      })

      // Set timer to make card available
      const timer = setTimeout(() => {
        setState((prev) => {
          // Find the card in waiting list
          const cardIndex = prev.waitingCards.findIndex(
            (wc) => wc.item.review_item_id === card.review_item_id
          )

          if (cardIndex === -1) {
            return prev // Card not found (shouldn't happen)
          }

          const waitingCards = [...prev.waitingCards]
          const [readyCard] = waitingCards.splice(cardIndex, 1)

          // If no current card, make this the current card
          // Otherwise, insert at front of available cards (Anki-style: show due cards immediately)
          const shouldBecomeCurrent = prev.currentCard === null

          const nextWaitingTime = waitingCards[0]?.availableAt || null

          if (shouldBecomeCurrent) {
            const cardsRemaining = 1 + prev.availableCards.length + waitingCards.length
            return {
              ...prev,
              currentCard: readyCard.item,
              waitingCards,
              cardsRemaining,
              nextWaitingTime,
            }
          } else {
            // Insert at the FRONT of available cards (Anki-style)
            const availableCards = [readyCard.item, ...prev.availableCards]
            const cardsRemaining =
              (prev.currentCard ? 1 : 0) + availableCards.length + waitingCards.length
            return {
              ...prev,
              availableCards,
              waitingCards,
              cardsRemaining,
              nextWaitingTime,
            }
          }
        })

        timersRef.current.delete(timer)
      }, delayMs)

      timersRef.current.add(timer)
    },
    []
  )

  /**
   * Mark current card as complete (user graded it, card won't return)
   */
  const markComplete = useCallback(() => {
    setState((prev) => ({
      ...prev,
      completedCount: prev.completedCount + 1,
    }))
  }, [])

  /**
   * Mark that an AGAIN card was reviewed
   */
  const markAgainReviewed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      againReviewed: prev.againReviewed + 1,
    }))
  }, [])

  /**
   * Add new cards to the queue (for "continue with extra cards" feature)
   */
  const addCards = useCallback((newCards: QueueItem[]) => {
    setState((prev) => {
      if (newCards.length === 0) return prev

      // If no current card (either complete or waiting for AGAIN cards),
      // make the first new card the current card
      if (!prev.currentCard) {
        const newCurrent = newCards[0]
        const newAvailable = [...prev.availableCards, ...newCards.slice(1)]
        const newTotal = prev.totalCards + newCards.length
        const cardsRemaining = 1 + newAvailable.length + prev.waitingCards.length

        return {
          ...prev,
          currentCard: newCurrent,
          availableCards: newAvailable,
          totalCards: newTotal,
          cardsRemaining,
          isComplete: false,
        }
      }

      // Otherwise, append to available cards
      const newAvailable = [...prev.availableCards, ...newCards]
      const newTotal = prev.totalCards + newCards.length
      const cardsRemaining = 1 + newAvailable.length + prev.waitingCards.length

      return {
        ...prev,
        availableCards: newAvailable,
        totalCards: newTotal,
        cardsRemaining,
      }
    })
  }, [])

  return {
    ...state,
    moveToNext,
    scheduleCard,
    markComplete,
    markAgainReviewed,
    addCards,
  }
}
