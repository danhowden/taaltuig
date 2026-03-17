import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useApiMutation } from '@/hooks/useApiMutation'
import { apiClient } from '@/lib/api'
import { useWritingQueueCount } from '@/hooks/useWritingSession'
import { PageLayout } from '@/components/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingCards } from '@/components/review/LoadingCards'
import { Input } from '@/components/ui/input'
import { PencilLine, RotateCw, Trash2, Undo2 } from 'lucide-react'
import type { StoredWritingExercise, ExerciseStatus, ExerciseType, GenerateExercisesResponse } from '@/types'

function StatusBadge({ status }: { status: string }) {
  // Coerce legacy 'served'/'validated'/'expired' to pending
  const normalised: ExerciseStatus =
    status === 'failed' || status === 'completed' || status === 'rejected'
      ? status
      : 'pending'

  return (
    <span className="text-[11px] uppercase tracking-wide text-black/50 font-medium">
      {normalised}
    </span>
  )
}

const TYPE_COLORS: Record<ExerciseType, string> = {
  translation: 'bg-blue-100 text-blue-800 border-blue-200',
  fill_blank: 'bg-purple-100 text-purple-800 border-purple-200',
  word_reorder: 'bg-teal-100 text-teal-800 border-teal-200',
  guided_write: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  paragraph_write: 'bg-slate-100 text-slate-800 border-slate-200',
}

function exerciseTypeLabel(type: ExerciseType): string {
  switch (type) {
    case 'translation': return 'Translation'
    case 'fill_blank': return 'Fill-blank'
    case 'word_reorder': return 'Reorder'
    case 'guided_write': return 'Guided'
    case 'paragraph_write': return 'Paragraph'
    default: return type
  }
}

