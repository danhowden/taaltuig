import { motion } from 'framer-motion'

interface LoadingCardsProps {
  message?: string
}

export function LoadingCards({ message }: LoadingCardsProps) {
  const uniqueId = Math.random().toString(36).substring(7)

  return (
    <div className="flex flex-col items-center gap-6">
      <svg
        viewBox="0 0 100 100"
        width={200}
        height={200}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient
            id={`loadingGrad1-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(168, 85, 247)" />
            <stop offset="100%" stopColor="rgb(147, 51, 234)" />
          </linearGradient>
          <linearGradient
            id={`loadingGrad2-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(147, 51, 234)" />
            <stop offset="100%" stopColor="rgb(126, 34, 206)" />
          </linearGradient>
          <linearGradient
            id={`loadingGrad3-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(126, 34, 206)" />
            <stop offset="100%" stopColor="rgb(107, 33, 168)" />
          </linearGradient>
          <filter id={`cardShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgb(139, 92, 246)" floodOpacity="0.2" />
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgb(0, 0, 0)" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Back card - rotating */}
        <motion.rect
          x="22"
          y="18"
          width="50"
          height="35"
          rx="6"
          fill={`url(#loadingGrad1-${uniqueId})`}
          filter={`url(#cardShadow-${uniqueId})`}
          style={{ transformOrigin: '47px 35px', opacity: 0.7 }}
          animate={{
            rotate: [-8, -15, -8],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Middle card - rotating opposite direction */}
        <motion.rect
          x="25"
          y="32"
          width="50"
          height="35"
          rx="6"
          fill={`url(#loadingGrad2-${uniqueId})`}
          filter={`url(#cardShadow-${uniqueId})`}
          style={{ transformOrigin: '50px 50px', opacity: 0.85 }}
          animate={{
            rotate: [3, 8, 3],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.3,
          }}
        />

        {/* Front card - bouncing */}
        <motion.g
          animate={{
            y: [0, -8, 0],
            rotate: [0, -3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.6,
          }}
          style={{ transformOrigin: '53px 65px' }}
        >
          <rect
            x="28"
            y="48"
            width="50"
            height="35"
            rx="6"
            fill={`url(#loadingGrad3-${uniqueId})`}
            filter={`url(#cardShadow-${uniqueId})`}
          />

          {/* Animated blinking face */}
          <motion.g
            animate={{
              opacity: [0.95, 1, 0.95],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Eyes that blink */}
            <motion.g
              animate={{
                scaleY: [1, 0.1, 1, 1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                times: [0, 0.1, 0.2, 0.8, 1],
              }}
              style={{ transformOrigin: '42px 60px' }}
            >
              <circle cx="42" cy="60" r="2.5" fill="rgb(252, 252, 252)" />
            </motion.g>

            <motion.g
              animate={{
                scaleY: [1, 0.1, 1, 1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                times: [0, 0.1, 0.2, 0.8, 1],
              }}
              style={{ transformOrigin: '54px 60px' }}
            >
              <circle cx="54" cy="60" r="2.5" fill="rgb(252, 252, 252)" />
            </motion.g>

            {/* Smile */}
            <path
              d="M44 68 Q48 72 52 68"
              stroke="rgb(252, 252, 252)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </motion.g>
        </motion.g>
      </svg>

      {message && (
        <motion.p
          className="text-muted-foreground text-lg"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {message}
        </motion.p>
      )}
    </div>
  )
}
