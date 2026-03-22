import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, ArrowRight, PencilLine, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingCards } from '@/components/review/LoadingCards'
import { SessionLayout } from '@/components/SessionLayout'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import {
  useWritingQueue,
  useWritingSession,
  useSubmitWriting,
} from '@/hooks/useWritingSession'
import type { WritingExercise, SubmitWritingResponse, ChallengeWritingResponse } from '@/types'

function ProgressBar({
  current,
  total,
}: {
  current: number
  total: number
}) {
  const progress = total > 0 ? (current / total) * 100 : 0
  const remaining = Math.max(0, total - current)

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
        {remaining} to go
      </span>
    </div>
  )
}

interface ExerciseInputProps {
  exercise: WritingExercise
  onSubmit: (answer: string) => void
  onPass: () => void
  isSubmitting: boolean
}

function TextInput({
  label,
  prompt,
  placeholder,
  exerciseId,
  onSubmit,
  onPass,
  isSubmitting,
}: {
  label: string
  prompt: React.ReactNode
  placeholder: string
  exerciseId: string
  onSubmit: (answer: string) => void
  onPass: () => void
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
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">
          {label}
        </p>
        <div className="text-2xl font-semibold">{prompt}</div>
      </div>

      <div className="flex items-center gap-2">
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
          className="flex-1 rounded-full border border-transparent bg-white/40 px-5 py-3 text-lg text-black placeholder:text-black/30 focus:border-white focus:outline-none transition-colors"
        />
        <Button
          onClick={handleSubmit}
          disabled={!answer.trim() || isSubmitting}
          className="rounded-full px-6 shrink-0"
        >
          Check
        </Button>
        <Button
          variant="outline"
          onClick={onPass}
          disabled={isSubmitting}
          className="rounded-full px-6 shrink-0"
        >
          Pass
        </Button>
      </div>
    </div>
  )
}

function FillBlankInput({ exercise, onSubmit, onPass, isSubmitting }: ExerciseInputProps) {
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
      onPass={onPass}
      isSubmitting={isSubmitting}
    />
  )
}

function WordReorderInput({ exercise, onSubmit, onPass, isSubmitting }: ExerciseInputProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [availableWords, setAvailableWords] = useState<string[]>([])

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
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border border-black/10 bg-white/60 text-lg font-medium hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button
          onClick={handleSubmit}
          disabled={selectedWords.length === 0 || availableWords.length > 0 || isSubmitting}
          className="rounded-full px-6 shrink-0"
        >
          Check Answer
        </Button>
        <Button
          variant="outline"
          onClick={onPass}
          disabled={isSubmitting}
          className="rounded-full px-6 shrink-0"
        >
          Pass
        </Button>
      </div>
    </div>
  )
}

function TranslationInput({ exercise, onSubmit, onPass, isSubmitting }: ExerciseInputProps) {
  return (
    <TextInput
      label="Translate to Dutch"
      prompt={<p>{exercise.prompt}</p>}
      placeholder="Type your answer in Dutch..."
      exerciseId={exercise.exercise_id}
      onSubmit={onSubmit}
      onPass={onPass}
      isSubmitting={isSubmitting}
    />
  )
}

function ExerciseInput({ exercise, onSubmit, onPass, isSubmitting }: ExerciseInputProps) {
  switch (exercise.type) {
    case 'fill_blank':
      return <FillBlankInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} isSubmitting={isSubmitting} />
    case 'word_reorder':
      return <WordReorderInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} isSubmitting={isSubmitting} />
    default:
      return <TranslationInput exercise={exercise} onSubmit={onSubmit} onPass={onPass} isSubmitting={isSubmitting} />
  }
}

