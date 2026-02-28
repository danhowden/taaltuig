const STATUS_STYLES = {
  approved: 'bg-green-100 text-green-800',
  awaiting_review: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-blue-100 text-blue-800',
} as const

const STATUS_LABELS = {
  approved: 'Approved',
  awaiting_review: 'Awaiting review',
  rejected: 'Rejected',
  pending: 'Pending',
} as const

type DisplayStatus = keyof typeof STATUS_STYLES

export function getDisplayStatus(status: string, reviewedBy?: string): DisplayStatus {
  if (reviewedBy === 'human' && status !== 'pending') return 'approved'
  if (status === 'approved' && reviewedBy === 'ai') return 'awaiting_review'
  if (status === 'rejected') return 'rejected'
  return 'pending'
}

interface InsightStatusBadgeProps {
  status: string
  reviewedBy?: string
}

export function InsightStatusBadge({ status, reviewedBy }: InsightStatusBadgeProps) {
  const displayStatus = getDisplayStatus(status, reviewedBy)

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[displayStatus]}`}
    >
      {STATUS_LABELS[displayStatus]}
    </span>
  )
}
