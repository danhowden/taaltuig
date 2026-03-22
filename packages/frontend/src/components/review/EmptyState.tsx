import { ExtraCardsCard } from './ExtraCardsCard'

function EmptyCardIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="mx-auto -mb-2"
    >
      <g style={{ transform: 'rotate(-5deg)', transformOrigin: '50px 50px' }}>
        {/* Single dashed card */}
        <rect
          x="25"
          y="32"
          width="50"
          height="35"
          rx="6"
          fill="none"
          stroke="rgb(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 3"
          opacity="0.7"
        />

        {/* Face on card */}
        <g style={{ color: 'rgb(var(--primary))', opacity: 0.8 }}>
          {/* Left eye - exclamation mark */}
          <circle
            cx="40"
            cy="45"
            r="2"
            fill="currentColor"
          />
          <line
            x1="40"
            y1="49"
            x2="40"
            y2="53"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Right eye - exclamation mark */}
          <circle
            cx="60"
            cy="45"
            r="2"
            fill="currentColor"
          />
          <line
            x1="60"
            y1="49"
            x2="60"
            y2="53"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Slight frown / neutral mouth */}
          <path
            d="M44 60 Q50 58 56 60"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  )
}

interface EmptyStateProps {
  onContinue?: (extraCards: number) => void
  loadingExtraCards?: number | null
  vocabExperienced?: number
  vocabLearned?: number
  totalReviews?: number
}

export function EmptyState({ onContinue, loadingExtraCards, vocabExperienced, vocabLearned, totalReviews }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center pb-2">
        <EmptyCardIllustration size={160} />
        <h2 className="text-4xl font-bold">Geen kaarten</h2>
      </div>

      {(totalReviews !== undefined || vocabExperienced !== undefined || vocabLearned !== undefined) && (
        <div className="rounded-2xl bg-white/50 backdrop-blur-sm border border-white/60 p-6">
          <div className="grid grid-cols-3 gap-4">
            {totalReviews !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-bold text-black/80">{totalReviews.toLocaleString()}</div>
                <div className="text-sm text-black/60 mt-1">Total Reviews</div>
              </div>
            )}
            {vocabExperienced !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-bold text-black/80">{vocabExperienced}</div>
                <div className="text-sm text-black/60 mt-1">Vocab Experienced</div>
              </div>
            )}
            {vocabLearned !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{vocabLearned}</div>
                <div className="text-sm text-black/60 mt-1">Vocab Learned</div>
              </div>
            )}
          </div>
        </div>
      )}

      {onContinue && (
        <ExtraCardsCard
          onContinue={onContinue}
          loadingExtraCards={loadingExtraCards}
        />
      )}
    </div>
  )
}
