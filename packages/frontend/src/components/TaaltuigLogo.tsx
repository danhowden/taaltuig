import { useState, useEffect } from 'react'

// Taaltuig color palette
const colors = {
  background: 'rgb(255, 240, 241)',
  foreground: 'rgb(58, 13, 18)',
  secondary: 'rgb(252, 233, 235)',
  primary: 'rgb(255, 71, 86)',
  primaryForeground: 'rgb(252, 252, 252)',
}

// Check for reduced motion preference
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

interface TaaltuigLogoProps {
  size?: number
  animate?: boolean
  showWordmark?: boolean
  darkMode?: boolean
  variant?: 'default' | 'white'
}

export function TaaltuigLogo({
  size = 48,
  animate = true,
  showWordmark = false,
  darkMode = false,
  variant = 'default',
}: TaaltuigLogoProps) {
  const isWhite = variant === 'white'
  const faceColor = isWhite ? 'rgb(126, 34, 206)' : colors.primaryForeground
  const prefersReducedMotion = usePrefersReducedMotion()
  const shouldAnimate = animate && !prefersReducedMotion

  const [isHovered, setIsHovered] = useState(false)
  const [hasEntered, setHasEntered] = useState(!shouldAnimate)
  const uniqueId = useState(() => Math.random().toString(36).substring(7))[0]

  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setHasEntered(true), 100)
      return () => clearTimeout(timer)
    } else {
      setHasEntered(true)
    }
  }, [shouldAnimate])

  return (
    <div
      className="inline-flex items-center cursor-pointer"
      style={{ gap: size * 0.25 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient
            id={`cardGrad1-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={isWhite ? 'rgba(255, 255, 255, 0.95)' : 'rgb(168, 85, 247)'} />
            <stop offset="100%" stopColor={isWhite ? 'rgba(255, 255, 255, 0.85)' : 'rgb(147, 51, 234)'} />
          </linearGradient>
          <linearGradient
            id={`cardGrad2-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={isWhite ? 'rgba(255, 255, 255, 0.95)' : 'rgb(147, 51, 234)'} />
            <stop offset="100%" stopColor={isWhite ? 'rgba(255, 255, 255, 0.9)' : 'rgb(126, 34, 206)'} />
          </linearGradient>
          <linearGradient
            id={`cardGrad3-${uniqueId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={isWhite ? 'rgb(255, 255, 255)' : 'rgb(126, 34, 206)'} />
            <stop offset="100%" stopColor={isWhite ? 'rgba(255, 255, 255, 0.95)' : 'rgb(107, 33, 168)'} />
          </linearGradient>
        </defs>

        {/* Back card */}
        <rect
          x="22"
          y="18"
          width="50"
          height="35"
          rx="6"
          fill={`url(#cardGrad1-${uniqueId})`}
          style={{
            transformOrigin: '47px 35px',
            transform: hasEntered
              ? `rotate(${prefersReducedMotion ? -8 : isHovered ? -12 : -8}deg) scale(${prefersReducedMotion ? 1 : isHovered ? 1.02 : 1})`
              : 'rotate(0deg) scale(0.8)',
            opacity: hasEntered ? 0.6 : 0,
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
          }}
        />

        {/* Middle card */}
        <rect
          x="25"
          y="32"
          width="50"
          height="35"
          rx="6"
          fill={`url(#cardGrad2-${uniqueId})`}
          style={{
            transformOrigin: '50px 50px',
            transform: hasEntered
              ? `rotate(${prefersReducedMotion ? 3 : isHovered ? 6 : 3}deg) scale(${prefersReducedMotion ? 1 : isHovered ? 1.02 : 1})`
              : 'rotate(0deg) scale(0.8)',
            opacity: hasEntered ? 0.8 : 0,
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
            transitionDelay: prefersReducedMotion ? '0s' : '0.05s',
          }}
        />

        {/* Front card */}
        <rect
          x="28"
          y="48"
          width="50"
          height="35"
          rx="6"
          fill={`url(#cardGrad3-${uniqueId})`}
          style={{
            transformOrigin: '53px 65px',
            transform: hasEntered
              ? `rotate(${prefersReducedMotion ? 0 : isHovered ? -3 : 0}deg) scale(${prefersReducedMotion ? 1 : isHovered ? 1.05 : 1})`
              : 'rotate(0deg) scale(0.8)',
            opacity: hasEntered ? 1 : 0,
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
            transitionDelay: prefersReducedMotion ? '0s' : '0.1s',
          }}
        />

        {/* Face on front card */}
        <g
          style={{
            transformOrigin: '53px 65px',
            transform: hasEntered
              ? `rotate(${prefersReducedMotion ? 0 : isHovered ? -3 : 0}deg) scale(${prefersReducedMotion ? 1 : isHovered ? 1.05 : 1})`
              : 'rotate(0deg) scale(0.8)',
            opacity: hasEntered ? 0.95 : 0,
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
            transitionDelay: prefersReducedMotion ? '0s' : '0.15s',
          }}
        >
          {/* Left eye */}
          {isHovered ? (
            <line
              x1="42"
              y1="58"
              x2="42"
              y2="62"
              stroke={faceColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ) : (
            <circle cx="42" cy="60" r="2.5" fill={faceColor} />
          )}

          {/* Right eye */}
          {isHovered ? (
            <line
              x1="54"
              y1="58"
              x2="54"
              y2="62"
              stroke={faceColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ) : (
            <circle cx="54" cy="60" r="2.5" fill={faceColor} />
          )}

          {/* Smile - bigger on hover */}
          <path
            d={isHovered ? 'M42 68 Q48 76 54 68' : 'M44 68 Q48 72 52 68'}
            stroke={faceColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            style={{ transition: 'd 0.2s ease' }}
          />
        </g>
      </svg>

      {showWordmark && (
        <span
          className="font-bold"
          style={{
            fontSize: size * 0.54,
            color: darkMode ? colors.primaryForeground : colors.foreground,
            letterSpacing: '-0.5px',
            opacity: hasEntered ? 1 : 0,
            transition: prefersReducedMotion ? 'none' : 'opacity 0.4s ease',
            transitionDelay: prefersReducedMotion ? '0s' : '0.2s',
          }}
        >
          Taaltuig
        </span>
      )}
    </div>
  )
}
