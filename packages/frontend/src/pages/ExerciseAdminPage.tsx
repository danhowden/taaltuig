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
import { Button } from '@/components/ui/button'
import { LoadingCards } from '@/components/review/LoadingCards'
import { ArrowLeft, BookOpen, Play } from 'lucide-react'
import type { CatalogExercise } from '@/types'
import { EXERCISE_TYPE_COLORS, EXERCISE_TYPE_LABELS } from '@/constants/exercises'
import { CURRICULUM, type CurriculumTopic } from '@taaltuig/dynamodb-client'

// Build a lookup map for topic names
const topicNameMap = new Map<string, string>(
  (CURRICULUM as CurriculumTopic[]).map((t) => [t.id, t.name])
)

export function ExerciseAdminPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const topic = searchParams.get('topic') || undefined
  const level = searchParams.get('level') || undefined
  const typeFilter = searchParams.get('type') || 'all'

  const topicMeta = topic
    ? (CURRICULUM as CurriculumTopic[]).find((t) => t.id === topic)
    : undefined

  const { data, isLoading } = useApiQuery({
    queryKey: ['exercise-catalog', topic, level],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExerciseCatalog(token, { topic, level })
    },
    enabled: !!token,
    staleTime: 30_000,
  })

  const exercises = useMemo(() => {
    if (!data?.exercises) return []
    if (typeFilter === 'all') return data.exercises
    return data.exercises.filter((ex) => ex.type === typeFilter)
  }, [data, typeFilter])

  const availableTypes = useMemo(() => {
    if (!data?.exercises) return []
    return [...new Set(data.exercises.map((ex) => ex.type))]
  }, [data])

  // Group by topic for the "start session" buttons
  const topicGroups = useMemo(() => {
    const groups = new Map<string, CatalogExercise[]>()
    for (const ex of exercises) {
      const list = groups.get(ex.topic_id) || []
      list.push(ex)
      groups.set(ex.topic_id, list)
    }
    return groups
  }, [exercises])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'all' || !value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setSearchParams(next)
  }

  const title = topicMeta
    ? topicMeta.name
    : level
      ? `${level} Exercises`
      : 'All Exercises'

  const description = topicMeta
    ? `${topicMeta.level} — ${topicMeta.description}`
    : 'Exercise catalog'

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
          <div className="flex items-center gap-3">
            {topic && (
              <Button asChild size="sm" className="gap-1.5">
                <Link to={`/exercise-session?topic=${topic}`}>
                  <Play className="h-3 w-3" />
                  Practice
                </Link>
              </Button>
            )}
            <Link
              to="/curriculum"
              className="inline-flex items-center gap-1.5 text-xs text-black/50 hover:text-black/80 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Curriculum
            </Link>
          </div>
        }
      />

      <PageLayout.Content>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm font-medium text-muted-foreground">
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
              {topicGroups.size > 1 && ` across ${topicGroups.size} topics`}
            </p>
            <div className="flex gap-2">
              {availableTypes.length > 1 && (
                <Select value={typeFilter} onValueChange={(v) => setFilter('type', v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
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

          {/* Exercise table */}
          {exercises.length > 0 ? (
            <div className="bg-white/60 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Type</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Topic</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Prompt</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Answer</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((exercise) => (
                    <tr key={exercise.exercise_id} className="border-b border-black/5 hover:bg-black/[0.02]">
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${EXERCISE_TYPE_COLORS[exercise.type] ?? ''}`}
                        >
                          {EXERCISE_TYPE_LABELS[exercise.type] || exercise.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <Link
                          to={`/exercises?topic=${exercise.topic_id}`}
                          className="text-xs text-black/60 hover:text-black/90 transition-colors"
                        >
                          {topicNameMap.get(exercise.topic_id) || exercise.topic_id}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-black/80">
                        {exercise.prompt}
                      </td>
                      <td className="py-2.5 px-4 text-black/50 font-mono text-xs">
                        {exercise.reference_answer}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] text-black/30 uppercase tracking-wide">
                          not attempted
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                {data && data.count > 0
                  ? 'No exercises match this filter'
                  : 'No exercises seeded yet'}
              </p>
            </div>
          )}
        </div>
      </PageLayout.Content>
    </PageLayout>
  )
}
