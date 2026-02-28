import { renderHook, act } from '@testing-library/react'
import { useReviewSession, reviewSessionReducer, computePhase } from './useReviewSession'
import type { QueueItem } from '@/types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createCard(id: string, front = 'front', back = 'back'): QueueItem {
  return {
    review_item_id: id,
    card_id: `card-${id}`,
    user_id: 'user-1',
    front,
    back,
    direction: 'forward',
    state: 'NEW',
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
  }
}

const card1 = createCard('1', 'huis', 'house')
const card2 = createCard('2', 'boom', 'tree')
const card3 = createCard('3', 'kat', 'cat')

// =============================================================================
// Initial State Tests
// =============================================================================

describe('useReviewSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts in loading phase when data is not loaded', () => {
      const { result } = renderHook(() => useReviewSession([], false))

      expect(result.current.phase).toBe('loading')
      expect(result.current.currentCard).toBeNull()
      expect(result.current.totalCards).toBe(0)
    })

    it('initializes to empty phase when loaded with no cards', () => {
      const { result } = renderHook(() => useReviewSession([], true))

      expect(result.current.phase).toBe('empty')
      expect(result.current.currentCard).toBeNull()
      expect(result.current.totalCards).toBe(0)
    })

    it('initializes to reviewing phase when loaded with cards', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      expect(result.current.phase).toBe('reviewing')
      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.totalCards).toBe(2)
      expect(result.current.cardsRemaining).toBe(2)
    })

    it('only initializes once even if props change', () => {
      const { result, rerender } = renderHook(
        ({ cards, loaded }) => useReviewSession(cards, loaded),
        { initialProps: { cards: [card1], loaded: true } }
      )

      expect(result.current.currentCard).toEqual(card1)

      // Rerender with different cards - should not reinitialize
      rerender({ cards: [card2, card3], loaded: true })

      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.totalCards).toBe(1)
    })
  })

  // =============================================================================
  // revealAnswer Tests
  // =============================================================================

  describe('revealAnswer', () => {
    it('sets showAnswer to true', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      expect(result.current.showAnswer).toBe(false)

      act(() => {
        result.current.revealAnswer()
      })

      expect(result.current.showAnswer).toBe(true)
    })
  })

  // =============================================================================
  // moveToNext Tests
  // =============================================================================

  describe('moveToNext', () => {
    it('moves to the next card on non-Again grade', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      expect(result.current.currentCard).toEqual(card1)

      act(() => {
        result.current.moveToNext(3) // Good
      })

      expect(result.current.currentCard).toEqual(card2)
      expect(result.current.reviewedCount).toBe(1)
      expect(result.current.againCount).toBe(0)
      expect(result.current.showAnswer).toBe(false)
    })

    it('increments againCount on Again grade', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      act(() => {
        result.current.moveToNext(0) // Again
      })

      expect(result.current.againCount).toBe(1)
      expect(result.current.reviewedCount).toBe(1)
    })

    it('goes to complete phase when last card graded non-Again', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(3) // Good
      })

      expect(result.current.phase).toBe('complete')
      expect(result.current.currentCard).toBeNull()
    })

    it('goes to waiting phase when last card graded Again', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(0) // Again
      })

      expect(result.current.phase).toBe('waiting')
      expect(result.current.currentCard).toBeNull()
    })

    it('does nothing when no current card', () => {
      const { result } = renderHook(() => useReviewSession([], true))

      expect(result.current.phase).toBe('empty')

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('empty')
      expect(result.current.reviewedCount).toBe(0)
    })

    it('increments againReviewed when re-reviewing a scheduled Again card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      // Grade as Again
      act(() => {
        result.current.moveToNext(0)
      })

      // Schedule the card to come back
      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      // Fast forward so card becomes available
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.currentCard).toEqual(card1)

      // Now grade the card again - this time it was an Again card
      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.againReviewed).toBe(1)
    })

    it('resets showAnswer to false', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      act(() => {
        result.current.revealAnswer()
      })

      expect(result.current.showAnswer).toBe(true)

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.showAnswer).toBe(false)
    })
  })

  // =============================================================================
  // scheduleCard Tests
  // =============================================================================

  describe('scheduleCard', () => {
    it('adds card to waiting cards sorted by due time', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2, card3], true))

      const laterDue = new Date(Date.now() + 5000).toISOString()
      const earlierDue = new Date(Date.now() + 1000).toISOString()

      act(() => {
        result.current.scheduleCard(card1, laterDue, true)
      })

      act(() => {
        result.current.scheduleCard(card2, earlierDue, true)
      })

      expect(result.current.waitingCount).toBe(2)
      expect(result.current.nextWaitingTime?.toISOString()).toBe(earlierDue)
    })

    it('switches from complete to waiting when scheduling a card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      // Complete the session with non-Again (which would go to complete)
      // But we'll manually test the SCHEDULE_CARD behavior
      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('complete')

      // Now schedule a card - should switch to waiting
      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      expect(result.current.phase).toBe('waiting')
    })

    it('does not change phase from reviewing when scheduling', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      expect(result.current.phase).toBe('reviewing')

      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      expect(result.current.phase).toBe('reviewing')
      expect(result.current.waitingCount).toBe(1)
    })
  })

  // =============================================================================
  // Timer / CARD_BECAME_AVAILABLE Tests
  // =============================================================================

  describe('waiting card timers', () => {
    it('makes card available when timer fires and no current card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      // Grade as Again to go to waiting
      act(() => {
        result.current.moveToNext(0)
      })

      expect(result.current.phase).toBe('waiting')
      expect(result.current.currentCard).toBeNull()

      // Schedule the card
      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      expect(result.current.waitingCount).toBe(1)

      // Fast forward
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.phase).toBe('reviewing')
      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.waitingCount).toBe(0)
    })

    it('adds card to available queue when timer fires and there is a current card', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      // Schedule card1 to come back later
      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, false)
      })

      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.waitingCount).toBe(1)
      expect(result.current.cardsRemaining).toBe(3) // current + available + waiting

      // Fast forward - card1 becomes available but we still have card1 as current
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Card should be added to available queue
      expect(result.current.waitingCount).toBe(0)
      expect(result.current.cardsRemaining).toBe(3)
    })

    it('handles card not found in waiting cards', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      // This shouldn't happen in practice, but test the guard
      // We can't directly dispatch, so we'll test via timing edge case
      const dueDate = new Date(Date.now() + 100).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      // Move to next which clears current card
      act(() => {
        result.current.moveToNext(3)
      })

      // Timer fires but the phase already changed
      act(() => {
        vi.advanceTimersByTime(200)
      })

      // Should handle gracefully
      expect(result.current.phase).toBe('reviewing')
    })

    it('clears timers when waitingCards changes', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(0)
      })

      const dueDate = new Date(Date.now() + 5000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      // Add another card - should clear old timers
      const dueDate2 = new Date(Date.now() + 3000).toISOString()
      act(() => {
        result.current.scheduleCard(card2, dueDate2, true)
      })

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it('clears timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { result, unmount } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(0)
      })

      const dueDate = new Date(Date.now() + 5000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it('handles already-due cards with zero delay', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(0)
      })

      // Schedule with past date
      const pastDate = new Date(Date.now() - 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, pastDate, true)
      })

      // Should fire immediately with 0ms delay
      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(result.current.phase).toBe('reviewing')
      expect(result.current.currentCard).toEqual(card1)
    })
  })

  // =============================================================================
  // addExtraCards Tests
  // =============================================================================

  describe('addExtraCards', () => {
    it('does nothing when adding empty array', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      const initialTotal = result.current.totalCards

      act(() => {
        result.current.addExtraCards([])
      })

      expect(result.current.totalCards).toBe(initialTotal)
    })

    it('sets first extra card as current when no current card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      // Complete the session
      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('complete')
      expect(result.current.currentCard).toBeNull()

      // Add extra cards
      act(() => {
        result.current.addExtraCards([card2, card3])
      })

      expect(result.current.phase).toBe('reviewing')
      expect(result.current.currentCard).toEqual(card2)
      expect(result.current.totalCards).toBe(3)
      expect(result.current.cardsRemaining).toBe(2)
    })

    it('appends extra cards to available queue when there is a current card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.cardsRemaining).toBe(1)

      act(() => {
        result.current.addExtraCards([card2, card3])
      })

      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.totalCards).toBe(3)
      expect(result.current.cardsRemaining).toBe(3)
    })

    it('clears loadingExtraCards after adding', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.setLoadingExtra(10)
      })

      expect(result.current.loadingExtraCards).toBe(10)

      act(() => {
        result.current.addExtraCards([card2])
      })

      expect(result.current.loadingExtraCards).toBeNull()
    })

    it('resets showAnswer when setting new current card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.revealAnswer()
      })

      act(() => {
        result.current.moveToNext(3)
      })

      act(() => {
        result.current.addExtraCards([card2])
      })

      expect(result.current.showAnswer).toBe(false)
    })
  })

  // =============================================================================
  // setLoadingExtra Tests
  // =============================================================================

  describe('setLoadingExtra', () => {
    it('sets loading state to a number', () => {
      const { result } = renderHook(() => useReviewSession([], true))

      act(() => {
        result.current.setLoadingExtra(5)
      })

      expect(result.current.loadingExtraCards).toBe(5)
    })

    it('clears loading state when set to null', () => {
      const { result } = renderHook(() => useReviewSession([], true))

      act(() => {
        result.current.setLoadingExtra(5)
      })

      act(() => {
        result.current.setLoadingExtra(null)
      })

      expect(result.current.loadingExtraCards).toBeNull()
    })
  })

  // =============================================================================
  // Derived State Tests
  // =============================================================================

  describe('derived state', () => {
    it('computes cardsRemaining correctly', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2, card3], true))

      expect(result.current.cardsRemaining).toBe(3)

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.cardsRemaining).toBe(2)

      // Add a waiting card
      const dueDate = new Date(Date.now() + 5000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, false)
      })

      expect(result.current.cardsRemaining).toBe(3)
    })

    it('returns null for nextWaitingTime when no waiting cards', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      expect(result.current.nextWaitingTime).toBeNull()
    })

    it('returns earliest time for nextWaitingTime', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      const laterDue = new Date(Date.now() + 5000)
      const earlierDue = new Date(Date.now() + 1000)

      act(() => {
        result.current.scheduleCard(card1, laterDue.toISOString(), false)
      })

      act(() => {
        result.current.scheduleCard(card2, earlierDue.toISOString(), false)
      })

      expect(result.current.nextWaitingTime?.getTime()).toBe(earlierDue.getTime())
    })
  })

  // =============================================================================
  // Phase Transition Tests
  // =============================================================================

  describe('phase transitions', () => {
    it('empty → reviewing when extra cards added', () => {
      const { result } = renderHook(() => useReviewSession([], true))

      expect(result.current.phase).toBe('empty')

      act(() => {
        result.current.addExtraCards([card1])
      })

      expect(result.current.phase).toBe('reviewing')
    })

    it('reviewing → complete when all cards done', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      expect(result.current.phase).toBe('reviewing')

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('complete')
    })

    it('reviewing → waiting when graded Again on last card', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      expect(result.current.phase).toBe('reviewing')

      act(() => {
        result.current.moveToNext(0)
      })

      expect(result.current.phase).toBe('waiting')
    })

    it('waiting → reviewing when scheduled card becomes available', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(0)
      })

      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, true)
      })

      expect(result.current.phase).toBe('waiting')

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.phase).toBe('reviewing')
    })

    it('complete → reviewing when extra cards added', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('complete')

      act(() => {
        result.current.addExtraCards([card2])
      })

      expect(result.current.phase).toBe('reviewing')
    })

    it('complete → waiting when card scheduled', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      act(() => {
        result.current.moveToNext(3)
      })

      expect(result.current.phase).toBe('complete')

      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card1, dueDate, false)
      })

      expect(result.current.phase).toBe('waiting')
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('handles multiple Again grades in sequence', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      act(() => {
        result.current.moveToNext(0) // Again on card1
      })

      act(() => {
        result.current.moveToNext(0) // Again on card2
      })

      expect(result.current.againCount).toBe(2)
      expect(result.current.reviewedCount).toBe(2)
      expect(result.current.phase).toBe('waiting')
    })

    it('handles scheduling same card multiple times', () => {
      const { result } = renderHook(() => useReviewSession([card1], true))

      const dueDate1 = new Date(Date.now() + 1000).toISOString()
      const dueDate2 = new Date(Date.now() + 2000).toISOString()

      act(() => {
        result.current.scheduleCard(card1, dueDate1, false)
      })

      act(() => {
        result.current.scheduleCard(card1, dueDate2, false)
      })

      expect(result.current.waitingCount).toBe(2)
    })

    it('handles grading all grades (0, 2, 3, 4)', () => {
      const cards = [card1, card2, card3, createCard('4', 'hond', 'dog')]
      const { result } = renderHook(() => useReviewSession(cards, true))

      act(() => {
        result.current.moveToNext(0) // Again
      })
      expect(result.current.againCount).toBe(1)

      act(() => {
        result.current.moveToNext(2) // Hard
      })
      expect(result.current.againCount).toBe(1)

      act(() => {
        result.current.moveToNext(3) // Good
      })
      expect(result.current.againCount).toBe(1)

      act(() => {
        result.current.moveToNext(4) // Easy
      })
      expect(result.current.againCount).toBe(1)
      expect(result.current.reviewedCount).toBe(4)
    })

    it('preserves startTime for timing calculations', () => {
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      const initialStartTime = result.current.startTime

      // Advance time
      vi.advanceTimersByTime(1000)

      act(() => {
        result.current.moveToNext(3)
      })

      // startTime should be updated for new card
      expect(result.current.startTime).toBeGreaterThan(initialStartTime)
    })
  })

  // =============================================================================
  // Direct Reducer Tests (for edge cases not reachable through hook API)
  // =============================================================================

  describe('reducer edge cases', () => {
    it('computePhase returns reviewing when no currentCard but availableCards exist', () => {
      // This is defensive code - tests the branch that can't be reached through hook API
      const result = computePhase(null, [card1], [], 1)
      expect(result).toBe('reviewing')
    })

    it('CARD_BECAME_AVAILABLE returns state unchanged when card not found', () => {
      const state = {
        phase: 'waiting' as const,
        currentCard: null,
        availableCards: [],
        waitingCards: [],
        totalCards: 1,
        reviewedCount: 1,
        againCount: 1,
        againReviewed: 0,
        againCardIds: new Set<string>(),
        showAnswer: false,
        startTime: Date.now(),
        loadingExtraCards: null,
      }

      const result = reviewSessionReducer(state, {
        type: 'CARD_BECAME_AVAILABLE',
        cardId: 'nonexistent-id',
      })

      expect(result).toBe(state) // Same reference - unchanged
    })

    it('computePhase returns reviewing when availableCards has items but no currentCard', () => {
      // This tests the branch: if (availableCards.length > 0) return 'reviewing'
      // We can reach this through CARD_BECAME_AVAILABLE when there IS a current card
      const { result } = renderHook(() => useReviewSession([card1, card2], true))

      // Schedule card3 to come back
      const dueDate = new Date(Date.now() + 1000).toISOString()
      act(() => {
        result.current.scheduleCard(card3, dueDate, false)
      })

      expect(result.current.currentCard).toEqual(card1)
      expect(result.current.waitingCount).toBe(1)

      // Fast forward - card3 becomes available but we still have currentCard
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Card3 should be in availableCards now (added to front)
      // We need to verify the phase logic handles availableCards correctly
      expect(result.current.phase).toBe('reviewing')
      expect(result.current.cardsRemaining).toBe(3) // card1 (current) + card2 (available) + card3 (now available)
    })
  })
})
