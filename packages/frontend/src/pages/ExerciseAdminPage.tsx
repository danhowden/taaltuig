import { useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingCards } from '@/components/review/LoadingCards'
import { ArrowLeft, BookOpen } from 'lucide-react'
import type { CatalogExercise } from '@/types'
import { EXERCISE_TYPE_COLORS, EXERCISE_TYPE_LABELS } from '@/constants/exercises'
import { CURRICULUM, type CurriculumTopic } from '@taaltuig/dynamodb-client'

function ExerciseCard({ exercise }: { exercise: CatalogExercise }) {
  return (
    <div className="rounded-[6px] bg-white/60 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-xs ${EXERCISE_TYPE_COLORS[exercise.type] ?? ''}`}
          >
            {EXERCISE_TYPE_LABELS[exercise.type]}
          </Badge>
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

      {exercise.source_notes && (
        <p className="text-xs text-black/30">{exercise.source_notes}</p>
      )}
    </div>
  )
}

export function ExerciseAdminPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const topic = searchParams.get('topic') || undefined
  const level = searchParams.get('level') || (topic ? undefined : 'A1')
  const typeFilter = searchParams.get('type') || 'all'

  // Find topic metadata from curriculum
  const topicMeta = topic
    ? (CURRICULUM as CurriculumTopic[]).find((t) => t.id === topic)
    : undefined

  const { data, isLoading } = useApiQuery({
    queryKey: ['exercise-catalog', topic, level],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExerciseCatalog(token, {
        topic,
        level: topic ? undefined : level,
      })
    },
    enabled: !!token,
    staleTime: 30_000,
  })

  const exercises = useMemo(() => {
    if (!data?.exercises) return []
    if (typeFilter === 'all') return data.exercises
    return data.exercises.filter((ex) => ex.type === typeFilter)
  }, [data, typeFilter])

  // Get unique types for the filter dropdown
  const availableTypes = useMemo(() => {
    if (!data?.exercises) return []
    return [...new Set(data.exercises.map((ex) => ex.type))]
  }, [data])

  const setType = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('type')
    } else {
      next.set('type', value)
    }
    setSearchParams(next)
  }

  const title = topicMeta
    ? topicMeta.name
    : level
      ? `${level} Exercises`
      : 'Exercises'

  const description = topicMeta
    ? `${topicMeta.level} — ${topicMeta.description}`
    : 'Browse the exercise catalog'

  if (isLoading) {
    return (
      <PageLayout>
        <PageLayout.Header title={title} description={description} />
        <PageLayout.Content className="flex items-center justify-center">
          <LoadingCards />
        </PageLayout.Content>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title={title}
        description={description}
        actions={
          <Link
            to="/curriculum"
            className="inline-flex items-center gap-1.5 text-xs text-black/50 hover:text-black/80 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Curriculum
          </Link>
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
              {availableTypes.length > 1 && (
                <Select value={typeFilter} onValueChange={setType}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {availableTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EXERCISE_TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Exercise list */}
          {exercises.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exercises.map((exercise) => (
                <ExerciseCard key={exercise.exercise_id} exercise={exercise} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                {data && data.count > 0
                  ? 'No exercises match this filter'
                  : 'No exercises seeded for this topic yet'}
              </p>
            </div>
          )}
        </div>
      </PageLayout.Content>
    </PageLayout>
  )
}
