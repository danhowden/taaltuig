import type { ReviewItem, UserSettings, State, Grade } from './types'

export interface ScheduleResult {
  state: State
  interval: number
  ease_factor: number
  repetitions: number
  step_index: number
  due_date: string
}

/**
 * SM-2 Scheduler Implementation
 *
 * Based on the SuperMemo 2 algorithm with Anki-style learning steps
 */
export class SM2Scheduler {
  /**
   * Calculate next review state based on grade
   */
  schedule(
    reviewItem: ReviewItem,
    grade: Grade,
    settings: UserSettings,
    now: Date
  ): ScheduleResult {
    const { state, step_index } = reviewItem

    // Handle NEW and LEARNING states
    if (state === 'NEW' || state === 'LEARNING') {
      return this.scheduleLearning(
        grade,
        step_index,
        settings.learning_steps,
        settings.graduating_interval,
        settings.easy_interval,
        settings.starting_ease,
        now
      )
    }

    // Handle RELEARNING state
    if (state === 'RELEARNING') {
      return this.scheduleRelearning(
        reviewItem,
        grade,
        step_index,
        settings.relearning_steps,
        settings,
        now
      )
    }

    // Handle REVIEW state (SM-2 algorithm)
    return this.scheduleReview(reviewItem, grade, settings, now)
  }

