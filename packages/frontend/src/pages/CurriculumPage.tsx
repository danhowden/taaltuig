import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/PageLayout'
import {
  CURRICULUM,
  CEFR_LEVELS,
  getChildren,
  type CurriculumTopic,
  type CEFRLevelMeta,
} from '@taaltuig/dynamodb-client'
import type { CEFRLevel } from '@taaltuig/dynamodb-client'
import type { TopicExerciseCounts } from '@/types'
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  GraduationCap,
  Languages,
} from 'lucide-react'
import { EXERCISE_TYPE_COLORS, EXERCISE_TYPE_SHORT_LABELS } from '@/constants/exercises'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'

// ============================================================================
// Level Card
// ============================================================================

function LevelCard({
  meta,
  isSelected,
  onClick,
  exerciseCount,
}: {
  meta: CEFRLevelMeta
  isSelected: boolean
  onClick: () => void
  exerciseCount: number
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-4 transition-all border ${
        isSelected
          ? 'border-black/20 bg-white shadow-sm'
          : 'border-transparent bg-white/50 hover:bg-white/80'
      }`}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-bold tracking-tight">{meta.level}</span>
        <span className="text-sm text-black/50">{meta.name}</span>
      </div>
      <p className="text-xs text-black/40 mb-3 line-clamp-2">
        {meta.description}
      </p>
      <div className="flex gap-4 text-xs text-black/60">
        <span className="flex items-center gap-1">
          <GraduationCap className="h-3 w-3" />
          {meta.level}
        </span>
        <span className="flex items-center gap-1">
          <Languages className="h-3 w-3" />
          {meta.vocab_benchmark.min}-{meta.vocab_benchmark.max} words
        </span>
        {exerciseCount > 0 && (
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {exerciseCount} exercises
          </span>
        )}
      </div>
    </button>
  )
}

// ============================================================================
// Exercise Count Badge
// ============================================================================

function ExerciseCountBadge({ counts }: { counts: TopicExerciseCounts }) {
  const typeColors = EXERCISE_TYPE_COLORS as Record<string, string>
  const typeLabels = EXERCISE_TYPE_SHORT_LABELS as Record<string, string>

  return (
    <div className="flex items-center gap-1.5">
      {Object.entries(counts.by_type).map(([type, count]) => (
        <span
          key={type}
          className={`text-[10px] px-1.5 py-0.5 rounded ${typeColors[type] || 'bg-gray-100 text-gray-600'}`}
        >
          {typeLabels[type] || type} {count}
        </span>
      ))}
    </div>
  )
}

// ============================================================================
// Topic Tree Node
// ============================================================================

function TopicNode({
  topic,
  depth = 0,
  exerciseCounts,
}: {
  topic: CurriculumTopic
  depth?: number
  exerciseCounts: Record<string, TopicExerciseCounts>
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 1)
  const children = getChildren(topic.id)
  const hasChildren = children.length > 0

  const topicCounts = exerciseCounts[topic.id]

  // Aggregate exercise counts for categories (sum of children)
  const aggregateCount = topic.is_category
    ? Object.entries(exerciseCounts)
        .filter(([id]) => id.startsWith(topic.id + '.'))
        .reduce((sum, [, c]) => sum + c.total, 0)
    : topicCounts?.total || 0

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-2 px-3 rounded-lg transition-colors ${
          hasChildren ? 'cursor-pointer hover:bg-black/5' : ''
        } ${topic.is_category ? 'font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse icon */}
        <div className="w-4 h-4 mt-0.5 flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-black/40" />
            ) : (
              <ChevronRight className="h-4 w-4 text-black/40" />
            )
          ) : (
            <div className="h-4 w-4 flex items-center justify-center">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  topicCounts ? 'bg-green-400' : topic.trackable ? 'bg-black/30' : 'bg-black/15'
                }`}
              />
            </div>
          )}
        </div>

        {/* Topic info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                topic.is_category
                  ? 'font-semibold text-black/80'
                  : topic.trackable
                    ? 'text-black/70'
                    : 'text-black/40 italic'
              }`}
            >
              {topic.name}
            </span>

            {/* Exercise count for categories */}
            {topic.is_category && aggregateCount > 0 && (
              <span className="text-[10px] text-black/40 bg-black/5 px-1.5 py-0.5 rounded">
                {aggregateCount} exercises
              </span>
            )}
          </div>

          {/* Description */}
          {!topic.is_category && (
            <p className="text-xs text-black/40 mt-0.5">{topic.description}</p>
          )}

          {/* Grammar points */}
          {topic.grammar_points.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {topic.grammar_points.map((gp) => (
                <span
                  key={gp}
                  className="text-[10px] bg-black/5 text-black/50 px-1.5 py-0.5 rounded"
                >
                  {gp}
                </span>
              ))}
            </div>
          )}

          {/* Exercise counts per type — links to catalog */}
          {topicCounts && (
            <Link
              to={`/exercises?topic=${topic.id}`}
              className="mt-1.5 inline-flex items-center gap-1.5 group"
              onClick={(e) => e.stopPropagation()}
            >
              <ExerciseCountBadge counts={topicCounts} />
              <span className="text-[10px] text-black/30 group-hover:text-black/60 transition-colors">
                view →
              </span>
            </Link>
          )}

          {/* Suitable types (only show if no exercises yet) */}
          {!topicCounts && topic.suitable_exercise_types.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {topic.suitable_exercise_types.map((et) => {
                const typeColors = EXERCISE_TYPE_COLORS as Record<string, string>
                const typeLabels = EXERCISE_TYPE_SHORT_LABELS as Record<string, string>
                return (
                  <span
                    key={et}
                    className={`text-[10px] px-1.5 py-0.5 rounded opacity-40 ${typeColors[et] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {typeLabels[et] || et}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Topic ID */}
        <span className="text-[10px] text-black/20 font-mono flex-shrink-0 mt-0.5">
          {topic.id.split('.').pop()}
        </span>
      </div>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <TopicNode
            key={child.id}
            topic={child}
            depth={depth + 1}
            exerciseCounts={exerciseCounts}
          />
        ))}
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export function CurriculumPage() {
  const { token } = useAuth()
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('A1')

  const { data: summaryData } = useApiQuery({
    queryKey: ['exercise-summary', selectedLevel],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExerciseSummary(token, selectedLevel)
    },
    enabled: !!token,
    staleTime: 60_000,
  })

  const exerciseCounts = summaryData?.counts || {}
  const totalExercises = Object.values(exerciseCounts).reduce(
    (sum, c) => sum + c.total,
    0
  )

  const rootTopics = CURRICULUM.filter(
    (t) => t.level === selectedLevel && t.parent_id === null
  )

  return (
    <PageLayout>
      <PageLayout.Header
        title="Curriculum"
        description="Your Dutch learning path"
      />
      <PageLayout.Content>
        {/* Level selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {CEFR_LEVELS.map((meta) => (
            <LevelCard
              key={meta.level}
              meta={meta}
              isSelected={selectedLevel === meta.level}
              onClick={() => setSelectedLevel(meta.level)}
              exerciseCount={selectedLevel === meta.level ? totalExercises : 0}
            />
          ))}
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-4 px-1">
          <span className="text-sm font-medium text-black/60">
            {selectedLevel}
          </span>
          {totalExercises > 0 && (
            <span className="text-xs text-black/40">
              {totalExercises} exercises across{' '}
              {Object.keys(exerciseCounts).length} topics
            </span>
          )}
        </div>

        {/* Exercise type legend */}
        <div className="bg-white/60 rounded-xl p-4 mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
            Exercise Types
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'fill_blank', label: 'Fill Blank', desc: 'Complete one missing word' },
              { id: 'translation', label: 'Translation', desc: 'English→Dutch sentence' },
              { id: 'word_reorder', label: 'Word Reorder', desc: 'Arrange scrambled words' },
              { id: 'multiple_choice', label: 'Multiple Choice', desc: 'Pick from 3-4 options' },
              { id: 'conjugation', label: 'Conjugation', desc: 'Infinitive + subject → correct form' },
              { id: 'error_correction', label: 'Error Correction', desc: 'Find and fix the mistake' },
              { id: 'sentence_completion', label: 'Sentence Completion', desc: 'Finish a started sentence' },
              { id: 'cloze_passage', label: 'Cloze Passage', desc: 'Multiple blanks in a paragraph' },
              { id: 'guided_write', label: 'Guided Write', desc: 'Sentence with grammar constraint' },
              { id: 'paragraph_write', label: 'Paragraph Write', desc: 'Multi-sentence writing' },
            ].map((et) => {
              const colors = EXERCISE_TYPE_COLORS as Record<string, string>
              return (
                <div key={et.id}>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[et.id] || 'bg-gray-100 text-gray-600'}`}>
                    {et.label}
                  </span>
                  <p className="text-[10px] text-black/50 mt-1">{et.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Topic tree */}
        <div className="bg-white/60 rounded-xl p-4">
          <div className="divide-y divide-black/5">
            {rootTopics.map((topic: CurriculumTopic) => (
              <TopicNode
                key={topic.id}
                topic={topic}
                depth={0}
                exerciseCounts={exerciseCounts}
              />
            ))}
          </div>
        </div>
      </PageLayout.Content>
    </PageLayout>
  )
}
