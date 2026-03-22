import { Badge } from '@/components/ui/badge'
import type { CardInsight } from '@/types'

interface InsightBadgesProps {
  insights: CardInsight[]
}

export function InsightBadges({ insights }: InsightBadgesProps) {
  const approvedCount = insights.filter((i) => i.status === 'approved').length
  const pendingCount = insights.filter((i) => i.status === 'pending').length

  return (
    <>
      {approvedCount > 0 && (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-800 hover:bg-green-200"
        >
          {approvedCount} approved
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
        >
          {pendingCount} pending
        </Badge>
      )}
    </>
  )
}

export function InsightHoverContent({ insights }: InsightBadgesProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Insights</h4>
      <div className="space-y-2">
        {insights
          .filter((i) => i.status !== 'rejected')
          .map((insight, idx) => (
            <div key={idx} className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1 py-0 h-4 ${
                    insight.status === 'approved'
                      ? 'border-green-500 text-green-700'
                      : 'border-yellow-500 text-yellow-700'
                  }`}
                >
                  {insight.type}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {insight.status}
                </span>
              </div>
              <p className="text-muted-foreground pl-1">{insight.content}</p>
            </div>
          ))}
      </div>
    </div>
  )
}
