import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QueueItem, CardInsight } from '@/types'

interface FlashCardProps {
  item: QueueItem
  showAnswer: boolean
  onReveal: () => void
  autoRead?: boolean
  showUnreviewedInsights?: boolean
}

export function FlashCard({
  item,
  showAnswer,
  onReveal,
  autoRead = false,
  showUnreviewedInsights = true,
}: FlashCardProps) {
  // The database already stores the correct front/back for each direction
  // Forward: front=Dutch, back=English
  // Reverse: front=English, back=Dutch
  const frontText = item.front
  const backText = item.back

  // Determine which text is Dutch based on direction
  const dutchText = item.direction === 'forward' ? frontText : backText

  const speakDutch = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(dutchText)
      utterance.lang = 'nl-NL'
      utterance.rate = 0.9 // Slightly slower for language learning
      window.speechSynthesis.speak(utterance)
    }
  }

  // Auto-read when Dutch is shown
  useEffect(() => {
    if (!autoRead) return

    // Forward cards: read when card is shown (Dutch is front)
    // Reverse cards: read when answer is revealed (Dutch is back)
    const shouldAutoRead =
      item.direction === 'forward' || (item.direction === 'reverse' && showAnswer)

    if (shouldAutoRead && 'speechSynthesis' in window) {
      // Small delay to let the card animation settle
      const timer = setTimeout(() => {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(dutchText)
        utterance.lang = 'nl-NL'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }, 400)

      return () => {
        clearTimeout(timer)
        window.speechSynthesis.cancel()
      }
    }
  }, [autoRead, showAnswer, dutchText, item.direction])

  const glassStyles = {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(118, 2, 215, 0.2), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* 3D flip container with perspective */}
      <div className="[perspective:1200px]">
        <div
          className="relative w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{
            transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front face */}
          <Card
            className={`w-full border border-white/40 rounded-[2rem] [backface-visibility:hidden] ${!showAnswer ? 'shimmer-border motion-reduce:shimmer-border-static' : ''}`}
            style={glassStyles}
          >
            <CardContent className="relative flex min-h-[250px] md:min-h-[300px] items-center justify-center p-6 md:p-12">
              <div onClick={onReveal} className="w-full cursor-pointer text-center">
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
                  <p className="text-2xl md:text-4xl font-extrabold tracking-tight">{frontText}</p>
                  {item.direction === 'forward' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        speakDutch()
                      }}
                      className="h-10 w-10"
                      title="Speak Dutch"
                    >
                      <Volume2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                <Button onClick={onReveal} className="mt-4">
                  Show Answer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Back face - rotated 180deg so it shows correctly when flipped */}
          <Card
            className="absolute inset-0 w-full border border-white/40 rounded-[2rem] [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={glassStyles}
          >
            <CardContent className="relative flex min-h-[250px] md:min-h-[300px] items-center justify-center p-6 md:p-12">
              <div className="w-full text-center">
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-4">
                  <p className="text-xl md:text-3xl font-extrabold tracking-tight text-muted-foreground">
                    {frontText}
                  </p>
                  {item.direction === 'forward' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={speakDutch}
                      className="h-8 w-8 md:h-9 md:w-9"
                      title="Speak Dutch"
                    >
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="my-4 md:my-6 h-0.5 bg-gradient-to-r from-transparent via-[#7602D7] to-transparent" />
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
                  <p className="text-xl md:text-3xl font-extrabold tracking-tight">{backText}</p>
                  {item.direction === 'reverse' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={speakDutch}
                      className="h-8 w-8 md:h-9 md:w-9"
                      title="Speak Dutch"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {item.explanation && (
                  <p className="mt-4 md:mt-6 text-sm text-muted-foreground max-w-lg mx-auto">
                    {item.explanation}
                  </p>
                )}
                {/* AI Insights */}
                <InsightsDisplay
                  insights={item.insights}
                  showUnreviewed={showUnreviewedInsights}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  compound: 'Compound',
  verb_forms: 'Verb',
  root: 'Root',
  pronunciation: 'Sound',
  confusable: 'Warning',
  example: 'Example',
}

function InsightsDisplay({
  insights,
  showUnreviewed,
}: {
  insights?: CardInsight[]
  showUnreviewed: boolean
}) {
  if (!insights || insights.length === 0) return null

  // Filter insights based on settings
  const visibleInsights = insights.filter((insight) => {
    if (insight.status === 'rejected') return false
    if (insight.status === 'pending') return false
    if (insight.status === 'approved') {
      // Show if human-reviewed, or if showUnreviewed is true
      return insight.reviewed_by === 'human' || showUnreviewed
    }
    return false
  })

  if (visibleInsights.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-border/30 max-w-lg mx-auto">
      {visibleInsights.map((insight, i) => {
        const isHumanReviewed = insight.reviewed_by === 'human'
        const label = INSIGHT_TYPE_LABELS[insight.type] || insight.type
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 text-sm',
              i > 0 && 'mt-2',
              !isHumanReviewed && 'text-muted-foreground'
            )}
          >
            <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wide bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">
              {label}
            </span>
            <span
              className={cn(
                !isHumanReviewed && 'border-b border-dashed border-muted-foreground/50'
              )}
            >
              {insight.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}
