import type { AssessmentResult, Grade } from './types'

/**
 * Normalizes a Dutch text answer for comparison.
 * Lowercases, trims, collapses whitespace.
 */
export function normalizeAnswer(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Strips diacritics from a string for "almost correct" comparison.
 * e.g., "één" → "een", "café" → "cafe"
 */
export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Computes Levenshtein distance between two strings.
 * Used for fuzzy matching (typo detection).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  )

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Checks if the difference between two strings is only diacritics.
 * e.g., "een" vs "één" → true, "een" vs "eep" → false
 */
export function isDiacriticDifference(a: string, b: string): boolean {
  return stripDiacritics(a) === stripDiacritics(b) && a !== b
}

/**
 * Deterministic assessment for translation exercises.
 * Checks: exact match → alternatives → diacritics-only difference → fuzzy match (typo).
 */
export class TranslationAssessor {
  assess(
    userAnswer: string,
    referenceAnswer: string,
    alternatives: string[] = []
  ): AssessmentResult {
    const normalized = normalizeAnswer(userAnswer)
    const normalizedRef = normalizeAnswer(referenceAnswer)
    const normalizedAlts = alternatives.map(normalizeAnswer)

    // Empty answer
    if (normalized === '') {
      return {
        correct: false,
        grade: 0 as Grade,
        feedback: 'No answer provided.',
        match_type: 'wrong',
        reference_answer: referenceAnswer,
      }
    }

    // Exact match
    if (normalized === normalizedRef) {
      return {
        correct: true,
        grade: 3 as Grade,
        feedback: 'Correct!',
        match_type: 'exact',
        reference_answer: referenceAnswer,
      }
    }

    // Alternative match
    if (normalizedAlts.includes(normalized)) {
      return {
        correct: true,
        grade: 3 as Grade,
        feedback: 'Correct!',
        match_type: 'alternative',
        reference_answer: referenceAnswer,
      }
    }

    // Diacritics-only difference against reference
    if (isDiacriticDifference(normalized, normalizedRef)) {
      return {
        correct: true,
        grade: 2 as Grade,
        feedback: `Almost! Watch the accents: "${referenceAnswer}"`,
        match_type: 'fuzzy',
        reference_answer: referenceAnswer,
      }
    }

    // Diacritics-only difference against alternatives
    for (const alt of normalizedAlts) {
      if (isDiacriticDifference(normalized, alt)) {
        const originalAlt = alternatives[normalizedAlts.indexOf(alt)]
        return {
          correct: true,
          grade: 2 as Grade,
          feedback: `Almost! Watch the accents: "${originalAlt}"`,
          match_type: 'fuzzy',
          reference_answer: referenceAnswer,
        }
      }
    }

    // Fuzzy match (Levenshtein ≤ 1) against reference — likely typo
    if (levenshteinDistance(normalized, normalizedRef) <= 1) {
      return {
        correct: true,
        grade: 2 as Grade,
        feedback: `Close! Check your spelling: "${referenceAnswer}"`,
        match_type: 'fuzzy',
        reference_answer: referenceAnswer,
      }
    }

    // Fuzzy match against alternatives
    for (const alt of normalizedAlts) {
      if (levenshteinDistance(normalized, alt) <= 1) {
        return {
          correct: true,
          grade: 2 as Grade,
          feedback: `Close! Check your spelling: "${alternatives[normalizedAlts.indexOf(alt)]}"`,
          match_type: 'fuzzy',
          reference_answer: referenceAnswer,
        }
      }
    }

    // Wrong
    return {
      correct: false,
      grade: 0 as Grade,
      feedback: `The correct answer is: "${referenceAnswer}"`,
      match_type: 'wrong',
      reference_answer: referenceAnswer,
    }
  }
}
