import { useState, useCallback, useRef, useEffect, useReducer } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, X, ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingCards } from '@/components/review/LoadingCards'
import { SessionLayout } from '@/components/SessionLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useSettings } from '@/hooks/useSettings'
import { apiClient } from '@/lib/api'
import type { CatalogExercise } from '@/types'
import { EXERCISE_TYPE_COLORS, EXERCISE_TYPE_LABELS } from '@/constants/exercises'
import { CURRICULUM, type CurriculumTopic } from '@taaltuig/dynamodb-client'

const topicNameMap = new Map<string, string>(
  (CURRICULUM as CurriculumTopic[]).map((t) => [t.id, t.name])
)

// ============================================================================
// Levenshtein distance (for typo tolerance)
// ============================================================================

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function isCloseEnough(answer: string, reference: string): boolean {
  if (answer === reference) return true
  const maxDist = reference.length <= 4 ? 0 : reference.length <= 8 ? 1 : 2
  return levenshtein(answer, reference) <= maxDist
}

// ============================================================================
// Assessment (client-side)
// ============================================================================

interface AssessmentResult {
  correct: boolean
  feedback: string
  reference_answer: string
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ')
}

function assess(exercise: CatalogExercise, userAnswer: string): AssessmentResult {
  const answer = normalise(userAnswer)
  const reference = normalise(exercise.reference_answer)

  if (!answer) {
    return {
      correct: false,
      feedback: 'Passed',
      reference_answer: exercise.reference_answer,
    }
  }

  // Check exact match or close typo
  if (isCloseEnough(answer, reference)) {
    const typo = answer !== reference
    return {
      correct: true,
      feedback: typo ? `Close enough! (watch the spelling)` : 'Correct!',
      reference_answer: exercise.reference_answer,
    }
  }

  // Check alternatives
  for (const alt of exercise.alternatives) {
    if (isCloseEnough(answer, normalise(alt))) {
      return {
        correct: true,
        feedback: 'Correct!',
        reference_answer: exercise.reference_answer,
      }
    }
  }

  return {
    correct: false,
    feedback: 'Incorrect',
    reference_answer: exercise.reference_answer,
  }
}

// ============================================================================
// Session State Machine
// ============================================================================

type Phase = 'loading' | 'empty' | 'exercise' | 'feedback' | 'complete'

interface SessionState {
  phase: Phase
  exercises: CatalogExercise[]
  currentIndex: number
  results: AssessmentResult[]
  userAnswers: string[]
  correctCount: number
}

type SessionAction =
  | { type: 'INIT'; exercises: CatalogExercise[] }
  | { type: 'SUBMIT'; result: AssessmentResult; userAnswer: string }
  | { type: 'NEXT' }

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'INIT': {
      if (action.exercises.length === 0) {
        return { ...state, phase: 'empty', exercises: [] }
      }
      return {
        ...state,
        phase: 'exercise',
        exercises: action.exercises,
        currentIndex: 0,
        results: [],
        userAnswers: [],
        correctCount: 0,
      }
    }
    case 'SUBMIT': {
      return {
        ...state,
        phase: 'feedback',
        results: [...state.results, action.result],
        userAnswers: [...state.userAnswers, action.userAnswer],
        correctCount: state.correctCount + (action.result.correct ? 1 : 0),
      }
    }
    case 'NEXT': {
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= state.exercises.length) {
        return { ...state, phase: 'complete' }
      }
      return { ...state, phase: 'exercise', currentIndex: nextIndex }
    }
  }
}

// ============================================================================
// Progress Bar
// ============================================================================

function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = total > 0 ? (current / total) * 100 : 0
  return (
    <div className="mx-auto max-w-2xl w-full flex items-center gap-4 px-4 py-3">
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-black/40 tabular-nums shrink-0">
        {Math.max(0, total - current)} to go
      </span>
    </div>
  )
}

// ============================================================================
// Exercise Input Components
// ============================================================================

interface ExerciseInputProps {
  exercise: CatalogExercise
  onSubmit: (answer: string) => void
  onPass: () => void
}

function TextInput({
  label,
  prompt,
  hint,
  placeholder,
  exerciseId,
  onSubmit,
  onPass,
}: {
  label: string
  prompt: React.ReactNode
  hint?: string
  placeholder: string
  exerciseId: string
  onSubmit: (answer: string) => void
  onPass: () => void
}) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAnswer('')
    inputRef.current?.focus()
  }, [exerciseId])

  const handleSubmit = useCallback(() => {
    if (answer.trim()) onSubmit(answer.trim())
  }, [answer, onSubmit])

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">
          {label}
        </p>
        <div className="text-2xl font-semibold">{prompt}</div>
        {hint && (
          <p className="text-sm text-black/35 italic">{hint}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 rounded-full border border-transparent bg-white/40 px-5 py-3 text-lg text-black placeholder:text-black/30 focus:border-white focus:outline-none transition-colors"
        />
        <Button onClick={handleSubmit} disabled={!answer.trim()} className="rounded-full px-6 shrink-0">
          Check
        </Button>
        <Button variant="outline" onClick={onPass} className="rounded-full px-6 shrink-0">
          Pass
        </Button>
      </div>
    </div>
  )
}

