import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface ReviewHeaderProps {
  totalCards: number
  reviewedCount: number
  againCount: number
  againReviewed: number
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

export function ReviewHeader({ totalCards, reviewedCount, againCount, againReviewed }: ReviewHeaderProps) {
  const shouldReduceMotion = useReducedMotion()

  // Unique cards completed (not counting repeats)
  const uniqueCompleted = Math.min(reviewedCount - againReviewed, totalCards)

  // Total reviews in session
  const totalReviews = totalCards + againCount

  // Calculate widths as percentages of total bar
  const uniqueWidth = totalReviews > 0 ? (totalCards / totalReviews) * 100 : 100
  const againWidth = totalReviews > 0 ? (againCount / totalReviews) * 100 : 0

  // Progress within each segment
  const uniqueProgress = totalCards > 0 ? (uniqueCompleted / totalCards) * 100 : 0
  const againProgress = againCount > 0 ? (againReviewed / againCount) * 100 : 0

  // Remaining cards counter
  const remaining = totalReviews - reviewedCount
  const digits = String(remaining).split('')

  return (
    <div className="text-center">
      {/* Title + counter combined */}
      <div className="flex items-baseline justify-center gap-2">
        <h1
          className="text-lg font-semibold tracking-wide text-white uppercase"
          style={{ textShadow: '0 2px 8px rgba(118, 2, 215, 0.5), 0 1px 2px rgba(0, 0, 0, 0.1)' }}
        >
          Review
        </h1>
        <span className="text-white/60">·</span>
        <p className="text-lg font-light text-white/80 flex items-baseline">
          <span className="font-medium inline-flex">
            {digits.map((digit, index) => (
              <AnimatedDigit
                key={`${index}-${digits.length}`}
                digit={digit}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
          </span>
          <span className="ml-1 text-white/60">to go</span>
        </p>
      </div>

      {/* Progress bar - centered, max width */}
      <div className="mt-3 mx-auto max-w-xs md:max-w-sm">
        <div
          className="flex h-2 md:h-1.5 w-full overflow-hidden rounded-full bg-white/40 md:bg-white/20 backdrop-blur-sm"
          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1), 0 0 0 2px rgba(255,255,255,0.5)' }}
        >
          {/* Unique cards segment */}
          <div className="relative" style={{ width: `${uniqueWidth}%` }}>
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#8B10E0] to-[#B840E8] transition-all duration-500 ease-out"
              style={{ width: `${uniqueProgress}%` }}
            />
          </div>

          {/* AGAIN cards segment */}
          {againCount > 0 && (
            <div
              className="relative border-l border-white/30"
              style={{ width: `${againWidth}%` }}
            >
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500 ease-out"
                style={{ width: `${againProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
