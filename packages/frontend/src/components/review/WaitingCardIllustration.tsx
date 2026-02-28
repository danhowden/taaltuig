interface WaitingCardIllustrationProps {
  size?: number
  className?: string
}

export function WaitingCardIllustration({ size = 160, className }: WaitingCardIllustrationProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mx-auto -mb-2 ${className ?? ''}`}
    >
      <g style={{ transform: 'rotate(3deg)', transformOrigin: '50px 50px' }}>
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

        {/* Face on card - waiting/patient expression */}
        <g style={{ color: 'rgb(147, 51, 234)', opacity: 0.8 }}>
          {/* Left eye - horizontal line (patient/waiting look) */}
          <line
            x1="37"
            y1="47"
            x2="43"
            y2="47"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Right eye - horizontal line */}
          <line
            x1="57"
            y1="47"
            x2="63"
            y2="47"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Neutral/patient mouth - straight line */}
          <line
            x1="44"
            y1="58"
            x2="56"
            y2="58"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  )
}