  private scheduleLearning(
    grade: Grade,
    stepIndex: number,
    learningSteps: number[],
    graduatingInterval: number,
    easyInterval: number,
    startingEase: number,
    now: Date
  ): ScheduleResult {
    // Again (0): Reset to first step
    if (grade === 0) {
      const intervalMinutes = learningSteps[0]
      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'LEARNING',
        interval: intervalMinutes / 1440, // Convert minutes to days
        ease_factor: startingEase,
        repetitions: 0,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Hard (2): Anki behavior
    // - First step: Average of Again and Good intervals
    // - Later steps: Previous step interval
    if (grade === 2) {
      let intervalMinutes: number
      let newStepIndex: number

      if (stepIndex === 0) {
        // First step: Use average of current (Again) and next step (Good)
        const againInterval = learningSteps[0]
        const goodInterval = learningSteps[1] || learningSteps[0]
        intervalMinutes = Math.round((againInterval + goodInterval) / 2)
        newStepIndex = 0 // Stay on first step
      } else {
        // Later steps: Use previous step interval
        intervalMinutes = learningSteps[stepIndex - 1]
        newStepIndex = stepIndex - 1
      }

      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'LEARNING',
        interval: intervalMinutes / 1440,
        ease_factor: startingEase,
        repetitions: 0,
        step_index: newStepIndex,
        due_date: dueDate.toISOString(),
      }
    }

    // Easy (4): Graduate immediately with easy interval
    if (grade === 4) {
      const dueDate = new Date(now.getTime() + easyInterval * 24 * 60 * 60 * 1000)

      return {
        state: 'REVIEW',
        interval: easyInterval,
        ease_factor: startingEase,
        repetitions: 1,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Good (3): Advance to next step or graduate
    const isLastStep = stepIndex >= learningSteps.length - 1

    if (isLastStep) {
      // Graduate to REVIEW state
      const dueDate = new Date(
        now.getTime() + graduatingInterval * 24 * 60 * 60 * 1000
      )

      return {
        state: 'REVIEW',
        interval: graduatingInterval,
        ease_factor: startingEase,
        repetitions: 1,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    } else {
      // Move to next learning step
      const newStepIndex = stepIndex + 1
      const intervalMinutes = learningSteps[newStepIndex]
      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'LEARNING',
        interval: intervalMinutes / 1440,
        ease_factor: startingEase,
        repetitions: 0,
        step_index: newStepIndex,
        due_date: dueDate.toISOString(),
      }
    }
  }

  private scheduleRelearning(
    reviewItem: ReviewItem,
    grade: Grade,
    stepIndex: number,
    relearningSteps: number[],
    settings: UserSettings,
    now: Date
  ): ScheduleResult {
    const { ease_factor, interval: previousInterval } = reviewItem

    // Again (0): Reset to first relearning step
    if (grade === 0) {
      const intervalMinutes = relearningSteps[0]
      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'RELEARNING',
        interval: intervalMinutes / 1440,
        ease_factor,
        repetitions: 0,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Hard (2): Anki behavior
    // - First step: Average of Again and Good intervals
    // - Later steps: Previous step interval
    if (grade === 2) {
      let intervalMinutes: number
      let newStepIndex: number

      if (stepIndex === 0) {
        // First step: Use average of current (Again) and next step (Good)
        const againInterval = relearningSteps[0]
        // If only one relearning step, Good would graduate, so use previousInterval
        const goodInterval = relearningSteps[1]
          ? relearningSteps[1]
          : previousInterval * 24 * 60 // Convert days to minutes for calculation
        intervalMinutes = Math.round((againInterval + goodInterval) / 2)
        newStepIndex = 0 // Stay on first step
      } else {
        // Later steps: Use previous step interval
        intervalMinutes = relearningSteps[stepIndex - 1]
        newStepIndex = stepIndex - 1
      }

      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'RELEARNING',
        interval: intervalMinutes / 1440,
        ease_factor,
        repetitions: 0,
        step_index: newStepIndex,
        due_date: dueDate.toISOString(),
      }
    }

    // Good (3) or Easy (4): Check if last relearning step
    const isLastStep = stepIndex >= relearningSteps.length - 1

    if (isLastStep || grade === 4) {
      // Return to REVIEW state with new interval based on lapse_new_interval setting
      // lapse_new_interval is a percentage (0-100)
      // 0% = minimum interval (1 day), like Anki default
      // 100% = keep previous interval entirely
      const lapsePercentage = (settings.lapse_new_interval ?? 0) / 100
      let newInterval = Math.max(1, previousInterval * lapsePercentage)
      newInterval = this.capInterval(newInterval, settings.maximum_interval)
      const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)

      return {
        state: 'REVIEW',
        interval: newInterval,
        ease_factor,
        repetitions: 0,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    } else {
      // Move to next relearning step
      const newStepIndex = stepIndex + 1
      const intervalMinutes = relearningSteps[newStepIndex]
      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'RELEARNING',
        interval: intervalMinutes / 1440,
        ease_factor,
        repetitions: 0,
        step_index: newStepIndex,
        due_date: dueDate.toISOString(),
      }
    }
  }

  private scheduleReview(
    reviewItem: ReviewItem,
    grade: Grade,
    settings: UserSettings,
    now: Date
  ): ScheduleResult {
    const { interval, ease_factor, repetitions } = reviewItem

    // Again (0): Move to relearning
    if (grade === 0) {
      const newEaseFactor = Math.max(1.3, ease_factor - 0.2)
      const intervalMinutes = settings.relearning_steps[0]
      const dueDate = new Date(now.getTime() + intervalMinutes * 60 * 1000)

      return {
        state: 'RELEARNING',
        interval: intervalMinutes / 1440,
        ease_factor: newEaseFactor,
        repetitions: 0,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Hard (2): Decrease ease factor, multiply interval by 1.2
    if (grade === 2) {
      const newEaseFactor = Math.max(1.3, ease_factor - 0.15)
      let newInterval = interval * 1.2 * settings.interval_modifier
      newInterval = this.capInterval(newInterval, settings.maximum_interval)
      const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)

      return {
        state: 'REVIEW',
        interval: newInterval,
        ease_factor: newEaseFactor,
        repetitions: 0,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Good (3): Anki-style continuous EF multiplication
    if (grade === 3) {
      const newRepetitions = repetitions + 1
      // Anki uses continuous EF multiplication from first review
      // newInterval = previousInterval * ease_factor * interval_modifier
      let newInterval = interval * ease_factor * settings.interval_modifier

      newInterval = this.capInterval(newInterval, settings.maximum_interval)
      const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)

      return {
        state: 'REVIEW',
        interval: newInterval,
        ease_factor,
        repetitions: newRepetitions,
        step_index: 0,
        due_date: dueDate.toISOString(),
      }
    }

    // Easy (4): Increase ease factor, apply easy bonus
    // Anki-style: continuous EF multiplication with easy bonus
    const newEaseFactor = ease_factor + 0.15
    const newRepetitions = repetitions + 1
    let newInterval =
      interval * ease_factor * settings.easy_bonus * settings.interval_modifier

    newInterval = this.capInterval(newInterval, settings.maximum_interval)
    const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)

    return {
      state: 'REVIEW',
      interval: newInterval,
      ease_factor: newEaseFactor,
      repetitions: newRepetitions,
      step_index: 0,
      due_date: dueDate.toISOString(),
    }
  }

  /**
   * Cap interval at maximum to prevent extremely long intervals
   */
  private capInterval(interval: number, maximum: number): number {
    return Math.min(interval, maximum)
  }
}
