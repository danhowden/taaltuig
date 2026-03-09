import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PencilLine } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { ExtraCardsCard } from './ExtraCardsCard'

interface ReviewCompleteProps {
  onContinue?: (extraCards: number) => void
  loadingExtraCards?: number | null
  writingExerciseCount?: number
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

export function ReviewComplete({ onContinue, loadingExtraCards, writingExerciseCount }: ReviewCompleteProps) {
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

        {writingExerciseCount !== undefined && writingExerciseCount > 0 && (
          <div className="rounded-2xl bg-white/50 backdrop-blur-sm border border-white/60 p-6 text-center space-y-3">
            <PencilLine className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {writingExerciseCount} writing {writingExerciseCount === 1 ? 'exercise' : 'exercises'} available
            </p>
            <Button asChild>
              <Link to="/writing">Continue to Writing Practice</Link>
            </Button>
          </div>
        )}

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
