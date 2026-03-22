import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface ReviewHeaderProps {
  totalCards: number
  reviewedCount: number
  againCount: number
  againReviewed: number
  vocabExperienced?: number
  vocabLearned?: number
}

function AnimatedDigit({ digit, shouldReduceMotion }: { digit: string; shouldReduceMotion: boolean | null }) {
  return (
    <span className="relative inline-block overflow-hidden" style={{ width: '0.6em' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '-100%', opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="inline-block"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function ReviewTitle() {
  return (
    <div className="text-center">
      <h1 className="text-lg font-medium tracking-wide">Review</h1>
    </div>
  )
}

export function ReviewProgress({ totalCards, reviewedCount, againCount, againReviewed, vocabExperienced, vocabLearned }: ReviewHeaderProps) {
  const shouldReduceMotion = useReducedMotion()

  const uniqueCompleted = Math.min(reviewedCount - againReviewed, totalCards)
  const totalReviews = totalCards + againCount
  const uniqueWidth = totalReviews > 0 ? (totalCards / totalReviews) * 100 : 100
  const againWidth = totalReviews > 0 ? (againCount / totalReviews) * 100 : 0
  const uniqueProgress = totalCards > 0 ? (uniqueCompleted / totalCards) * 100 : 0
  const againProgress = againCount > 0 ? (againReviewed / againCount) * 100 : 0
  const remaining = totalReviews - reviewedCount
  const digits = String(remaining).split('')

  return (
    <div className="text-center space-y-2">
      <p className="text-xs text-black/50 flex items-baseline justify-center mb-2">
        <span className="font-medium inline-flex">
          {digits.map((digit, index) => (
            <AnimatedDigit
              key={`${index}-${digits.length}`}
              digit={digit}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </span>
        <span className="ml-1">to go</span>
      </p>

      <div className="mx-auto max-w-xs md:max-w-sm">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div className="relative" style={{ width: `${uniqueWidth}%` }}>
            <div
              className="absolute left-0 top-0 h-full bg-black/80 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${uniqueProgress}%` }}
            />
          </div>

          {againCount > 0 && (
            <div className="relative" style={{ width: `${againWidth}%` }}>
              <div
                className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${againProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {(vocabExperienced !== undefined || vocabLearned !== undefined) && (
        <div className="flex items-center justify-center gap-4 text-xs text-black/50">
          {vocabExperienced !== undefined && (
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-black/70">{vocabExperienced}</span>
              <span>experienced</span>
            </div>
          )}
          {vocabLearned !== undefined && (
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-primary">{vocabLearned}</span>
              <span>learned</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
