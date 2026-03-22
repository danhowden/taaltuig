import { writingSessionReducer } from './useWritingSession'
import type { WritingSessionState } from './useWritingSession'
import type { WritingExercise, SubmitWritingResponse } from '@/types'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockExercise = (id: string): WritingExercise => ({
  exercise_id: id,
  type: 'translation',
  prompt: `Translate: ${id}`,
  reference_answer: `answer-${id}`,
  alternatives: [],
})

const mockResult = (correct: boolean): SubmitWritingResponse => ({
  correct,
  grade: correct ? 3 : 0,
  feedback: correct ? 'Correct!' : 'Wrong',
  match_type: correct ? 'exact' : 'wrong',
  reference_answer: 'answer',
})

const ex1 = mockExercise('ex-1')
const ex2 = mockExercise('ex-2')
const ex3 = mockExercise('ex-3')

const initialState: WritingSessionState = {
  phase: 'loading',
  exercises: [],
  currentIndex: 0,
  currentExercise: null,
  results: [],
  userAnswers: [],
  correctCount: 0,
  totalCount: 0,
  startTime: null,
}

// =============================================================================
// Reducer Tests
// =============================================================================

describe('writingSessionReducer', () => {
  // ===========================================================================
  // INIT_QUEUE
  // ===========================================================================

  describe('INIT_QUEUE', () => {
    it('sets phase to empty when exercises array is empty', () => {
      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [],
      })

      expect(state.phase).toBe('empty')
      expect(state.exercises).toEqual([])
      expect(state.totalCount).toBe(0)
      expect(state.currentExercise).toBeNull()
    })

    it('sets phase to writing when exercises are provided', () => {
      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [ex1, ex2],
      })

      expect(state.phase).toBe('writing')
      expect(state.exercises).toEqual([ex1, ex2])
      expect(state.currentIndex).toBe(0)
      expect(state.currentExercise).toEqual(ex1)
      expect(state.totalCount).toBe(2)
      expect(state.startTime).toBeTypeOf('number')
    })

    it('sets startTime to a recent timestamp', () => {
      const before = Date.now()
      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [ex1],
      })
      const after = Date.now()

      expect(state.startTime).toBeGreaterThanOrEqual(before)
      expect(state.startTime).toBeLessThanOrEqual(after)
    })

    it('sets currentExercise to the first exercise', () => {
      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [ex2, ex1],
      })

      expect(state.currentExercise).toEqual(ex2)
    })
  })

  // ===========================================================================
  // SUBMIT_ANSWER
  // ===========================================================================

  describe('SUBMIT_ANSWER', () => {
    const writingState: WritingSessionState = {
      ...initialState,
      phase: 'writing',
      exercises: [ex1, ex2],
      currentExercise: ex1,
      totalCount: 2,
      startTime: Date.now(),
    }

    it('sets phase to feedback', () => {
      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'my answer',
      })

      expect(state.phase).toBe('feedback')
    })

    it('appends result to results array', () => {
      const result = mockResult(true)
      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result,
        userAnswer: 'my answer',
      })

      expect(state.results).toEqual([result])
    })

    it('appends userAnswer to userAnswers array', () => {
      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'my answer',
      })

      expect(state.userAnswers).toEqual(['my answer'])
    })

    it('increments correctCount when result is correct', () => {
      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'correct answer',
      })

      expect(state.correctCount).toBe(1)
    })

    it('does not increment correctCount when result is incorrect', () => {
      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(false),
        userAnswer: 'wrong answer',
      })

      expect(state.correctCount).toBe(0)
    })

    it('accumulates results and userAnswers across multiple submissions', () => {
      const result1 = mockResult(true)
      const result2 = mockResult(false)

      let state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: result1,
        userAnswer: 'answer 1',
      })

      // Move to next exercise first
      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })

      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: result2,
        userAnswer: 'answer 2',
      })

      expect(state.results).toEqual([result1, result2])
      expect(state.userAnswers).toEqual(['answer 1', 'answer 2'])
      expect(state.correctCount).toBe(1)
    })
  })

  // ===========================================================================
  // NEXT_EXERCISE
  // ===========================================================================

  describe('NEXT_EXERCISE', () => {
    it('moves to next exercise when not at end', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1, ex2, ex3],
        currentIndex: 0,
        currentExercise: ex1,
        totalCount: 3,
        results: [mockResult(true)],
        userAnswers: ['answer 1'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.phase).toBe('writing')
      expect(state.currentIndex).toBe(1)
      expect(state.currentExercise).toEqual(ex2)
    })

    it('sets phase to complete when at last exercise', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1],
        currentIndex: 0,
        currentExercise: ex1,
        totalCount: 1,
        results: [mockResult(true)],
        userAnswers: ['answer 1'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.phase).toBe('complete')
      expect(state.currentExercise).toBeNull()
    })

    it('sets phase to complete when at end of multi-exercise session', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1, ex2],
        currentIndex: 1,
        currentExercise: ex2,
        totalCount: 2,
        results: [mockResult(true), mockResult(false)],
        userAnswers: ['answer 1', 'answer 2'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.phase).toBe('complete')
      expect(state.currentExercise).toBeNull()
    })

    it('preserves results and counts when advancing', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1, ex2],
        currentIndex: 0,
        currentExercise: ex1,
        totalCount: 2,
        results: [mockResult(true)],
        userAnswers: ['answer 1'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.results).toEqual([mockResult(true)])
      expect(state.userAnswers).toEqual(['answer 1'])
      expect(state.correctCount).toBe(1)
    })
  })

  // ===========================================================================
  // LOAD_MORE
  // ===========================================================================

  describe('LOAD_MORE', () => {
    const completeState: WritingSessionState = {
      ...initialState,
      phase: 'complete',
      exercises: [ex1],
      currentIndex: 0,
      currentExercise: null,
      totalCount: 1,
      results: [mockResult(true)],
      userAnswers: ['answer 1'],
      correctCount: 1,
      startTime: Date.now(),
    }

    it('does nothing when exercises array is empty', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [],
      })

      expect(state).toBe(completeState) // Same reference — no change
    })

    it('sets phase to writing when exercises are provided', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2, ex3],
      })

      expect(state.phase).toBe('writing')
    })

    it('appends new exercises to existing exercises array', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2, ex3],
      })

      expect(state.exercises).toEqual([ex1, ex2, ex3])
    })

    it('sets currentIndex to start of new batch', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2, ex3],
      })

      expect(state.currentIndex).toBe(1) // index of first new exercise
    })

    it('sets currentExercise to first exercise of new batch', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2, ex3],
      })

      expect(state.currentExercise).toEqual(ex2)
    })

    it('updates totalCount to include all exercises', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2, ex3],
      })

      expect(state.totalCount).toBe(3)
    })

    it('preserves existing results and counts', () => {
      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2],
      })

      expect(state.results).toEqual([mockResult(true)])
      expect(state.userAnswers).toEqual(['answer 1'])
      expect(state.correctCount).toBe(1)
    })
  })

  // ===========================================================================
  // Phase Transitions
  // ===========================================================================

  describe('phase transitions', () => {
    it('loading -> empty (INIT_QUEUE with [])', () => {
      expect(initialState.phase).toBe('loading')

      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [],
      })

      expect(state.phase).toBe('empty')
    })

    it('loading -> writing (INIT_QUEUE with exercises)', () => {
      expect(initialState.phase).toBe('loading')

      const state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [ex1],
      })

      expect(state.phase).toBe('writing')
    })

    it('writing -> feedback (SUBMIT_ANSWER)', () => {
      const writingState: WritingSessionState = {
        ...initialState,
        phase: 'writing',
        exercises: [ex1],
        currentExercise: ex1,
        totalCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(writingState, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'answer',
      })

      expect(state.phase).toBe('feedback')
    })

    it('feedback -> writing (NEXT_EXERCISE, not at end)', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1, ex2],
        currentIndex: 0,
        currentExercise: ex1,
        totalCount: 2,
        results: [mockResult(true)],
        userAnswers: ['answer'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.phase).toBe('writing')
    })

    it('feedback -> complete (NEXT_EXERCISE, at end)', () => {
      const feedbackState: WritingSessionState = {
        ...initialState,
        phase: 'feedback',
        exercises: [ex1],
        currentIndex: 0,
        currentExercise: ex1,
        totalCount: 1,
        results: [mockResult(false)],
        userAnswers: ['answer'],
        correctCount: 0,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(feedbackState, {
        type: 'NEXT_EXERCISE',
      })

      expect(state.phase).toBe('complete')
    })

    it('complete -> writing (LOAD_MORE with exercises)', () => {
      const completeState: WritingSessionState = {
        ...initialState,
        phase: 'complete',
        exercises: [ex1],
        currentIndex: 0,
        currentExercise: null,
        totalCount: 1,
        results: [mockResult(true)],
        userAnswers: ['answer'],
        correctCount: 1,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(completeState, {
        type: 'LOAD_MORE',
        exercises: [ex2],
      })

      expect(state.phase).toBe('writing')
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('returns state unchanged for unknown action type', () => {
      const state = writingSessionReducer(initialState, {
        type: 'UNKNOWN_ACTION' as never,
      })

      expect(state).toBe(initialState)
    })

    it('correctCount accumulates correctly across correct and incorrect', () => {
      let state: WritingSessionState = {
        ...initialState,
        phase: 'writing',
        exercises: [ex1, ex2, ex3],
        currentExercise: ex1,
        totalCount: 3,
        startTime: Date.now(),
      }

      // Submit correct
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'correct',
      })
      expect(state.correctCount).toBe(1)

      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })

      // Submit incorrect
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(false),
        userAnswer: 'wrong',
      })
      expect(state.correctCount).toBe(1)

      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })

      // Submit correct again
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'correct again',
      })
      expect(state.correctCount).toBe(2)
    })

    it('full session flow: init -> submit -> next -> submit -> complete', () => {
      // Start from loading
      let state = writingSessionReducer(initialState, {
        type: 'INIT_QUEUE',
        exercises: [ex1, ex2],
      })
      expect(state.phase).toBe('writing')
      expect(state.currentExercise).toEqual(ex1)

      // Submit first answer (correct)
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(true),
        userAnswer: 'answer 1',
      })
      expect(state.phase).toBe('feedback')
      expect(state.correctCount).toBe(1)

      // Move to next
      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })
      expect(state.phase).toBe('writing')
      expect(state.currentExercise).toEqual(ex2)

      // Submit second answer (incorrect)
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(false),
        userAnswer: 'answer 2',
      })
      expect(state.phase).toBe('feedback')
      expect(state.correctCount).toBe(1)

      // Move to next (should complete)
      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })
      expect(state.phase).toBe('complete')
      expect(state.currentExercise).toBeNull()
      expect(state.results).toHaveLength(2)
      expect(state.userAnswers).toEqual(['answer 1', 'answer 2'])
    })

    it('LOAD_MORE after complete then full session continues', () => {
      // Set up a complete state
      let state: WritingSessionState = {
        ...initialState,
        phase: 'complete',
        exercises: [ex1],
        currentIndex: 0,
        currentExercise: null,
        totalCount: 1,
        results: [mockResult(true)],
        userAnswers: ['answer 1'],
        correctCount: 1,
        startTime: Date.now(),
      }

      // Load more exercises
      state = writingSessionReducer(state, {
        type: 'LOAD_MORE',
        exercises: [ex2],
      })
      expect(state.phase).toBe('writing')
      expect(state.currentExercise).toEqual(ex2)
      expect(state.exercises).toEqual([ex1, ex2])

      // Submit answer for new exercise
      state = writingSessionReducer(state, {
        type: 'SUBMIT_ANSWER',
        result: mockResult(false),
        userAnswer: 'answer 2',
      })
      expect(state.correctCount).toBe(1) // Still 1, this was incorrect

      // Complete again
      state = writingSessionReducer(state, { type: 'NEXT_EXERCISE' })
      expect(state.phase).toBe('complete')
      expect(state.results).toHaveLength(2)
      expect(state.userAnswers).toHaveLength(2)
    })

    it('INIT_QUEUE resets currentIndex to 0', () => {
      const midState: WritingSessionState = {
        ...initialState,
        phase: 'writing',
        exercises: [ex1, ex2],
        currentIndex: 1,
        currentExercise: ex2,
        totalCount: 2,
        startTime: Date.now(),
      }

      const state = writingSessionReducer(midState, {
        type: 'INIT_QUEUE',
        exercises: [ex3],
      })

      expect(state.currentIndex).toBe(0)
      expect(state.currentExercise).toEqual(ex3)
    })
  })
})
