import { useState } from 'react'
import { PageLayout } from '@/components/PageLayout'
import {
  CURRICULUM,
  CEFR_LEVELS,
  MASTERY_THRESHOLD,
  MASTERY_MIN_EXERCISES,
  LEVEL_ADVANCEMENT_THRESHOLD,
  getTrackableTopics,
  getLeafTopics,
  getChildren,
  type CurriculumTopic,
  type CEFRLevelMeta,
} from '@taaltuig/dynamodb-client'
import type { CEFRLevel } from '@taaltuig/dynamodb-client'
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  GraduationCap,
  Languages,
  Info,
} from 'lucide-react'

// ============================================================================
// Level Card
// ============================================================================

function LevelCard({
  meta,
  isSelected,
  onClick,
}: {
  meta: CEFRLevelMeta
  isSelected: boolean
  onClick: () => void
}) {
  const trackable = getTrackableTopics(meta.level)
  const vocabThemes = getLeafTopics(meta.level).filter((t) => !t.trackable)

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
          {trackable.length} topics
        </span>
        <span className="flex items-center gap-1">
          <Languages className="h-3 w-3" />
          {vocabThemes.length} vocab themes
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          {meta.vocab_benchmark.min}-{meta.vocab_benchmark.max} words
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Topic Tree Node
// ============================================================================

function TopicNode({
  topic,
  depth = 0,
}: {
  topic: CurriculumTopic
  depth?: number
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const children = getChildren(topic.id)
  const hasChildren = children.length > 0

  const typeColors: Record<string, string> = {
    translation: 'bg-blue-100 text-blue-700',
    fill_blank: 'bg-amber-100 text-amber-700',
    word_reorder: 'bg-green-100 text-green-700',
    guided_write: 'bg-purple-100 text-purple-700',
    paragraph_write: 'bg-rose-100 text-rose-700',
  }

  const typeLabels: Record<string, string> = {
    translation: 'Trans',
    fill_blank: 'Fill',
    word_reorder: 'Reorder',
    guided_write: 'Guided',
    paragraph_write: 'Para',
  }

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-2 px-3 rounded-lg transition-colors ${
          hasChildren
            ? 'cursor-pointer hover:bg-black/5'
            : ''
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
                  topic.trackable ? 'bg-black/30' : 'bg-black/15'
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

            {/* Trackable / info-only badge */}
            {!topic.is_category && !topic.trackable && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-black/30 bg-black/5 px-1.5 py-0.5 rounded">
                <Info className="h-2.5 w-2.5" />
                info
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

          {/* Suitable exercise types */}
          {topic.suitable_exercise_types.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {topic.suitable_exercise_types.map((et) => (
                <span
                  key={et}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${typeColors[et] || 'bg-gray-100 text-gray-600'}`}
                >
                  {typeLabels[et] || et}
                </span>
              ))}
            </div>
          )}

          {/* Vocabulary themes */}
          {topic.vocabulary_themes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {topic.vocabulary_themes.map((vt) => (
                <span
                  key={vt}
                  className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded"
                >
                  {vt}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Topic ID */}
        <span className="text-[10px] text-black/20 font-mono flex-shrink-0 mt-0.5">
          {topic.id}
        </span>
      </div>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <TopicNode key={child.id} topic={child} depth={depth + 1} />
        ))}
    </div>
  )
}

// ============================================================================
// Stats Summary
// ============================================================================

function StatsSummary() {
  const totalTopics = CURRICULUM.filter((t) => !t.is_category).length
  const trackableTopics = CURRICULUM.filter((t) => t.trackable).length
  const categories = CURRICULUM.filter((t) => t.is_category).length
  const vocabThemes = totalTopics - trackableTopics

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white/60 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold">{trackableTopics}</div>
        <div className="text-xs text-black/50">Trackable Topics</div>
      </div>
      <div className="bg-white/60 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold">{vocabThemes}</div>
        <div className="text-xs text-black/50">Vocab Themes</div>
      </div>
      <div className="bg-white/60 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold">{categories}</div>
        <div className="text-xs text-black/50">Categories</div>
      </div>
      <div className="bg-white/60 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold">{CEFR_LEVELS.length}</div>
        <div className="text-xs text-black/50">CEFR Levels</div>
      </div>
    </div>
  )
}

// ============================================================================
// Mastery Config Panel
// ============================================================================

function MasteryConfig() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
        Mastery Configuration
      </h3>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-black/40 text-xs">Mastery threshold</span>
          <div className="font-mono font-semibold">
            {Math.round(MASTERY_THRESHOLD * 100)}% correct
          </div>
        </div>
        <div>
          <span className="text-black/40 text-xs">Min exercises</span>
          <div className="font-mono font-semibold">
            {MASTERY_MIN_EXERCISES} per topic
          </div>
        </div>
        <div>
          <span className="text-black/40 text-xs">Level advancement</span>
          <div className="font-mono font-semibold">
            {Math.round(LEVEL_ADVANCEMENT_THRESHOLD * 100)}% topics mastered
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Data Flow Diagram
// ============================================================================

function DataFlowDiagram() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
        Data Flow
      </h3>
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-2">
        <Step label="User Level" sublabel="UserSettings.proficiency_level" />
        <Arrow />
        <Step label="Topic Selection" sublabel="getTrackableTopics(level)" />
        <Arrow />
        <Step label="AI Generation" sublabel="writing-generate lambda" />
        <Arrow />
        <Step label="Exercise" sublabel="WritingExercise.topic_id" />
        <Arrow />
        <Step label="Assessment" sublabel="writing-submit lambda" />
        <Arrow />
        <Step label="Progress Update" sublabel="TopicProgress entity" />
        <Arrow />
        <Step label="Mastery Check" sublabel="80% over 8 exercises" />
        <Arrow />
        <Step label="Level Advance" sublabel="70% topics mastered" />
      </div>
    </div>
  )
}

function Step({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex-shrink-0 bg-white rounded-lg border border-black/10 px-3 py-2 text-center min-w-[120px]">
      <div className="font-medium text-black/70">{label}</div>
      <div className="text-[10px] text-black/40 font-mono mt-0.5">
        {sublabel}
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <ChevronRight className="h-4 w-4 text-black/20 flex-shrink-0" />
  )
}

// ============================================================================
// DynamoDB Entity Preview
// ============================================================================

function EntityPreview() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
        DynamoDB Entities
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-black/10 p-3">
          <div className="text-xs font-semibold text-black/60 mb-2">
            TopicProgress (per user per topic)
          </div>
          <pre className="text-[10px] text-black/50 font-mono leading-relaxed">
{`PK: USER#<user_id>
SK: TOPIC#a1.grammar.verbs.present_regular
GSI2PK: USER#<id>#CEFR#A1
GSI2SK: <mastery_score>#<topic_id>

exercises_completed: 12
exercises_correct: 10
mastery_score: 83  (= mastered)
last_practiced: 2026-03-22T10:00:00Z
streak_current: 5
streak_best: 8`}
          </pre>
        </div>
        <div className="bg-white rounded-lg border border-black/10 p-3">
          <div className="text-xs font-semibold text-black/60 mb-2">
            UserCEFRSummary (per user)
          </div>
          <pre className="text-[10px] text-black/50 font-mono leading-relaxed">
{`PK: USER#<user_id>
SK: CEFR_SUMMARY

current_level: A1
level_progress:
  A1: 12/18 practiced, 8/18 mastered
  A2: 0/14 practiced
total_vocab_learned: 247
vocab_benchmarks:
  A1: 247/500-1000`}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export function CurriculumPage() {
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>('A1')

  const topLevelTopics = CURRICULUM.filter(
    (t) => t.level === selectedLevel && t.parent_id === null
  )

  return (
    <PageLayout>
      <PageLayout.Header
        title="Curriculum"
        description="CEFR A1-C2 topic structure for exercise generation and progress tracking"
      />
      <PageLayout.Content>
        {/* Stats */}
        <StatsSummary />

        {/* Flow + Config */}
        <DataFlowDiagram />
        <MasteryConfig />
        <EntityPreview />

        {/* Level selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {CEFR_LEVELS.map((meta) => (
            <LevelCard
              key={meta.level}
              meta={meta}
              isSelected={selectedLevel === meta.level}
              onClick={() => setSelectedLevel(meta.level)}
            />
          ))}
        </div>

        {/* Topic tree */}
        <div className="bg-white/60 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
            {selectedLevel} Topic Tree
          </h3>
          <div className="divide-y divide-black/5">
            {topLevelTopics.map((topic) => (
              <TopicNode key={topic.id} topic={topic} depth={0} />
            ))}
          </div>
        </div>
      </PageLayout.Content>
    </PageLayout>
  )
}
