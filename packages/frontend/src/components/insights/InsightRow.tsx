import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { InsightStatusBadge, getDisplayStatus } from './InsightStatusBadge'
import { InsightEditForm } from './InsightEditForm'
import { InsightActions } from './InsightActions'
import { INSIGHT_TYPE_LABELS } from './constants'
import type { FlatInsightRow } from '@/pages/InsightsReviewPage'

interface InsightRowProps {
  row: FlatInsightRow
  editingInsight: { content: string } | null
  isPending: boolean
  onApprove: () => void
  onReject: () => void
  onEdit: (content: string) => void
  onStartEdit: () => void
  onEditContentChange: (content: string) => void
  onCancelEdit: () => void
}

export function InsightRow({
  row,
  editingInsight,
  isPending,
  onApprove,
  onReject,
  onEdit,
  onStartEdit,
  onEditContentChange,
  onCancelEdit,
}: InsightRowProps) {
  const isEditing = editingInsight !== null
  const displayStatus = getDisplayStatus(row.status, row.reviewedBy)
  const isHumanReviewed = displayStatus === 'approved'
  const needsReview = displayStatus !== 'approved'

  return (
    <tr
      className={cn(
        'hover:bg-black/[0.02] transition-colors',
        isHumanReviewed && 'opacity-50',
      )}
      style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
    >
      {/* Card name - only show for first insight of each card */}
      <td className="px-4 py-2.5 align-top">
        {row.isFirstForCard ? (
          <div>
            <span className="font-medium">{row.front}</span>
            <span className="text-muted-foreground mx-1">→</span>
            <span className="text-muted-foreground">{row.back}</span>
          </div>
        ) : null}
      </td>

      {/* Type badge - desktop */}
      <td className="px-4 py-2.5 align-top hidden md:table-cell">
        <Badge variant="outline" className="text-xs whitespace-nowrap border-black/15">
          {INSIGHT_TYPE_LABELS[row.type]}
        </Badge>
      </td>

      {/* Content */}
      <td className="px-4 py-2.5 align-top">
        {isEditing ? (
          <InsightEditForm
            content={editingInsight.content}
            isPending={isPending}
            onContentChange={onEditContentChange}
            onSave={() => onEdit(editingInsight.content)}
            onCancel={onCancelEdit}
          />
        ) : (
          <div>
            <span className="md:hidden">
              <Badge variant="outline" className="text-xs mr-2 border-black/15">
                {INSIGHT_TYPE_LABELS[row.type]}
              </Badge>
            </span>
            {row.content}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 align-top hidden sm:table-cell">
        <InsightStatusBadge status={row.status} reviewedBy={row.reviewedBy} />
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5 align-top">
        {needsReview && !isEditing && (
          <InsightActions
            isPending={isPending}
            onApprove={onApprove}
            onReject={onReject}
            onStartEdit={onStartEdit}
          />
        )}
      </td>
    </tr>
  )
}
