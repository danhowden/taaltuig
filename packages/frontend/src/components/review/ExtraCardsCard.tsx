import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { glassCard } from '@/lib/styles'

const EXTRA_CARD_OPTIONS = [10, 25, 50] as const

interface ExtraCardsCardProps {
  onContinue: (extraCards: number) => void
  loadingExtraCards?: number | null
}

export function ExtraCardsCard({ onContinue, loadingExtraCards }: ExtraCardsCardProps) {
  const isLoading = loadingExtraCards !== null && loadingExtraCards !== undefined

  return (
    <Card
      className="border border-white/40 rounded-[2rem]"
      style={glassCard}
    >
      <CardContent className="pt-5 space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Don't want to wait? Study extra new cards now
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXTRA_CARD_OPTIONS.map((count) => (
            <Button
              key={count}
              variant={count === 50 ? 'default' : 'outline'}
              onClick={() => onContinue(count)}
              disabled={isLoading}
            >
              {loadingExtraCards === count ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>+{count}</>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