function ExerciseCard({
  exercise,
  onReject,
  onReset,
}: {
  exercise: StoredWritingExercise
  onReject: (exerciseId: string, reason: string) => Promise<void>
  onReset: (exerciseId: string) => Promise<void>
}) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleReject = async () => {
    if (!reason.trim()) return
    setRejecting(true)
    try {
      await onReject(exercise.exercise_id, reason.trim())
    } finally {
      setRejecting(false)
      setShowReject(false)
      setReason('')
    }
  }

  const canReject = exercise.status !== 'completed' && exercise.status !== 'rejected'
  const canReset = exercise.status === 'failed' || exercise.status === 'completed' || exercise.status === 'rejected'

  return (
    <div className={`rounded-[6px] bg-white/60 p-4 space-y-2 ${exercise.status === 'rejected' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${TYPE_COLORS[exercise.type] ?? ''}`}>
            {exerciseTypeLabel(exercise.type)}
          </Badge>
          <StatusBadge status={exercise.status} />
          {exercise.source === 'user_requested' && (
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5 bg-indigo-100 text-indigo-800">
              user requested
            </Badge>
          )}
          {exercise.priority === 'high' && (
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5 bg-orange-100 text-orange-800">
              high priority
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canReset && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-black/10"
              title="Reset to pending"
              disabled={resetting}
              onClick={async () => {
                setResetting(true)
                try { await onReset(exercise.exercise_id) } finally { setResetting(false) }
              }}
            >
              {resetting ? <RotateCw className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
            </Button>
          )}
          {canReject && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-black/10"
              onClick={() => setShowReject(!showReject)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">{exercise.prompt}</p>
        <p className="text-sm text-muted-foreground">
          → {exercise.reference_answer}
        </p>
        {exercise.alternatives.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Alts: {exercise.alternatives.join(', ')}
          </p>
        )}
      </div>

      {exercise.grammar_focus && (
        <p className="text-xs text-muted-foreground">
          Grammar: {exercise.grammar_focus}
        </p>
      )}

      {exercise.attempt && (
        <div className={`rounded-md px-3 py-2 text-xs ${
          exercise.attempt.score > 0
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <span className={exercise.attempt.score > 0 ? 'text-green-700' : 'text-red-700'}>
            {exercise.attempt.score > 0 ? 'Correct' : 'Incorrect'}
          </span>
          <span className="text-muted-foreground"> — answered: </span>
          <span className="font-medium">{exercise.attempt.user_answer}</span>
        </div>
      )}

      {exercise.rejection_reason && (
        <p className="text-xs text-red-600">
          Rejected: {exercise.rejection_reason}
        </p>
      )}

      {exercise.completed_at && (
        <p className="text-xs text-muted-foreground">
          completed {new Date(exercise.completed_at).toLocaleDateString()}
        </p>
      )}

      {showReject && (
        <div className="flex gap-2 pt-1">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleReject()}
          />
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            onClick={handleReject}
            disabled={!reason.trim() || rejecting}
          >
            {rejecting ? 'Rejecting...' : 'Reject'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function ExerciseAdminPage() {
  const { token } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data: queueData } = useWritingQueueCount()

  const generateMutation = useApiMutation<GenerateExercisesResponse, void>({
    mutationFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.generateWritingExercises(token, {})
    },
    showLoader: false,
  })

  // Fetch all exercises once — filtering is client-side
  const { data: allExercises, isLoading, refetch } = useApiQuery<StoredWritingExercise[]>({
    queryKey: ['exercises-admin'],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExercisesList(token, {})
    },
    enabled: !!token,
    staleTime: 10_000,
  })

  // Client-side filtering (normalise legacy 'served'/'validated'/'expired' → 'pending')
  const exercises = useMemo(() => {
    if (!allExercises) return []
    return allExercises.filter((ex) => {
      const effectiveStatus: ExerciseStatus =
        ex.status === 'failed' || ex.status === 'completed' || ex.status === 'rejected'
          ? ex.status
          : 'pending'
      if (statusFilter === 'active' && effectiveStatus !== 'pending' && effectiveStatus !== 'failed') return false
      if (statusFilter !== 'all' && statusFilter !== 'active' && effectiveStatus !== statusFilter) return false
      if (typeFilter !== 'all' && ex.type !== typeFilter) return false
      return true
    })
  }, [allExercises, statusFilter, typeFilter])

  if (isLoading) {
    return (
      <PageLayout>
        <PageLayout.Header title="Exercise Admin" description="Review and manage generated writing exercises" />
        <PageLayout.Content className="flex items-center justify-center">
          <LoadingCards />
        </PageLayout.Content>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Exercise Admin"
        description="Review and manage generated writing exercises"
        actions={
          <div className="flex items-center gap-2">
            {queueData && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                queueData.stats.pool_size < 20
                  ? 'bg-red-100 text-red-700'
                  : 'bg-black/10 text-black/50'
              }`}>
                {queueData.stats.pool_size} available
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate(undefined, { onSuccess: () => refetch() })}
              disabled={generateMutation.isPending}
            >
              <RotateCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              Generate Batch
            </Button>
          </div>
        }
      />

      <PageLayout.Content>
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-medium text-muted-foreground">
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Pending + Failed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Pending + Failed</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="translation">Translation</SelectItem>
                  <SelectItem value="fill_blank">Fill-blank</SelectItem>
                  <SelectItem value="word_reorder">Word reorder</SelectItem>
                  <SelectItem value="guided_write" disabled>Guided write (not yet)</SelectItem>
                  <SelectItem value="paragraph_write" disabled>Paragraph (not yet)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exercise list */}
          {exercises.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.exercise_id}
                  exercise={exercise}
                  onReject={async (exerciseId, reason) => {
                    if (!token) return
                    await apiClient.rejectExercise(token, exerciseId, reason)
                    refetch()
                  }}
                  onReset={async (exerciseId) => {
                    if (!token) return
                    await apiClient.resetExercise(token, exerciseId)
                    refetch()
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PencilLine className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                {allExercises && allExercises.length > 0 ? 'No exercises match this filter' : 'No exercises yet'}
              </p>
            </div>
          )}
        </div>
      </PageLayout.Content>
    </PageLayout>
  )
}
