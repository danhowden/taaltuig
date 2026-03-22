import type { ExerciseType } from '@/types'

export const EXERCISE_TYPE_COLORS: Record<ExerciseType, string> = {
  translation: 'bg-blue-100 text-blue-800 border-blue-200',
  fill_blank: 'bg-purple-100 text-purple-800 border-purple-200',
  word_reorder: 'bg-teal-100 text-teal-800 border-teal-200',
  guided_write: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  paragraph_write: 'bg-slate-100 text-slate-800 border-slate-200',
  multiple_choice: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  error_correction: 'bg-red-100 text-red-800 border-red-200',
  conjugation: 'bg-orange-100 text-orange-800 border-orange-200',
  cloze_passage: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sentence_completion: 'bg-violet-100 text-violet-800 border-violet-200',
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  translation: 'Translation',
  fill_blank: 'Fill-blank',
  word_reorder: 'Reorder',
  guided_write: 'Guided',
  paragraph_write: 'Paragraph',
  multiple_choice: 'Multiple Choice',
  error_correction: 'Error Correction',
  conjugation: 'Conjugation',
  cloze_passage: 'Cloze Passage',
  sentence_completion: 'Sentence Completion',
}

export const EXERCISE_TYPE_SHORT_LABELS: Record<ExerciseType, string> = {
  translation: 'Trans',
  fill_blank: 'Fill',
  word_reorder: 'Reorder',
  guided_write: 'Guided',
  paragraph_write: 'Para',
  multiple_choice: 'Multiple Choice',
  error_correction: 'ErrFix',
  conjugation: 'Conj',
  cloze_passage: 'Cloze',
  sentence_completion: 'Complete',
}