function FeedbackDisplay({
  result,
  exercise,
  userAnswer,
  onNext,
  onChallenge,
}: {
  result: SubmitWritingResponse
  exercise: WritingExercise
  userAnswer: string
  onNext: () => void
  onChallenge?: () => Promise<ChallengeWritingResponse>
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)
  const [challengeResult, setChallengeResult] = useState<ChallengeWritingResponse | null>(null)
  const [isChallenging, setIsChallenging] = useState(false)

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

  const handleChallenge = useCallback(async () => {
    if (!onChallenge || isChallenging || challengeResult) return
    setIsChallenging(true)
    try {
      const cr = await onChallenge()
      setChallengeResult(cr)
    } finally {
      setIsChallenging(false)
    }
  }, [onChallenge, isChallenging, challengeResult])

  const typeLabel =
    exercise.type === 'fill_blank'
      ? 'Fill in the blank'
      : exercise.type === 'word_reorder'
        ? 'Put the words in order'
        : 'Translate to Dutch'

  const isCorrect = result.correct || challengeResult?.correct === true
  const feedback = challengeResult ? challengeResult.feedback : result.feedback

  return (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="mx-auto max-w-2xl w-full space-y-6 outline-none"
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-black/40 uppercase tracking-wide">{typeLabel}</p>
        <p className="text-2xl font-semibold">{exercise.prompt}</p>
      </div>

      <div className="rounded-2xl bg-black/40 p-6 space-y-3">
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <Check className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <X className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span className="font-semibold text-white">
            {feedback}
          </span>
        </div>
        <div className="space-y-1">
          {!result.correct && (
            <p className="text-sm text-white/50">
              Your answer: <span className="font-medium text-white/70">{userAnswer || '(passed)'}</span>
            </p>
          )}
          <p className="text-sm text-white/50">
            Correct answer: <span className="font-medium text-white">{result.reference_answer}</span>
          </p>
        </div>
      </div>

      {!result.correct && !challengeResult && onChallenge && userAnswer && (
        <div className="text-center">
          <button
            onClick={handleChallenge}
            disabled={isChallenging}
            className="text-xs text-black/30 hover:text-black/50 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {isChallenging ? 'Asking AI...' : 'Challenge this assessment'}
          </button>
        </div>
      )}

      <Button onClick={onNext} className="w-full rounded-full py-6 text-lg">
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

function EmptyState({ reason }: { reason: 'limit_reached' | 'no_exercises' }) {
  if (reason === 'limit_reached') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <PencilLine className="h-12 w-12 mx-auto text-primary" />
        <h2 className="text-2xl font-bold">All done for today</h2>
        <p className="text-muted-foreground">
          You've reached your daily writing limit. Come back tomorrow — any exercises you got wrong will be waiting for you.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 text-center">
      <PencilLine className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-2xl font-bold">Generating exercises…</h2>
      <p className="text-muted-foreground">
        Your first batch of exercises is being generated. Check back in a moment.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
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

  const handlePass = useCallback(() => {
    handleSubmit('')
  }, [handleSubmit])

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

  if (isLoading || !data) {
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <LoadingCards />
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  if (session.phase === 'empty') {
    const emptyReason = data?.stats?.exercises_remaining === 0 ? 'limit_reached' : 'no_exercises'
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <EmptyState reason={emptyReason} />
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  if (session.phase === 'complete') {
    return (
      <SessionLayout>
        <SessionLayout.Center>
          <WritingComplete
            correctCount={session.correctCount}
            totalCount={session.totalCount}
            canCompleteMore={data?.stats?.can_complete_more ?? false}
            onCompleteMore={handleCompleteMore}
            isLoadingMore={isLoadingMore}
          />
        </SessionLayout.Center>
      </SessionLayout>
    )
  }

  const lastResult = session.results[session.results.length - 1]
  const lastUserAnswer = session.userAnswers[session.userAnswers.length - 1]

  return (
    <SessionLayout>
      {/* Centered exercise content */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {session.phase === 'writing' && session.currentExercise && (
          <ExerciseInput
            exercise={session.currentExercise}
            onSubmit={handleSubmit}
            onPass={handlePass}
            isSubmitting={submitWriting.isPending}
          />
        )}

        {session.phase === 'feedback' && lastResult && session.currentExercise && (
          <FeedbackDisplay
            result={lastResult}
            exercise={session.exercises[session.currentIndex]}
            userAnswer={lastUserAnswer}
            onNext={session.nextExercise}
            onChallenge={!lastResult.correct && lastUserAnswer && token ? async () => {
              return apiClient.challengeWritingAssessment(token, {
                exercise_id: session.exercises[session.currentIndex].exercise_id,
                user_answer: lastUserAnswer,
              })
            } : undefined}
          />
        )}
      </div>

      {/* Progress pinned to bottom */}
      <div className="pb-3">
        <ProgressBar
          current={session.currentIndex + (session.phase === 'feedback' ? 1 : 0)}
          total={session.totalCount}
        />
      </div>
    </SessionLayout>
  )
}
