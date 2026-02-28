import { useEffect, useState, useRef } from 'react'
import confetti from 'canvas-confetti'
import { ExtraCardsCard } from './ExtraCardsCard'

interface ReviewCompleteProps {
  onContinue?: (extraCards: number) => void
  loadingExtraCards?: number | null
}

const dutchPhrases = [
  'Goed gedaan!',
  'Prima werk!',
  'Uitstekend!',
  'Fantastisch!',
  'Geweldig!',
]

// Dutch flag colors
const dutchColors = ['#AE1C28', '#FFFFFF', '#21468B']

export function ReviewComplete({ onContinue, loadingExtraCards }: ReviewCompleteProps) {
  const [phrase] = useState(() => dutchPhrases[Math.floor(Math.random() * dutchPhrases.length)])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Create confetti instance bound to our canvas
    const myConfetti = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    })

    // Fire confetti from both sides
    const fireConfetti = () => {
      myConfetti({
        particleCount: 100,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.6 },
        colors: dutchColors,
        ticks: 300,
        decay: 0.92,
        gravity: 0.8,
      })
      myConfetti({
        particleCount: 100,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.6 },
        colors: dutchColors,
        ticks: 300,
        decay: 0.92,
        gravity: 0.8,
      })
    }

    // Initial burst
    fireConfetti()

    // Additional bursts for a longer celebration
    const timeouts = [
      setTimeout(fireConfetti, 300),
      setTimeout(fireConfetti, 600),
      setTimeout(fireConfetti, 1000),
    ]

    return () => {
      timeouts.forEach(clearTimeout)
      myConfetti.reset()
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          width: '100%',
          height: '100%',
          clipPath: 'inset(30px round 24px)',
        }}
      />
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center pb-8">
          <h2 className="text-4xl font-bold">{phrase}</h2>
        </div>

        {onContinue && (
          <ExtraCardsCard
            onContinue={onContinue}
            loadingExtraCards={loadingExtraCards}
          />
        )}
      </div>
    </>
  )
}
