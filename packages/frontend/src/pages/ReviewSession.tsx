import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { useSubmitReview } from '@/hooks/useSubmitReview'
import { useReviewSession } from '@/hooks/useReviewSession'
import { useSettings } from '@/hooks/useSettings'
import { FlashCard } from '@/components/review/FlashCard'
import { GradeButtons } from '@/components/review/GradeButtons'
import { ReviewHeader } from '@/components/review/ReviewHeader'
import { TaaltuigLogo } from '@/components/TaaltuigLogo'
import { ReviewComplete } from '@/components/review/ReviewComplete'
import { EmptyState } from '@/components/review/EmptyState'
import { LoadingCards } from '@/components/review/LoadingCards'
import { ExtraCardsCard } from '@/components/review/ExtraCardsCard'
import { WaitingCardIllustration } from '@/components/review/WaitingCardIllustration'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Volume2, VolumeX } from 'lucide-react'
import type { Grade } from '@/types'
import { IS_IOS } from '@/constants/review'

export function ReviewSession() {
  const { data, isLoading: isLoadingQueue } = useReviewQueue()
  const { data: settings } = useSettings()
  const submitReview = useSubmitReview()
  const { toast } = useToast()
  const { token } = useAuth()
  const shouldReduceMotion = useReducedMotion()

  const initialQueue = data?.queue || []
  const isDataLoaded = !isLoadingQueue && !!data
  const session = useReviewSession(initialQueue, isDataLoaded)

  const [autoRead, setAutoRead] = useState(false)

  // Handle grading a card
  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!session.currentCard) return

      const duration = Date.now() - session.startTime
      const cardBeingGraded = session.currentCard
      const gradeTime = Date.now()
      const isAgain = grade === 0

      const reviewData = {
        review_item_id: cardBeingGraded.review_item_id,
        grade,
        duration_ms: duration,
      }

      // Move to next card immediately (optimistic)
      session.moveToNext(grade)

      // Submit to backend
      submitReview.mutate(reviewData, {
        onSuccess: (response) => {
          const intervalDays = response.interval_days
          const intervalMs = intervalDays * 24 * 60 * 60 * 1000
          const hoursUntilDue = intervalMs / (1000 * 60 * 60)

          // Schedule card to return if due within 24 hours
          if (hoursUntilDue < 24 && intervalMs >= 0) {
            const dueDate = new Date(gradeTime + intervalMs).toISOString()
            session.scheduleCard(cardBeingGraded, dueDate, isAgain)
          }
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Failed to save review',
            description: 'Your review could not be saved. Please try again.',
          })
          console.error('Failed to submit review:', error)
          // Card already moved on, nothing more to do
        },
      })
    },
    [session, submitReview, toast]
  )

  // Handle adding extra cards
  const handleContinue = useCallback(
    async (extraCards: number) => {
      if (!token || session.loadingExtraCards !== null) return

      try {
        session.setLoadingExtra(extraCards)
        const response = await apiClient.getReviewQueue(token, { extraNew: extraCards })

        if (response.queue.length === 0) {
          toast({
            title: 'No more NEW cards available',
            description: 'All your cards have been promoted to LEARNING or REVIEW. Create new cards to continue.',
          })
          session.setLoadingExtra(null)
          return
        }

        session.addExtraCards(response.queue)
        toast({
          title: `Added ${response.queue.length} more cards`,
          description: 'Keep up the great work!',
        })
      } catch (error) {
        console.error('Failed to load extra cards:', error)
        toast({
          variant: 'destructive',
          title: 'Failed to load extra cards',
          description: 'Please try again.',
        })
        session.setLoadingExtra(null)
      }
    },
    [token, session, toast]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (!session.showAnswer) {
        if (e.key === ' ') {
          e.preventDefault()
          session.revealAnswer()
        }
      } else {
        if (e.key === '1') handleGrade(0)
        if (e.key === '2') handleGrade(2)
        if (e.key === '3') handleGrade(3)
        if (e.key === '4') handleGrade(4)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [session.showAnswer, handleGrade, session])

  // Timer tick for waiting countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    if (session.phase !== 'waiting') return

    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [session.phase])

  // Calculate waiting seconds
  const waitingSeconds = session.nextWaitingTime
    ? Math.ceil((session.nextWaitingTime.getTime() - Date.now()) / 1000)
    : 0

  // Determine if extra cards are available
  const hasExtraCardsAvailable = data?.stats?.new_count !== undefined

  // ==========================================================================
  // Render based on phase
  // ==========================================================================

  if (isLoadingQueue || !data) {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <LoadingCards />
        </div>
      </div>
    )
  }

  if (session.phase === 'empty') {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <EmptyState
            onContinue={hasExtraCardsAvailable ? handleContinue : undefined}
            loadingExtraCards={session.loadingExtraCards}
          />
        </div>
      </div>
    )
  }

  if (session.phase === 'complete') {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <ReviewComplete
            onContinue={hasExtraCardsAvailable ? handleContinue : undefined}
            loadingExtraCards={session.loadingExtraCards}
          />
        </div>
      </div>
    )
  }

  if (session.phase === 'waiting') {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="mx-auto max-w-2xl space-y-4 md:space-y-6 px-4">
            <div className="text-center pb-1 md:pb-2">
              <WaitingCardIllustration size={100} className="md:w-[160px] md:h-[160px]" />
              <h2 className="text-2xl md:text-4xl font-bold text-black/70">
                Next card in {waitingSeconds}s
              </h2>
              <p className="text-sm md:text-base text-black/50 mt-1">
                Cards marked "Again" come back after their learning interval
              </p>
            </div>

            {hasExtraCardsAvailable && (
              <ExtraCardsCard
                onContinue={handleContinue}
                loadingExtraCards={session.loadingExtraCards}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Phase: reviewing
  return (
    <div className="relative flex h-full flex-col">
      {/* Mobile logo */}
      <div className="flex justify-center pt-4 md:hidden">
        <TaaltuigLogo size={72} animate={false} variant="white" />
      </div>

      {/* Header: centered title + progress */}
      <motion.div
        className="pt-2 md:pt-6 px-4"
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, ease: 'easeOut' }}
      >
        <ReviewHeader
          totalCards={session.totalCards}
          reviewedCount={session.reviewedCount}
          againCount={session.againCount}
          againReviewed={session.againReviewed}
        />
      </motion.div>

      {/* Flash card - centered */}
      <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-4">
        <div className="w-full md:w-[600px]" style={{ perspective: '800px' }}>
          <AnimatePresence mode="wait">
            {session.currentCard && (
              <motion.div
                key={session.currentCard.review_item_id}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -120, rotateY: -35, rotateX: 5, scale: 0.85 }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, x: 0, rotateY: 0, rotateX: 0, scale: 1 }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: 120, rotateY: 35, rotateX: -5, scale: 0.85 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0.15 : 0.35,
                  ease: [0.4, 0, 0.2, 1],
                }}
                style={shouldReduceMotion ? undefined : { transformStyle: 'preserve-3d' }}
              >
                <FlashCard
                  item={session.currentCard}
                  showAnswer={session.showAnswer}
                  onReveal={session.revealAnswer}
                  autoRead={autoRead}
                  showUnreviewedInsights={settings?.show_unreviewed_insights ?? true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Grade buttons at bottom */}
      <div className="px-4 pb-4 md:pb-6">
        <GradeButtons disabled={!session.showAnswer} onGrade={handleGrade} />
      </div>

      {/* Auto-read toggle (non-iOS only, desktop only) */}
      {!IS_IOS && (
        <div className="hidden md:block fixed bottom-8 right-8">
          <Button
            variant={autoRead ? 'default' : 'outline'}
            size="icon"
            onClick={() => setAutoRead(!autoRead)}
            title={autoRead ? 'Auto-read enabled' : 'Auto-read disabled'}
            className="h-12 w-12 rounded-full border border-white/40"
            style={{
              background: autoRead ? undefined : 'rgba(255, 255, 255, 0.65)',
              backdropFilter: autoRead ? undefined : 'blur(20px)',
              WebkitBackdropFilter: autoRead ? undefined : 'blur(20px)',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            {autoRead ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