function FillBlankInput({ exercise, onSubmit, onPass }: ExerciseInputProps) {
  const parts = exercise.prompt.split('___')

  return (
    <TextInput
      label="Fill in the blank"
      prompt={
        <p>
          {parts[0]}
          <span className="inline-block w-24 border-b-2 border-primary mx-1 align-bottom" />
          {parts[1]}
        </p>
      }
      hint={topicNameMap.get(exercise.topic_id)}
      placeholder="Type the missing word..."
      exerciseId={exercise.exercise_id}
      onSubmit={onSubmit}
      onPass={onPass}
    />
  )
}

function MultipleChoiceInput({ exercise, onSubmit, onPass }: ExerciseInputProps) {
  const options = exercise.options ?? []
  const topicName = topicNameMap.get(exercise.topic_id)

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">
          Choose the correct answer
        </p>
        <div className="text-2xl font-semibold">{exercise.prompt}</div>
        {topicName && <p className="text-sm text-black/35 italic">{topicName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option, i) => (
          <button
            key={i}
            onClick={() => onSubmit(option)}
            className="px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-lg font-medium hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onPass} className="rounded-full px-6">
          Pass
        </Button>
      </div>
    </div>
  )
}

function WordReorderInput({ exercise, onSubmit, onPass }: ExerciseInputProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [availableWords, setAvailableWords] = useState<string[]>([])

  useEffect(() => {
    setAvailableWords(exercise.prompt.split(' / '))
    setSelectedWords([])
  }, [exercise.exercise_id, exercise.prompt])

  const addWord = useCallback((word: string, index: number) => {
    setSelectedWords((prev) => [...prev, word])
    setAvailableWords((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeWord = useCallback((index: number) => {
    const word = selectedWords[index]
    setSelectedWords((prev) => prev.filter((_, i) => i !== index))
    setAvailableWords((prev) => [...prev, word])
  }, [selectedWords])

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8">
      <div className="text-center">
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">
          Put the words in order
        </p>
      </div>

      <div className="min-h-[60px] rounded-2xl border border-black/10 bg-white/40 p-3 flex flex-wrap gap-2 items-start">
        {selectedWords.length === 0 && (
          <span className="text-black/30 text-sm">Tap words below to build the sentence...</span>
        )}
        {selectedWords.map((word, i) => (
          <button
            key={`selected-${i}`}
            onClick={() => removeWord(i)}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {availableWords.map((word, i) => (
          <button
            key={`available-${i}`}
            onClick={() => addWord(word, i)}
            className="px-3 py-1.5 rounded-lg border border-black/10 bg-white/60 text-lg font-medium hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button
          onClick={() => onSubmit(selectedWords.join(' '))}
          disabled={selectedWords.length === 0 || availableWords.length > 0}
          className="rounded-full px-6"
        >
          Check Answer
        </Button>
        <Button variant="outline" onClick={onPass} className="rounded-full px-6">
          Pass
        </Button>
      </div>
    </div>
  )
}

function TranslationInput({ exercise, onSubmit, onPass }: ExerciseInputProps) {
  return (
    <TextInput
      label="Translate to Dutch"
      prompt={<p>{exercise.prompt}</p>}
      hint={topicNameMap.get(exercise.topic_id)}
      placeholder="Type your answer in Dutch..."
      exerciseId={exercise.exercise_id}
      onSubmit={onSubmit}
      onPass={onPass}
    />
  )
}

function ExerciseInput({ exercise, onSubmit, onPass }: ExerciseInputProps) {
  switch (exercise.type) {
    case 'fill_blank':
      return <FillBlankInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} />
    case 'multiple_choice':
      return <MultipleChoiceInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} />
    case 'word_reorder':
      return <WordReorderInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} />
    default:
      return <TranslationInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} />
  }
}

// ============================================================================
// Feedback Display
// ============================================================================

function FeedbackDisplay({
  result,
  exercise,
  userAnswer,
  onNext,
}: {
  result: AssessmentResult
  exercise: CatalogExercise
  userAnswer: string
  onNext: () => void
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedbackRef.current?.focus()
  }, [])

  const typeLabel = EXERCISE_TYPE_LABELS[exercise.type] || exercise.type

  return (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNext()}
      className="mx-auto max-w-2xl w-full space-y-6 outline-none"
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">{typeLabel}</p>
        <p className="text-2xl font-semibold">{exercise.prompt}</p>
      </div>

      <div className="rounded-2xl bg-black/40 p-6 space-y-3">
        <div className="flex items-center gap-2">
          {result.correct ? (
            <Check className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <X className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span className="font-semibold text-white">{result.feedback}</span>
        </div>
        <div className="space-y-1">
          {userAnswer && (result.correct ? result.feedback.includes('spelling') : true) && (
            <p className="text-sm text-white/50">
              Your answer: <span className="font-medium text-white/70">{userAnswer}</span>
            </p>
          )}
          <p className="text-sm text-white/50">
            Correct answer: <span className="font-medium text-white">{result.reference_answer}</span>
          </p>
        </div>
        {(exercise.explanation || exercise.translation_notes || exercise.grammar_focus) && (
          <p className="text-xs text-white/50 pt-1">
            {exercise.explanation ?? exercise.translation_notes ?? exercise.grammar_focus}
          </p>
        )}
      </div>

      <Button onClick={onNext} className="w-full rounded-full py-6 text-lg">
        Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

// ============================================================================
// Session Complete
// ============================================================================

function SessionComplete({ correctCount, totalCount }: { correctCount: number; totalCount: number }) {
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="space-y-2">
        <BookOpen className="h-12 w-12 mx-auto text-primary" />
        <h2 className="text-3xl font-bold">Session Complete</h2>
        <p className="text-lg text-muted-foreground">
          {correctCount}/{totalCount} correct ({percentage}%)
        </p>
      </div>

      <div className="flex gap-3 justify-center pt-4">
        <Button asChild variant="outline">
          <Link to="/curriculum">Curriculum</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/exercises">All Exercises</Link>
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ExerciseSession() {
  const { token } = useAuth()
  const { data: settings } = useSettings()
  const [searchParams] = useSearchParams()

  const topic = searchParams.get('topic') || undefined
  const level = searchParams.get('level') || undefined

  const { data, isLoading } = useApiQuery({
    queryKey: ['exercise-session', topic, level],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExerciseCatalog(token, { topic, level, due_only: true })
    },
    enabled: !!token,
  })

  const [state, dispatch] = useReducer(sessionReducer, {
    phase: 'loading',
    exercises: [],
    currentIndex: 0,
    results: [],
    userAnswers: [],
    correctCount: 0,
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!isLoading && data && !initializedRef.current) {
      initializedRef.current = true
      // Shuffle and cap to daily limit
      const limit = settings?.writing_exercises_per_day ?? 10
      const shuffled = [...data.exercises].sort(() => Math.random() - 0.5).slice(0, limit)
      dispatch({ type: 'INIT', exercises: shuffled })
    }
  }, [isLoading, data])

  const currentExercise = state.phase !== 'loading' && state.phase !== 'empty' && state.phase !== 'complete'
    ? state.exercises[state.currentIndex]
    : null

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!currentExercise) return
      const result = assess(currentExercise, answer)
      dispatch({ type: 'SUBMIT', result, userAnswer: answer })
      if (token) {
        apiClient.recordExerciseAttempt(token, {
          exercise_id: currentExercise.exercise_id,
          topic_id: currentExercise.topic_id,
          result: result.correct ? 'correct' : 'incorrect',
        }).catch(console.error)
      }
    },
    [currentExercise, token]
  )

  const handlePass = useCallback(() => {
    if (!currentExercise) return
    const result = assess(currentExercise, '')
    dispatch({ type: 'SUBMIT', result, userAnswer: '' })
    if (token) {
      apiClient.recordExerciseAttempt(token, {
        exercise_id: currentExercise.exercise_id,
        topic_id: currentExercise.topic_id,
        result: 'skipped',
      }).catch(console.error)
    }
  }, [currentExercise, token])

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' })
  }, [])

  if (isLoading || state.phase === 'loading') {
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <LoadingCards />
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  if (state.phase === 'empty') {
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">No exercises available</h2>
            <p className="text-muted-foreground">
              {topic
                ? 'No exercises have been seeded for this topic yet.'
                : 'No exercises found. Try selecting a specific topic from the curriculum.'}
            </p>
            <Button asChild variant="outline">
              <Link to="/curriculum">Browse Curriculum</Link>
            </Button>
          </div>
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  if (state.phase === 'complete') {
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <SessionComplete
            correctCount={state.correctCount}
            totalCount={state.exercises.length}
          />
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  const lastResult = state.results[state.results.length - 1]
  const lastUserAnswer = state.userAnswers[state.userAnswers.length - 1]

  return (
    <SessionLayout>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {state.phase === 'exercise' && currentExercise && (
          <div className="w-full space-y-4">
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={`text-xs ${EXERCISE_TYPE_COLORS[currentExercise.type] ?? ''}`}
              >
                {EXERCISE_TYPE_LABELS[currentExercise.type] || currentExercise.type}
              </Badge>
            </div>
            <ExerciseInput
              exercise={currentExercise}
              onSubmit={handleSubmit}
              onPass={handlePass}
            />
          </div>
        )}

        {state.phase === 'feedback' && lastResult && currentExercise && (
          <FeedbackDisplay
            result={lastResult}
            exercise={state.exercises[state.currentIndex]}
            userAnswer={lastUserAnswer}
            onNext={handleNext}
          />
        )}
      </div>

      <div className="pb-3">
        <ProgressBar
          current={state.currentIndex + (state.phase === 'feedback' ? 1 : 0)}
          total={state.exercises.length}
        />
      </div>
    </SessionLayout>
  )
}
