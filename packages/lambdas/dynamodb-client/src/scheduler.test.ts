import { describe, it, expect } from 'vitest'
import { SM2Scheduler } from './scheduler'
import type { ReviewItem, UserSettings } from './types'

describe('SM2Scheduler', () => {
  const scheduler = new SM2Scheduler()
  const now = new Date('2024-01-15T12:00:00Z')

  const defaultSettings: UserSettings = {
    user_id: 'test-user',
    daily_new_cards: 20,
    learning_steps: [1, 10],
    graduating_interval: 1,
    easy_interval: 4,
    starting_ease: 2.5,
    easy_bonus: 1.3,
    interval_modifier: 1.0,
    maximum_interval: 36500,
    relearning_steps: [10],
    lapse_new_interval: 0, // 0% = reset to 1 day after lapse (Anki default)
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  describe('NEW/LEARNING state', () => {
    const newItem: ReviewItem = {
      review_item_id: 'ri1',
      card_id: 'c1',
      user_id: 'test-user',
      direction: 'forward',
      state: 'NEW',
      interval: 0,
      ease_factor: 2.5,
      repetitions: 0,
      step_index: 0,
      due_date: now.toISOString(),
      last_reviewed: null,
      created_at: now.toISOString(),
      front: 'test',
      back: 'test',
      explanation: null,
    }

    it('should reset to first step on Again (0)', () => {
      const result = scheduler.schedule(newItem, 0, defaultSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(0)
      expect(result.interval).toBe(1 / 1440) // 1 minute in days
      expect(result.ease_factor).toBe(2.5)
      expect(result.repetitions).toBe(0)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 1 * 60 * 1000)
      )
    })

    it('should use average of Again and Good on Hard (2) at first step', () => {
      // Anki behavior: First step Hard = average of Again (1m) and Good (10m) = 5.5m
      const result = scheduler.schedule(newItem, 2, defaultSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(0)
      // Average of 1 minute and 10 minutes = 5.5 minutes, rounded to 6 minutes
      expect(result.interval).toBe(6 / 1440)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 6 * 60 * 1000)
      )
    })

    it('should go back one step on Hard (2) at later steps', () => {
      // Anki behavior: Later steps Hard = previous step interval
      const learningItem = { ...newItem, state: 'LEARNING' as const, step_index: 1 }
      const result = scheduler.schedule(learningItem, 2, defaultSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(0)
      expect(result.interval).toBe(1 / 1440) // Previous step = 1 minute
    })

    it('should handle Hard (2) with single learning step', () => {
      // Edge case: Only 1 learning step, so Good would graduate
      // HARD should average (10m, 10m) since learningSteps[1] doesn't exist
      const singleStepSettings = { ...defaultSettings, learning_steps: [10] }
      const result = scheduler.schedule(newItem, 2, singleStepSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(0)
      // Average of 10 minutes and 10 minutes (fallback) = 10 minutes
      expect(result.interval).toBe(10 / 1440)
    })

    it('should advance to next step on Good (3)', () => {
      const result = scheduler.schedule(newItem, 3, defaultSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(1)
      expect(result.interval).toBe(10 / 1440) // 10 minutes
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 10 * 60 * 1000)
      )
    })

    it('should graduate on Good (3) at last step', () => {
      const learningItem = { ...newItem, state: 'LEARNING' as const, step_index: 1 }
      const result = scheduler.schedule(learningItem, 3, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(1) // graduating_interval
      expect(result.ease_factor).toBe(2.5)
      expect(result.repetitions).toBe(1)
      expect(result.step_index).toBe(0)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      )
    })

    it('should graduate immediately on Easy (4)', () => {
      const result = scheduler.schedule(newItem, 4, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(4) // easy_interval
      expect(result.ease_factor).toBe(2.5)
      expect(result.repetitions).toBe(1)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)
      )
    })
  })

  describe('REVIEW state', () => {
    const reviewItem: ReviewItem = {
      review_item_id: 'ri1',
      card_id: 'c1',
      user_id: 'test-user',
      direction: 'forward',
      state: 'REVIEW',
      interval: 10,
      ease_factor: 2.5,
      repetitions: 3,
      step_index: 0,
      due_date: now.toISOString(),
      last_reviewed: null,
      created_at: now.toISOString(),
      front: 'test',
      back: 'test',
      explanation: null,
    }

    it('should move to relearning on Again (0)', () => {
      const result = scheduler.schedule(reviewItem, 0, defaultSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.ease_factor).toBe(2.3) // 2.5 - 0.2
      expect(result.interval).toBe(10 / 1440) // relearning_steps[0]
      expect(result.repetitions).toBe(0)
      expect(result.step_index).toBe(0)
    })

    it('should decrease ease factor and apply 1.2x on Hard (2)', () => {
      const result = scheduler.schedule(reviewItem, 2, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.ease_factor).toBe(2.35) // 2.5 - 0.15
      expect(result.interval).toBe(10 * 1.2) // 12 days
      expect(result.repetitions).toBe(0)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000)
      )
    })

    it('should apply SM-2 algorithm on Good (3)', () => {
      const result = scheduler.schedule(reviewItem, 3, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.ease_factor).toBe(2.5) // unchanged
      expect(result.interval).toBe(10 * 2.5) // interval * ease_factor
      expect(result.repetitions).toBe(4)
    })

    it('should use continuous EF multiplication for first Good (3) review', () => {
      // After graduating with interval=1, first review: 1 * 2.5 = 2.5 days
      const firstReview = { ...reviewItem, interval: 1, repetitions: 0 }
      const result = scheduler.schedule(firstReview, 3, defaultSettings, now)

      expect(result.interval).toBe(2.5) // 1 * 2.5 (Anki-style)
      expect(result.repetitions).toBe(1)
    })

    it('should use continuous EF multiplication for second Good (3) review', () => {
      // After first review with interval=2.5, second: 2.5 * 2.5 = 6.25 days
      const secondReview = { ...reviewItem, interval: 2.5, repetitions: 1 }
      const result = scheduler.schedule(secondReview, 3, defaultSettings, now)

      expect(result.interval).toBe(6.25) // 2.5 * 2.5 (Anki-style)
      expect(result.repetitions).toBe(2)
    })

    it('should increase ease factor and apply easy bonus on Easy (4)', () => {
      const result = scheduler.schedule(reviewItem, 4, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.ease_factor).toBe(2.65) // 2.5 + 0.15
      expect(result.interval).toBe(10 * 2.5 * 1.3) // interval * ease * easy_bonus
      expect(result.repetitions).toBe(4)
    })

    it('should respect ease factor minimum of 1.3', () => {
      const lowEaseItem = { ...reviewItem, ease_factor: 1.4 }
      const result = scheduler.schedule(lowEaseItem, 0, defaultSettings, now)

      expect(result.ease_factor).toBe(1.3) // max(1.3, 1.4 - 0.2)
    })

    it('should apply interval modifier', () => {
      const modifiedSettings = { ...defaultSettings, interval_modifier: 0.8 }
      const result = scheduler.schedule(reviewItem, 3, modifiedSettings, now)

      expect(result.interval).toBe(10 * 2.5 * 0.8) // 20
    })
  })

  describe('RELEARNING state', () => {
    const relearnItem: ReviewItem = {
      review_item_id: 'ri1',
      card_id: 'c1',
      user_id: 'test-user',
      direction: 'forward',
      state: 'RELEARNING',
      interval: 15, // Previous interval before failing
      ease_factor: 2.3,
      repetitions: 0,
      step_index: 0,
      due_date: now.toISOString(),
      last_reviewed: null,
      created_at: now.toISOString(),
      front: 'test',
      back: 'test',
      explanation: null,
    }

    it('should reset to first relearning step on Again (0)', () => {
      const result = scheduler.schedule(relearnItem, 0, defaultSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.step_index).toBe(0)
      expect(result.interval).toBe(10 / 1440)
      expect(result.ease_factor).toBe(2.3)
    })

    it('should go back one step on Hard (2)', () => {
      const multiStepSettings = {
        ...defaultSettings,
        relearning_steps: [1, 10, 30],
      }
      const atStep2 = { ...relearnItem, step_index: 2 }
      const result = scheduler.schedule(atStep2, 2, multiStepSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.step_index).toBe(1)
    })

    it('should return to REVIEW with minimum interval (lapse_new_interval=0) on Good (3) at last step', () => {
      // With lapse_new_interval=0 (Anki default), interval resets to 1 day
      const result = scheduler.schedule(relearnItem, 3, defaultSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(1) // reset to minimum (lapse_new_interval=0%)
      expect(result.ease_factor).toBe(2.3)
      expect(result.repetitions).toBe(0)
      expect(new Date(result.due_date)).toEqual(
        new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      )
    })

    it('should return to REVIEW with partial interval when lapse_new_interval > 0', () => {
      // With lapse_new_interval=20, interval = 15 * 0.2 = 3 days
      const settingsWithLapse = { ...defaultSettings, lapse_new_interval: 20 }
      const result = scheduler.schedule(relearnItem, 3, settingsWithLapse, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(3) // 15 * 0.2 = 3
      expect(result.ease_factor).toBe(2.3)
    })

    it('should return to REVIEW with full interval when lapse_new_interval=100', () => {
      // With lapse_new_interval=100, interval = 15 * 1.0 = 15 days (original behavior)
      const settingsWithFullLapse = { ...defaultSettings, lapse_new_interval: 100 }
      const result = scheduler.schedule(relearnItem, 3, settingsWithFullLapse, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(15) // 15 * 1.0 = 15
      expect(result.ease_factor).toBe(2.3)
    })

    it('should advance to next relearning step on Good (3)', () => {
      const multiStepSettings = {
        ...defaultSettings,
        relearning_steps: [1, 10],
      }
      const result = scheduler.schedule(relearnItem, 3, multiStepSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.step_index).toBe(1)
      expect(result.interval).toBe(10 / 1440)
    })

    it('should return to REVIEW immediately on Easy (4) with lapse_new_interval applied', () => {
      const multiStepSettings = {
        ...defaultSettings,
        relearning_steps: [1, 10, 30],
        lapse_new_interval: 0, // Default: reset to 1 day
      }
      const atStep1 = { ...relearnItem, step_index: 1 }
      const result = scheduler.schedule(atStep1, 4, multiStepSettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(1) // Reset to minimum due to lapse_new_interval=0
    })

    it('should calculate HARD interval correctly with single relearning step', () => {
      // Edge case: Only 1 relearning step, so Good would graduate
      // HARD should average (10m, previousInterval=15 days)
      const singleStepSettings = {
        ...defaultSettings,
        relearning_steps: [10],
      }
      const result = scheduler.schedule(relearnItem, 2, singleStepSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.step_index).toBe(0)
      // Average of 10 minutes and (15 days * 24 * 60) = (10 + 21600) / 2 = 10805 minutes
      expect(result.interval).toBe(10805 / 1440)
    })

    it('should calculate HARD interval correctly with multiple relearning steps', () => {
      // When there are 2+ relearning steps, HARD at step 0 should average the two steps
      const multiStepSettings = {
        ...defaultSettings,
        relearning_steps: [5, 30],
      }
      const result = scheduler.schedule(relearnItem, 2, multiStepSettings, now)

      expect(result.state).toBe('RELEARNING')
      expect(result.step_index).toBe(0)
      // Average of 5 minutes and 30 minutes = 17.5 minutes, rounded to 18
      expect(result.interval).toBe(18 / 1440)
    })
  })

  describe('Edge cases', () => {
    it('should handle single learning step', () => {
      const singleStepSettings = { ...defaultSettings, learning_steps: [10] }
      const newItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'NEW',
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      const result = scheduler.schedule(newItem, 3, singleStepSettings, now)

      expect(result.state).toBe('REVIEW') // Should graduate immediately
      expect(result.interval).toBe(1)
    })

    it('should handle long learning steps array', () => {
      const longStepsSettings = {
        ...defaultSettings,
        learning_steps: [1, 10, 30, 60, 120],
      }
      const newItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'LEARNING',
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 2,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      const result = scheduler.schedule(newItem, 3, longStepsSettings, now)

      expect(result.state).toBe('LEARNING')
      expect(result.step_index).toBe(3)
      expect(result.interval).toBe(60 / 1440)
    })

    it('should apply easy bonus on Easy (4) even on first REVIEW', () => {
      const reviewItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 1, // Just graduated with interval=1
        ease_factor: 2.5,
        repetitions: 0, // First review
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      const result = scheduler.schedule(reviewItem, 4, defaultSettings, now)

      // Anki-style: 1 * 2.5 * 1.3 = 3.25 (continuous EF * easy_bonus)
      expect(result.interval).toBe(3.25)
      expect(result.repetitions).toBe(1)
      expect(result.ease_factor).toBe(2.65) // 2.5 + 0.15
    })

    it('should handle empty learning_steps array', () => {
      const emptySettings = { ...defaultSettings, learning_steps: [] }
      const newItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'NEW',
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // Should graduate immediately since there are no learning steps
      const result = scheduler.schedule(newItem, 3, emptySettings, now)

      expect(result.state).toBe('REVIEW')
      expect(result.interval).toBe(1) // graduating_interval
    })

    it('should handle interval_modifier of 0', () => {
      const zeroModSettings = { ...defaultSettings, interval_modifier: 0 }
      const reviewItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 10,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      const result = scheduler.schedule(reviewItem, 3, zeroModSettings, now)

      expect(result.interval).toBe(0) // 10 * 2.5 * 0 = 0
    })

    it('should cap interval at maximum_interval', () => {
      const maxSettings = { ...defaultSettings, maximum_interval: 365 }
      const longIntervalItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 300, // 300 days
        ease_factor: 2.5,
        repetitions: 10,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // 300 * 2.5 = 750 days, should be capped at 365
      const result = scheduler.schedule(longIntervalItem, 3, maxSettings, now)

      expect(result.interval).toBe(365)
    })

    it('should handle fractional day intervals correctly', () => {
      const reviewItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 10,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // Easy with easy_bonus: 10 * 2.5 * 1.3 = 32.5 days
      const result = scheduler.schedule(reviewItem, 4, defaultSettings, now)

      expect(result.interval).toBe(32.5)

      // Verify due_date is exactly 32.5 days from now
      const expectedDueDate = new Date(
        now.getTime() + 32.5 * 24 * 60 * 60 * 1000
      )
      expect(new Date(result.due_date)).toEqual(expectedDueDate)
    })

    it('should calculate exact due_date for NEW state transitions', () => {
      const newItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'NEW',
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // Again: 1 minute
      const again = scheduler.schedule(newItem, 0, defaultSettings, now)
      expect(new Date(again.due_date)).toEqual(
        new Date(now.getTime() + 1 * 60 * 1000)
      )

      // Hard: 6 minutes (average of 1m and 10m at step 0)
      const hard = scheduler.schedule(newItem, 2, defaultSettings, now)
      expect(new Date(hard.due_date)).toEqual(
        new Date(now.getTime() + 6 * 60 * 1000)
      )

      // Good: 10 minutes (advance to step 1)
      const good = scheduler.schedule(newItem, 3, defaultSettings, now)
      expect(new Date(good.due_date)).toEqual(
        new Date(now.getTime() + 10 * 60 * 1000)
      )

      // Easy: 4 days
      const easy = scheduler.schedule(newItem, 4, defaultSettings, now)
      expect(new Date(easy.due_date)).toEqual(
        new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)
      )
    })

    it('should calculate exact due_date for REVIEW state transitions', () => {
      const reviewItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 10,
        ease_factor: 2.5,
        repetitions: 3,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // Again: 10 minutes (relearning)
      const again = scheduler.schedule(reviewItem, 0, defaultSettings, now)
      expect(new Date(again.due_date)).toEqual(
        new Date(now.getTime() + 10 * 60 * 1000)
      )

      // Hard: 12 days (10 * 1.2)
      const hard = scheduler.schedule(reviewItem, 2, defaultSettings, now)
      expect(new Date(hard.due_date)).toEqual(
        new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000)
      )

      // Good: 25 days (10 * 2.5)
      const good = scheduler.schedule(reviewItem, 3, defaultSettings, now)
      expect(new Date(good.due_date)).toEqual(
        new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000)
      )

      // Easy: 32.5 days (10 * 2.5 * 1.3)
      const easy = scheduler.schedule(reviewItem, 4, defaultSettings, now)
      expect(new Date(easy.due_date)).toEqual(
        new Date(now.getTime() + 32.5 * 24 * 60 * 60 * 1000)
      )
    })

    it('should handle very large ease factors', () => {
      const highEaseItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'REVIEW',
        interval: 100,
        ease_factor: 5.0, // Very high ease
        repetitions: 10,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      // 100 * 5.0 = 500 days
      const result = scheduler.schedule(highEaseItem, 3, defaultSettings, now)

      expect(result.interval).toBe(500)
      expect(result.ease_factor).toBe(5.0)
    })

    it('should preserve ISO string format in due_date', () => {
      const newItem: ReviewItem = {
        review_item_id: 'ri1',
        card_id: 'c1',
        user_id: 'test-user',
        direction: 'forward',
        state: 'NEW',
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        step_index: 0,
        due_date: now.toISOString(),
        last_reviewed: null,
        created_at: now.toISOString(),
        front: 'test',
        back: 'test',
        explanation: null,
      }

      const result = scheduler.schedule(newItem, 3, defaultSettings, now)

      // Should be valid ISO 8601 string
      expect(result.due_date).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
      expect(() => new Date(result.due_date)).not.toThrow()
    })
  })
})
