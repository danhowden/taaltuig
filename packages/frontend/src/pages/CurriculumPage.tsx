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
import { EXERCISE_TYPE_COLORS, EXERCISE_TYPE_SHORT_LABELS } from '@/constants/exercises'

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

  const typeColors = EXERCISE_TYPE_COLORS as Record<string, string>
  const typeLabels = EXERCISE_TYPE_SHORT_LABELS as Record<string, string>

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

const DATA_FLOW_STEPS = [
  { label: 'User Level', sublabel: 'proficiency_level', num: 1 },
  { label: 'Topic Selection', sublabel: 'getTrackableTopics()', num: 2 },
  { label: 'AI Generation', sublabel: 'writing-generate', num: 3 },
  { label: 'Exercise', sublabel: 'WritingExercise', num: 4 },
  { label: 'Assessment', sublabel: 'writing-submit', num: 5 },
  { label: 'Progress', sublabel: 'TopicProgress', num: 6 },
  { label: 'Mastery', sublabel: '80% / 8 exercises', num: 7 },
  { label: 'Level Up', sublabel: '70% mastered', num: 8 },
]

function DataFlowDiagram() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-4">
        Data Flow
      </h3>
      <div className="grid grid-cols-4 gap-x-0 gap-y-4">
        {DATA_FLOW_STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center">
            <div className="flex-1 text-center">
              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/5 text-[11px] font-semibold text-black/40 mb-1.5">
                {step.num}
              </div>
              <div className="text-xs font-medium text-black/70">{step.label}</div>
              <div className="text-[10px] text-black/35 font-mono mt-0.5">{step.sublabel}</div>
            </div>
            {(i + 1) % 4 !== 0 && i < DATA_FLOW_STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-black/15 flex-shrink-0 -mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            SkillProgress (separate tracking)
          </div>
          <pre className="text-[10px] text-black/50 font-mono leading-relaxed">
{`PK: USER#<user_id>
SK: SKILL#oral_practice#a1.grammar.verbs...
GSI2PK: USER#<id>#SKILL#oral_practice
GSI2SK: A1#<topic_id>

skill_type: oral_practice
sessions_completed: 3
total_minutes: 45
last_practiced: 2026-03-20T18:00:00Z`}
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
// Exercise Type Legend
// ============================================================================

const EXERCISE_TYPES = [
  { id: 'translation', label: 'Translation', desc: 'English→Dutch sentence', color: 'bg-blue-100 text-blue-700', assessment: 'Deterministic + AI fallback' },
  { id: 'fill_blank', label: 'Fill Blank', desc: 'Complete one missing word', color: 'bg-amber-100 text-amber-700', assessment: 'Deterministic' },
  { id: 'word_reorder', label: 'Word Reorder', desc: 'Arrange scrambled words', color: 'bg-green-100 text-green-700', assessment: 'Deterministic' },
  { id: 'multiple_choice', label: 'Multiple Choice', desc: 'Pick from 3-4 options', color: 'bg-cyan-100 text-cyan-700', assessment: 'Deterministic' },
  { id: 'conjugation', label: 'Conjugation', desc: 'Infinitive + subject → correct form', color: 'bg-orange-100 text-orange-700', assessment: 'Deterministic' },
  { id: 'error_correction', label: 'Error Correction', desc: 'Find and fix the mistake', color: 'bg-red-100 text-red-700', assessment: 'Deterministic + AI' },
  { id: 'sentence_completion', label: 'Sentence Completion', desc: 'Finish a started sentence', color: 'bg-violet-100 text-violet-700', assessment: 'AI-assessed' },
  { id: 'cloze_passage', label: 'Cloze Passage', desc: 'Multiple blanks in a paragraph', color: 'bg-teal-100 text-teal-700', assessment: 'Deterministic' },
  { id: 'guided_write', label: 'Guided Write', desc: 'Sentence with grammar constraint', color: 'bg-purple-100 text-purple-700', assessment: 'AI-assessed' },
  { id: 'paragraph_write', label: 'Paragraph Write', desc: 'Multi-sentence situational writing', color: 'bg-rose-100 text-rose-700', assessment: 'AI-assessed' },
]

function ExerciseTypeLegend() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
        Exercise Types (10)
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {EXERCISE_TYPES.map((et) => (
          <div key={et.id}>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${et.color}`}>
              {et.label}
            </span>
            <p className="text-[10px] text-black/50 mt-1">{et.desc}</p>
            <p className="text-[10px] text-black/30 mt-0.5">{et.assessment}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Skill Tracking Panel
// ============================================================================

const SKILL_TYPES = [
  { id: 'oral_practice', label: 'Oral Practice', desc: 'Speaking & pronunciation — self-reported sessions', icon: '🗣️' },
  { id: 'listening', label: 'Listening', desc: 'Comprehension — tracked separately from exercises', icon: '👂' },
  { id: 'reading', label: 'Reading', desc: 'Reading comprehension — tracked separately from exercises', icon: '📖' },
]

function SkillTrackingPanel() {
  return (
    <div className="bg-white/60 rounded-xl p-4 mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50 mb-3">
        Skill Tracking (separate from exercises)
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {SKILL_TYPES.map((skill) => (
          <div key={skill.id}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{skill.icon}</span>
              <span className="text-sm font-medium text-black/70">{skill.label}</span>
            </div>
            <p className="text-[10px] text-black/40">{skill.desc}</p>
            <p className="text-[10px] text-black/30 mt-1 font-mono">SkillProgress entity — per topic, per user</p>
          </div>
        ))}
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

        {/* Exercise Types + Skill Tracking */}
        <ExerciseTypeLegend />
        <SkillTrackingPanel />

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
