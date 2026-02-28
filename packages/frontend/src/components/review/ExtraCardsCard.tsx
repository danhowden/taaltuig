import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ExtraCardsCardProps {
  onContinue: (extraCards: number) => void
  loadingExtraCards?: number | null
}

const glassStyles = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
}

export function ExtraCardsCard({ onContinue, loadingExtraCards }: ExtraCardsCardProps) {
  const isLoading = loadingExtraCards !== null && loadingExtraCards !== undefined

  return (
    <Card
      className="border border-white/40 rounded-[2rem]"
      style={glassStyles}
    >
      <CardContent className="pt-5 space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Don't want to wait? Study extra new cards now
        </p>
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            onClick={() => onContinue(3)}
            disabled={isLoading}
          >
            {loadingExtraCards === 3 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>+3</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onContinue(10)}
            disabled={isLoading}
          >
            {loadingExtraCards === 10 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>+10</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onContinue(25)}
            disabled={isLoading}
          >
            {loadingExtraCards === 25 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>+25</>
            )}
          </Button>
          <Button
            onClick={() => onContinue(50)}
            disabled={isLoading}
          >
            {loadingExtraCards === 50 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>+50</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
