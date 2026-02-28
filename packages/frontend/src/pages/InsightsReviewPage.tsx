import { useState, useCallback, useMemo } from 'react'
import { useInsightsQueue, useReviewInsight } from '@/hooks/useInsights'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { LoadingCards } from '@/components/review/LoadingCards'
import { PageLayout } from '@/components/PageLayout'
import { InsightRow } from '@/components/insights/InsightRow'
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

  const reviewedCount = rows.filter(
    (r) => r.reviewedBy === 'human' && r.status !== 'pending'
  ).length
  const totalCount = rows.length

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

  // Content below the header
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
    content = (
      <PageLayout.Content className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs text-muted-foreground uppercase tracking-wide"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
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
            onValueChange={(v) => setFilterStatus(v as FilterStatus)}
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
