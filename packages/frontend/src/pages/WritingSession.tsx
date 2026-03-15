import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, X, ArrowRight, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingCards } from '@/components/review/LoadingCards'
import {
  useWritingQueue,
  useWritingSession,
  useSubmitWriting,
} from '@/hooks/useWritingSession'
import type { WritingExercise, SubmitWritingResponse } from '@/types'

function ProgressBar({
  current,
  total,
  correct,
}: {
  current: number
  total: number
  correct: number
}) {
  const progress = total > 0 ? ((current) / total) * 100 : 0

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Link to="/" aria-label="Back to home">
        <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      </Link>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {correct}/{current} correct
      </span>
    </div>
  )
}

function WritingInput({
  exercise,
  onSubmit,
  isSubmitting,
}: {
  exercise: WritingExercise
  onSubmit: (answer: string) => void
  isSubmitting: boolean
}) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount and when exercise changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [exercise.exercise_id])

  const handleSubmit = useCallback(() => {
    if (answer.trim() && !isSubmitting) {
      onSubmit(answer.trim())
    }
  }, [answer, isSubmitting, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Translate to Dutch
        </p>
        <p className="text-2xl font-semibold">{exercise.prompt}</p>
      </div>

      <div className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer in Dutch..."
          disabled={isSubmitting}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border-2 border-muted bg-white/80 px-4 py-3 text-lg text-center focus:border-primary focus:outline-none transition-colors"
        />
        <Button
          onClick={handleSubmit}
          disabled={!answer.trim() || isSubmitting}
          className="w-full py-6 text-lg"
        >
          Check Answer
        </Button>
      </div>
    </div>
  )
}

function FeedbackDisplay({
  result,
  exercise,
  onNext,
}: {
  result: SubmitWritingResponse
  exercise: WritingExercise
  onNext: () => void
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)

  // Focus for keyboard navigation
  useEffect(() => {
    feedbackRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onNext()
      }
    },
    [onNext]
  )

  return (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="mx-auto max-w-2xl w-full space-y-6 outline-none"
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Translate to Dutch
        </p>
        <p className="text-2xl font-semibold">{exercise.prompt}</p>
      </div>

      <div
        className={`rounded-xl border-2 p-6 space-y-3 ${
          result.correct
            ? 'border-green-300 bg-green-50/80'
            : 'border-red-300 bg-red-50/80'
        }`}
      >
        <div className="flex items-center gap-2">
          {result.correct ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <X className="h-5 w-5 text-red-600" />
          )}
          <span
            className={`font-semibold ${
              result.correct ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {result.feedback}
          </span>
        </div>
        {!result.correct && (
          <p className="text-sm text-muted-foreground">
            Correct answer: <span className="font-medium text-foreground">{result.reference_answer}</span>
          </p>
        )}
      </div>

      <Button onClick={onNext} className="w-full py-6 text-lg">
        Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function WritingComplete({
  correctCount,
  totalCount,
}: {
  correctCount: number
  totalCount: number
}) {
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="space-y-2">
        <PencilLine className="h-12 w-12 mx-auto text-primary" />
        <h2 className="text-3xl font-bold">Writing Practice Complete</h2>
        <p className="text-lg text-muted-foreground">
          {correctCount}/{totalCount} correct ({percentage}%)
        </p>
      </div>

      <div className="flex gap-3 justify-center pt-4">
        <Button asChild variant="outline">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-center">
      <PencilLine className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-2xl font-bold">No Writing Exercises</h2>
      <p className="text-muted-foreground">
        Complete your flashcard review first to unlock writing practice.
        Writing exercises are generated from cards you review.
      </p>
      <Button asChild>
        <Link to="/review">Go to Review</Link>
      </Button>
    </div>
  )
}

export function WritingSession() {
  const { data, isLoading } = useWritingQueue()
  const session = useWritingSession(data?.exercises, !isLoading && !!data)
  const submitWriting = useSubmitWriting()
  const exerciseStartRef = useRef(Date.now())

  // Reset timer when exercise changes
  useEffect(() => {
    if (session.phase === 'writing') {
      exerciseStartRef.current = Date.now()
    }
  }, [session.phase, session.currentIndex])

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!session.currentExercise) return

      const durationMs = Date.now() - exerciseStartRef.current

      submitWriting.mutate(
        {
          exercise_id: session.currentExercise.exercise_id,
          user_answer: answer,
          duration_ms: durationMs,
        },
        {
          onSuccess: (result) => {
            session.submitAnswer(result)
          },
        }
      )
    },
    [session, submitWriting]
  )

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <LoadingCards />
        </div>
      </div>
    )
  }

  // Empty state
  if (session.phase === 'empty') {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <EmptyState />
        </div>
      </div>
    )
  }

  // Complete state
  if (session.phase === 'complete') {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <WritingComplete
            correctCount={session.correctCount}
            totalCount={session.totalCount}
          />
        </div>
      </div>
    )
  }

  // Writing + Feedback states
  const lastResult = session.results[session.results.length - 1]

  return (
    <div className="relative flex h-full flex-col">
      <ProgressBar
        current={session.currentIndex + (session.phase === 'feedback' ? 1 : 0)}
        total={session.totalCount}
        correct={session.correctCount}
      />

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {session.phase === 'writing' && session.currentExercise && (
          <WritingInput
            exercise={session.currentExercise}
            onSubmit={handleSubmit}
            isSubmitting={submitWriting.isPending}
          />
        )}

        {session.phase === 'feedback' && lastResult && session.currentExercise && (
          <FeedbackDisplay
            result={lastResult}
            exercise={session.exercises[session.currentIndex]}
            onNext={session.nextExercise}
          />
        )}
      </div>
    </div>
  )
}
