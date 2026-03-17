import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, X, ArrowRight, PencilLine, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingCards } from '@/components/review/LoadingCards'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
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

interface ExerciseInputProps {
  exercise: WritingExercise
  onSubmit: (answer: string) => void
  isSubmitting: boolean
}

function TextInput({
  label,
  prompt,
  placeholder,
  exerciseId,
  onSubmit,
  isSubmitting,
}: {
  label: string
  prompt: React.ReactNode
  placeholder: string
  exerciseId: string
  onSubmit: (answer: string) => void
  isSubmitting: boolean
}) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAnswer('')
    inputRef.current?.focus()
  }, [exerciseId])

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
          {label}
        </p>
        <div className="text-2xl font-semibold">{prompt}</div>
      </div>

      <div className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
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

function FillBlankInput({ exercise, onSubmit, isSubmitting }: ExerciseInputProps) {
  // Split prompt around "___" to render the blank inline
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
      placeholder="Type the missing word..."
      exerciseId={exercise.exercise_id}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    />
  )
}

function WordReorderInput({ exercise, onSubmit, isSubmitting }: ExerciseInputProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [availableWords, setAvailableWords] = useState<string[]>([])

  // Reset when exercise changes
  useEffect(() => {
    const words = exercise.prompt.split(' / ')
    setAvailableWords(words)
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

  const handleSubmit = useCallback(() => {
    if (selectedWords.length > 0 && !isSubmitting) {
      onSubmit(selectedWords.join(' '))
    }
  }, [selectedWords, isSubmitting, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && selectedWords.length > 0) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, selectedWords.length]
  )

  return (
    <div className="mx-auto max-w-2xl w-full space-y-8" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Put the words in order
        </p>
      </div>

      {/* Selected words (answer being built) */}
      <div className="min-h-[60px] rounded-xl border-2 border-muted bg-white/80 p-3 flex flex-wrap gap-2 items-start">
        {selectedWords.length === 0 && (
          <span className="text-muted-foreground text-sm">Tap words below to build the sentence...</span>
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

      {/* Available words to pick from */}
      <div className="flex flex-wrap gap-2 justify-center">
        {availableWords.map((word, i) => (
          <button
            key={`available-${i}`}
            onClick={() => addWord(word, i)}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border-2 border-muted bg-white text-lg font-medium hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={selectedWords.length === 0 || availableWords.length > 0 || isSubmitting}
        className="w-full py-6 text-lg"
      >
        Check Answer
      </Button>
    </div>
  )
}

function TranslationInput({ exercise, onSubmit, isSubmitting }: ExerciseInputProps) {
  return (
    <TextInput
      label="Translate to Dutch"
      prompt={<p>{exercise.prompt}</p>}
      placeholder="Type your answer in Dutch..."
      exerciseId={exercise.exercise_id}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    />
  )
}

function ExerciseInput({ exercise, onSubmit, isSubmitting }: ExerciseInputProps) {
  switch (exercise.type) {
    case 'fill_blank':
      return <FillBlankInput exercise={exercise} onSubmit={onSubmit} isSubmitting={isSubmitting} />
    case 'word_reorder':
      return <WordReorderInput exercise={exercise} onSubmit={onSubmit} isSubmitting={isSubmitting} />
    default:
      return <TranslationInput exercise={exercise} onSubmit={onSubmit} isSubmitting={isSubmitting} />
  }
}

function FeedbackDisplay({
  result,
  exercise,
  userAnswer,
  onNext,
  onFlagIncorrect,
}: {
  result: SubmitWritingResponse
  exercise: WritingExercise
  userAnswer: string
  onNext: () => void
  onFlagIncorrect?: () => Promise<void>
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)
  const [flagged, setFlagged] = useState(false)
  const [flagging, setFlagging] = useState(false)

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

  const handleFlag = useCallback(async () => {
    if (!onFlagIncorrect || flagging || flagged) return
    setFlagging(true)
    try {
      await onFlagIncorrect()
      setFlagged(true)
    } finally {
      setFlagging(false)
    }
  }, [onFlagIncorrect, flagging, flagged])

  return (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="mx-auto max-w-2xl w-full space-y-6 outline-none"
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {exercise.type === 'fill_blank' ? 'Fill in the blank' : exercise.type === 'word_reorder' ? 'Put the words in order' : 'Translate to Dutch'}
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
          <div className="space-y-1">
            <p className="text-sm text-red-600">
              Your answer: <span className="font-medium">{userAnswer}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Correct answer: <span className="font-medium text-foreground">{result.reference_answer}</span>
            </p>
          </div>
        )}
      </div>

      {!result.correct && onFlagIncorrect && (
        <div className="text-center">
          <button
            onClick={handleFlag}
            disabled={flagging || flagged}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {flagged ? 'Flagged — thanks for the feedback' : flagging ? 'Flagging...' : 'My answer was actually correct'}
          </button>
        </div>
      )}

      <Button onClick={onNext} className="w-full py-6 text-lg">
        Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function WritingComplete({
  correctCount,
  totalCount,
  canCompleteMore,
  onCompleteMore,
  isLoadingMore,
}: {
  correctCount: number
  totalCount: number
  canCompleteMore: boolean
  onCompleteMore: () => void
  isLoadingMore: boolean
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
        {canCompleteMore && (
          <Button onClick={onCompleteMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Complete More
          </Button>
        )}
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
  const { token } = useAuth()
  const session = useWritingSession(data?.exercises, !isLoading && !!data)
  const submitWriting = useSubmitWriting()
  const exerciseStartRef = useRef(Date.now())
  const [isLoadingMore, setIsLoadingMore] = useState(false)

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
            session.submitAnswer(result, answer)
          },
        }
      )
    },
    [session, submitWriting]
  )

  const handleCompleteMore = useCallback(async () => {
    if (!token) return
    setIsLoadingMore(true)
    try {
      const result = await apiClient.getWritingQueue(token)
      if (result.exercises.length > 0) {
        session.loadMore(result.exercises)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [token, session])

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
            canCompleteMore={data?.stats?.can_complete_more ?? false}
            onCompleteMore={handleCompleteMore}
            isLoadingMore={isLoadingMore}
          />
        </div>
      </div>
    )
  }

  // Writing + Feedback states
  const lastResult = session.results[session.results.length - 1]
  const lastUserAnswer = session.userAnswers[session.userAnswers.length - 1]

  return (
    <div className="relative flex h-full flex-col">
      <ProgressBar
        current={session.currentIndex + (session.phase === 'feedback' ? 1 : 0)}
        total={session.totalCount}
        correct={session.correctCount}
      />

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {session.phase === 'writing' && session.currentExercise && (
          <ExerciseInput
            exercise={session.currentExercise}
            onSubmit={handleSubmit}
            isSubmitting={submitWriting.isPending}
          />
        )}

        {session.phase === 'feedback' && lastResult && session.currentExercise && (
          <FeedbackDisplay
            result={lastResult}
            exercise={session.exercises[session.currentIndex]}
            userAnswer={lastUserAnswer}
            onNext={session.nextExercise}
            onFlagIncorrect={!lastResult.correct && token ? async () => {
              await apiClient.rejectExercise(token, session.exercises[session.currentIndex].exercise_id, 'Flagged: my answer was correct')
            } : undefined}
          />
        )}
      </div>
    </div>
  )
}
