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
import { PencilLine, Check, Circle, Clock, Ban, RotateCw, Trash2, Undo2 } from 'lucide-react'
import type { StoredWritingExercise, ExerciseStatus, ExerciseType, GenerateExercisesResponse } from '@/types'

function StatusBadge({ status }: { status: ExerciseStatus }) {
  const config: Record<ExerciseStatus, { className: string; icon: typeof Check }> = {
    pending: { className: 'bg-yellow-100 text-yellow-800', icon: Circle },
    validated: { className: 'bg-blue-100 text-blue-800', icon: Check },
    served: { className: 'bg-purple-100 text-purple-800', icon: Clock },
    completed: { className: 'bg-green-100 text-green-800', icon: Check },
    expired: { className: 'bg-gray-100 text-gray-600', icon: Clock },
    rejected: { className: 'bg-red-100 text-red-800', icon: Ban },
  }

  const { className, icon: Icon } = config[status] || config.pending

  return (
    <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 h-5 ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  )
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
  const canReset = exercise.status === 'served' || exercise.status === 'completed' || exercise.status === 'rejected'

  return (
    <div className={`rounded-lg border bg-white/60 p-4 space-y-2 ${exercise.status === 'rejected' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
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
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(exercise.generated_at).toLocaleDateString()}
          </span>
          {canReset && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
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
              className="h-6 w-6 text-destructive hover:text-destructive"
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{exercise.target_vocabulary.length} target words</span>
        {exercise.completed_at && (
          <span>· completed {new Date(exercise.completed_at).toLocaleDateString()}</span>
        )}
      </div>

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
  const [statusFilter, setStatusFilter] = useState<string>('all')
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

  // Client-side filtering
  const exercises = useMemo(() => {
    if (!allExercises) return []
    return allExercises.filter((ex) => {
      if (statusFilter !== 'all' && ex.status !== statusFilter) return false
      if (typeFilter !== 'all' && ex.type !== typeFilter) return false
      return true
    })
  }, [allExercises, statusFilter, typeFilter])

  // Status counts from full dataset
  const statusCounts = useMemo(() => {
    if (!allExercises) return {} as Record<string, number>
    return allExercises.reduce((acc, ex) => {
      acc[ex.status] = (acc[ex.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [allExercises])

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(undefined, { onSuccess: () => refetch() })}
            disabled={generateMutation.isPending}
          >
            <RotateCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            Generate Batch
          </Button>
        }
      />

      <PageLayout.Content>
        <div className="space-y-4">
          {/* Pool status */}
          {queueData && (
            <div className={`rounded-lg border p-3 flex items-center justify-between ${
              queueData.stats.pool_size < 20
                ? 'border-orange-200 bg-orange-50/60'
                : 'border-green-200 bg-green-50/60'
            }`}>
              <div>
                <p className="text-sm font-medium">
                  Pool: {queueData.stats.pool_size} available
                </p>
                <p className="text-xs text-muted-foreground">
                  {queueData.stats.exercises_today} done today · {queueData.stats.exercises_remaining} remaining today
                </p>
              </div>
              <Badge variant={queueData.stats.pool_size < 20 ? 'destructive' : 'secondary'} className="text-xs">
                {queueData.stats.pool_size < 20 ? 'Low' : 'Healthy'}
              </Badge>
            </div>
          )}

          {/* Status summary + filters */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(statusCounts).map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    statusFilter === status
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border hover:border-foreground/50'
                  }`}
                >
                  {status} {count}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
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
            <div className="space-y-2">
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
