import { useState, useCallback, useMemo } from 'react'
import { useInsightsQueue, useReviewInsight } from '@/hooks/useInsights'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { LoadingCards } from '@/components/review/LoadingCards'
import { PageLayout } from '@/components/PageLayout'
import { InsightRow } from '@/components/insights/InsightRow'
import { Check, X } from 'lucide-react'
import type { InsightType } from '@/types'

type FilterStatus = 'ai_approved' | 'pending' | 'all'

export interface FlatInsightRow {
  cardId: string
  front: string
  back: string
  insightIndex: number
  type: InsightType
  content: string
  status: string
  reviewedBy?: string
  isFirstForCard: boolean
}

/** Unique key for a row */
function rowKey(cardId: string, insightIndex: number): string {
  return `${cardId}:${insightIndex}`
}

export function InsightsReviewPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ai_approved')
  const { data, isLoading } = useInsightsQueue(filterStatus)
  const reviewInsight = useReviewInsight()
  const { toast } = useToast()

  const [editingInsight, setEditingInsight] = useState<{
    cardId: string
    index: number
    content: string
  } | null>(null)

  // Bulk selection: tracks insights marked for rejection
  const [rejectedSet, setRejectedSet] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Flatten into one row per insight, sorted by card
  const rows: FlatInsightRow[] = useMemo(() => {
    const cards = data?.cards || []
    const result: FlatInsightRow[] = []
    for (const card of cards) {
      card.insights.forEach((insight, index) => {
        result.push({
          cardId: card.card_id,
          front: card.front,
          back: card.back,
          insightIndex: index,
          type: insight.type,
          content: insight.content,
          status: insight.status,
          reviewedBy: insight.reviewed_by,
          isFirstForCard: index === 0,
        })
      })
    }
    return result
  }, [data?.cards])

  // Rows that still need human review
  const reviewableRows = useMemo(
    () => rows.filter((r) => !(r.reviewedBy === 'human' && r.status !== 'pending')),
    [rows],
  )

  const reviewedCount = rows.length - reviewableRows.length
  const totalCount = rows.length

  // Clear selection when filter changes or data refreshes
  const handleFilterChange = useCallback((v: string) => {
    setFilterStatus(v as FilterStatus)
    setRejectedSet(new Set())
  }, [])

  const toggleRejected = useCallback((cardId: string, insightIndex: number) => {
    const key = rowKey(cardId, insightIndex)
    setRejectedSet((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleReview = useCallback(
    (
      cardId: string,
      insightIndex: number,
      action: 'approve' | 'reject',
    ) => {
      reviewInsight.mutate(
        { cardId, insight_index: insightIndex, action },
        {
          onSuccess: () => {
            toast({ title: `Insight ${action === 'approve' ? 'approved' : 'rejected'}` })
          },
          onError: () => {
            toast({
              variant: 'destructive',
              title: `Failed to ${action} insight`,
            })
          },
        }
      )
    },
    [reviewInsight, toast]
  )

  const handleEdit = useCallback(
    (cardId: string, insightIndex: number, newContent: string) => {
      if (!newContent.trim()) {
        toast({ variant: 'destructive', title: 'Content required' })
        return
      }

      reviewInsight.mutate(
        {
          cardId,
          insight_index: insightIndex,
          action: 'edit',
          content: newContent.trim(),
        },
        {
          onSuccess: () => {
            setEditingInsight(null)
            toast({ title: 'Insight updated' })
          },
          onError: () => {
            toast({
              variant: 'destructive',
              title: 'Failed to update insight',
            })
          },
        }
      )
    },
    [reviewInsight, toast]
  )

  // Bulk: reject selected, approve the rest
  const handleBulkAction = useCallback(async () => {
    if (reviewableRows.length === 0) return

    setIsBulkProcessing(true)
    let approved = 0
    let rejected = 0
    let failed = 0

    // Process sequentially to avoid overwhelming the API
    // Reject selected first (indices shift when deleting, so process in reverse)
    const toReject = reviewableRows
      .filter((r) => rejectedSet.has(rowKey(r.cardId, r.insightIndex)))
      .reverse()
    const toApprove = reviewableRows
      .filter((r) => !rejectedSet.has(rowKey(r.cardId, r.insightIndex)))

    for (const row of toReject) {
      try {
        await new Promise<void>((resolve, reject) => {
          reviewInsight.mutate(
            { cardId: row.cardId, insight_index: row.insightIndex, action: 'reject' },
            { onSuccess: () => resolve(), onError: () => reject() },
          )
        })
        rejected++
      } catch {
        failed++
      }
    }

    for (const row of toApprove) {
      try {
        await new Promise<void>((resolve, reject) => {
          reviewInsight.mutate(
            { cardId: row.cardId, insight_index: row.insightIndex, action: 'approve' },
            { onSuccess: () => resolve(), onError: () => reject() },
          )
        })
        approved++
      } catch {
        failed++
      }
    }

    setRejectedSet(new Set())
    setIsBulkProcessing(false)

    const parts: string[] = []
    if (approved > 0) parts.push(`${approved} approved`)
    if (rejected > 0) parts.push(`${rejected} rejected`)
    if (failed > 0) parts.push(`${failed} failed`)

    toast({
      title: 'Bulk review complete',
      description: parts.join(', '),
      ...(failed > 0 ? { variant: 'destructive' as const } : {}),
    })
  }, [reviewableRows, rejectedSet, reviewInsight, toast])

  // Content
  let content: React.ReactNode

  if (isLoading) {
    content = (
      <div className="flex flex-1 items-center justify-center py-8">
        <LoadingCards />
      </div>
    )
  } else if (rows.length === 0) {
    content = (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-black/70">No insights to review in this queue.</p>
      </div>
    )
  } else {
    const approveCount = reviewableRows.length - rejectedSet.size
    const rejectCount = rejectedSet.size

    content = (
      <PageLayout.Content className="!p-0">
        {/* Bulk action bar */}
        {reviewableRows.length > 0 && (
          <div
            className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-sm"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}
          >
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={rejectedSet.size === reviewableRows.length && reviewableRows.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setRejectedSet(new Set(reviewableRows.map((r) => rowKey(r.cardId, r.insightIndex))))
                  } else {
                    setRejectedSet(new Set())
                  }
                }}
              />
              <span>
                {rejectCount > 0
                  ? `${rejectCount} marked for rejection`
                  : 'Mark bad insights to reject'}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleBulkAction}
              disabled={isBulkProcessing || reviewableRows.length === 0}
            >
              {isBulkProcessing ? (
                'Processing...'
              ) : (
                <>
                  {rejectCount > 0 && (
                    <span className="inline-flex items-center gap-1 mr-1.5">
                      <X className="h-3 w-3" />{rejectCount}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />{approveCount}
                  </span>
                  <span className="ml-1.5">Review all</span>
                </>
              )}
            </Button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs text-muted-foreground uppercase tracking-wide"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
              <th className="px-4 py-2 font-medium w-[40px]"></th>
              <th className="px-4 py-2 font-medium">Card</th>
              <th className="px-4 py-2 font-medium hidden md:table-cell">Type</th>
              <th className="px-4 py-2 font-medium">Content</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Status</th>
              <th className="px-4 py-2 font-medium w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <InsightRow
                key={`${row.cardId}-${row.insightIndex}`}
                row={row}
                editingInsight={
                  editingInsight?.cardId === row.cardId &&
                  editingInsight?.index === row.insightIndex
                    ? editingInsight
                    : null
                }
                isPending={reviewInsight.isPending}
                isRejected={rejectedSet.has(rowKey(row.cardId, row.insightIndex))}
                onToggleRejected={() => toggleRejected(row.cardId, row.insightIndex)}
                onApprove={() => handleReview(row.cardId, row.insightIndex, 'approve')}
                onReject={() => handleReview(row.cardId, row.insightIndex, 'reject')}
                onEdit={(newContent) => handleEdit(row.cardId, row.insightIndex, newContent)}
                onStartEdit={() =>
                  setEditingInsight({
                    cardId: row.cardId,
                    index: row.insightIndex,
                    content: row.content,
                  })
                }
                onEditContentChange={(content) =>
                  setEditingInsight((prev) =>
                    prev ? { ...prev, content } : null
                  )
                }
                onCancelEdit={() => setEditingInsight(null)}
              />
            ))}
          </tbody>
        </table>
      </PageLayout.Content>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Insights Review"
        description={isLoading ? '\u00A0' : `${reviewedCount} of ${totalCount} insights reviewed`}
        actions={
          <Tabs
            value={filterStatus}
            onValueChange={handleFilterChange}
          >
            <TabsList>
              <TabsTrigger value="ai_approved">Awaiting Human Review</TabsTrigger>
              <TabsTrigger value="pending">Awaiting AI Review</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {content}
    </PageLayout>
  )
}
