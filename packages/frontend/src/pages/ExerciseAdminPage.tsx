import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingCards } from '@/components/review/LoadingCards'
import { PencilLine, Check, Circle, Clock, Ban } from 'lucide-react'
import type { StoredWritingExercise, ExerciseStatus, ExerciseType } from '@/types'

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

export function ExerciseAdminPage() {
  const { token } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data: exercises, isLoading } = useApiQuery<StoredWritingExercise[]>({
    queryKey: ['exercises-admin', statusFilter, typeFilter],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExercisesList(token, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      })
    },
    enabled: !!token,
    staleTime: 10_000,
  })

  // Compute stats
  const stats = exercises?.reduce(
    (acc, ex) => {
      acc.total++
      acc.byStatus[ex.status] = (acc.byStatus[ex.status] || 0) + 1
      acc.byType[ex.type] = (acc.byType[ex.type] || 0) + 1
      return acc
    },
    { total: 0, byStatus: {} as Record<string, number>, byType: {} as Record<string, number> }
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <LoadingCards />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PencilLine className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Exercise Admin</h1>
        </div>
        {stats && (
          <div className="text-sm text-muted-foreground">
            {stats.total} exercises
          </div>
        )}
      </div>

      {/* Stats summary */}
      {stats && stats.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <Badge key={status} variant="outline" className="text-xs">
              {status}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="validated">Validated</SelectItem>
            <SelectItem value="served">Served</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="translation">Translation</SelectItem>
            <SelectItem value="fill_blank">Fill-blank</SelectItem>
            <SelectItem value="word_reorder">Word reorder</SelectItem>
            <SelectItem value="guided_write">Guided write</SelectItem>
            <SelectItem value="paragraph_write">Paragraph</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exercise list */}
      {exercises && exercises.length > 0 ? (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div
              key={exercise.exercise_id}
              className="rounded-lg border p-4 space-y-2"
            >
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
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(exercise.generated_at).toLocaleDateString()}
                </span>
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

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{exercise.target_vocabulary.length} target words</span>
                {exercise.served_at && (
                  <span>· served {new Date(exercise.served_at).toLocaleDateString()}</span>
                )}
                {exercise.completed_at && (
                  <span>· completed {new Date(exercise.completed_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <PencilLine className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No exercises found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Exercises are generated from your vocabulary after review sessions.
          </p>
        </div>
      )}
    </div>
  )
}
