import { useReducer, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useApiMutation } from '@/hooks/useApiMutation'
import { apiClient } from '@/lib/api'
import type {
  WritingExercise,
  WritingQueueResponse,
  SubmitWritingResponse,
} from '@/types'

// ============================================================================
// State Machine
// ============================================================================

export type WritingPhase = 'loading' | 'empty' | 'writing' | 'feedback' | 'complete'

export interface WritingSessionState {
  phase: WritingPhase
  exercises: WritingExercise[]
  currentIndex: number
  currentExercise: WritingExercise | null
  results: SubmitWritingResponse[]
  correctCount: number
  totalCount: number
  startTime: number | null
}

type WritingAction =
  | { type: 'INIT_QUEUE'; exercises: WritingExercise[] }
  | { type: 'SUBMIT_ANSWER'; result: SubmitWritingResponse }
  | { type: 'NEXT_EXERCISE' }

const initialState: WritingSessionState = {
  phase: 'loading',
  exercises: [],
  currentIndex: 0,
  currentExercise: null,
  results: [],
  correctCount: 0,
  totalCount: 0,
  startTime: null,
}

export function writingSessionReducer(
  state: WritingSessionState,
  action: WritingAction
): WritingSessionState {
  switch (action.type) {
    case 'INIT_QUEUE': {
      if (action.exercises.length === 0) {
        return { ...state, phase: 'empty', exercises: [], totalCount: 0 }
      }
      return {
        ...state,
        phase: 'writing',
        exercises: action.exercises,
        currentIndex: 0,
        currentExercise: action.exercises[0],
        totalCount: action.exercises.length,
        startTime: Date.now(),
      }
    }
    case 'SUBMIT_ANSWER': {
      return {
        ...state,
        phase: 'feedback',
        results: [...state.results, action.result],
        correctCount: state.correctCount + (action.result.correct ? 1 : 0),
      }
    }
    case 'NEXT_EXERCISE': {
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= state.exercises.length) {
        return { ...state, phase: 'complete', currentExercise: null }
      }
      return {
        ...state,
        phase: 'writing',
        currentIndex: nextIndex,
        currentExercise: state.exercises[nextIndex],
      }
    }
    default:
      return state
  }
}

// ============================================================================
// Hooks
// ============================================================================

export function useWritingQueue() {
  const { token } = useAuth()

  return useApiQuery<WritingQueueResponse>({
    queryKey: ['writing-queue'],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token')
      return apiClient.getWritingQueue(token)
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}

export function useSubmitWriting() {
  const { token } = useAuth()

  return useApiMutation<
    SubmitWritingResponse,
    {
      exercise_id: string
      exercise_type: WritingExercise['type']
      user_answer: string
      reference_answer: string
      alternatives?: string[]
      duration_ms: number
      card_id?: string
    }
  >({
    mutationFn: async (data) => {
      if (!token) throw new Error('No authentication token')
      return apiClient.submitWritingAttempt(token, data)
    },
    showLoader: false,
  })
}

export function useWritingSession(
  exercises: WritingExercise[] | undefined,
  isDataLoaded: boolean
) {
  const [state, dispatch] = useReducer(writingSessionReducer, initialState)
  const initializedRef = useRef(false)

  // Initialize queue when data loads
  useEffect(() => {
    if (isDataLoaded && !initializedRef.current && exercises) {
      initializedRef.current = true
      dispatch({ type: 'INIT_QUEUE', exercises })
    }
  }, [isDataLoaded, exercises])

  const submitAnswer = useCallback((result: SubmitWritingResponse) => {
    dispatch({ type: 'SUBMIT_ANSWER', result })
  }, [])

  const nextExercise = useCallback(() => {
    dispatch({ type: 'NEXT_EXERCISE' })
  }, [])

  return {
    ...state,
    submitAnswer,
    nextExercise,
  }
}
