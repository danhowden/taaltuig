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
          stroke="rgb(147, 51, 234)"
          strokeWidth="2"
          strokeDasharray="4 3"
          opacity="0.7"
        />

        {/* Face on card */}
        <g style={{ color: 'rgb(147, 51, 234)', opacity: 0.8 }}>
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
}

export function EmptyState({ onContinue, loadingExtraCards }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center pb-2">
        <EmptyCardIllustration size={160} />
        <h2 className="text-4xl font-bold">Geen kaarten</h2>
      </div>

      {onContinue && (
        <ExtraCardsCard
          onContinue={onContinue}
          loadingExtraCards={loadingExtraCards}
        />
      )}
    </div>
  )
}
