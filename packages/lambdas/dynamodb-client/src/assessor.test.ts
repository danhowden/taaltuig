import { describe, it, expect } from 'vitest'
import {
  TranslationAssessor,
  normalizeAnswer,
  stripDiacritics,
  levenshteinDistance,
  damerauLevenshteinDistance,
  isDiacriticDifference,
} from './assessor'

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  Ik Loop  ')).toBe('ik loop')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeAnswer('ik  loop  naar  de  winkel')).toBe('ik loop naar de winkel')
  })

  it('preserves diacritics', () => {
    expect(normalizeAnswer('één kat')).toBe('één kat')
  })

  it('handles empty string', () => {
    expect(normalizeAnswer('')).toBe('')
    expect(normalizeAnswer('   ')).toBe('')
  })

  it('strips punctuation', () => {
    expect(normalizeAnswer('Tot ziens!')).toBe('tot ziens')
    expect(normalizeAnswer('Goed, dank je.')).toBe('goed dank je')
  })
})

describe('stripDiacritics', () => {
  it('removes accents from Dutch characters', () => {
    expect(stripDiacritics('één')).toBe('een')
    expect(stripDiacritics('café')).toBe('cafe')
    expect(stripDiacritics('naïef')).toBe('naief')
    expect(stripDiacritics('überhaupt')).toBe('uberhaupt')
  })

  it('leaves plain text unchanged', () => {
    expect(stripDiacritics('ik loop naar de winkel')).toBe('ik loop naar de winkel')
  })
})

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('kat', 'kat')).toBe(0)
  })

  it('returns 1 for single-char difference', () => {
    expect(levenshteinDistance('kat', 'kar')).toBe(1) // substitution
    expect(levenshteinDistance('kat', 'kaat')).toBe(1) // insertion
    expect(levenshteinDistance('kaat', 'kat')).toBe(1) // deletion
  })

  it('returns correct distance for larger differences', () => {
    expect(levenshteinDistance('kat', 'hond')).toBe(4)
    expect(levenshteinDistance('loop', 'liep')).toBe(2)
  })

  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3)
    expect(levenshteinDistance('abc', '')).toBe(3)
    expect(levenshteinDistance('', '')).toBe(0)
  })
})

describe('damerauLevenshteinDistance', () => {
  it('treats adjacent transposition as distance 1', () => {
    expect(damerauLevenshteinDistance('zeins', 'ziens')).toBe(1)
    expect(damerauLevenshteinDistance('ie', 'ei')).toBe(1)
  })

  it('returns same as levenshtein for non-transposition differences', () => {
    expect(damerauLevenshteinDistance('kat', 'kar')).toBe(1)
    expect(damerauLevenshteinDistance('loppp', 'loop')).toBe(2)
  })
})

describe('isDiacriticDifference', () => {
  it('returns true when only diacritics differ', () => {
    expect(isDiacriticDifference('een', 'één')).toBe(true)
    expect(isDiacriticDifference('naief', 'naïef')).toBe(true)
  })

  it('returns false when strings are identical', () => {
    expect(isDiacriticDifference('één', 'één')).toBe(false)
  })

  it('returns false when non-diacritic characters differ', () => {
    expect(isDiacriticDifference('kat', 'hond')).toBe(false)
    expect(isDiacriticDifference('een', 'een')).toBe(false)
  })
})

describe('TranslationAssessor', () => {
  const assessor = new TranslationAssessor()

  describe('exact match', () => {
    it('marks correct on exact match', () => {
      const result = assessor.assess('Ik loop naar de winkel', 'Ik loop naar de winkel')
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(3)
      expect(result.match_type).toBe('exact')
    })

    it('is case-insensitive', () => {
      const result = assessor.assess('ik loop naar de winkel', 'Ik loop naar de winkel')
      expect(result.correct).toBe(true)
      expect(result.match_type).toBe('exact')
    })

    it('ignores extra whitespace', () => {
      const result = assessor.assess('  ik loop  naar de winkel  ', 'Ik loop naar de winkel')
      expect(result.correct).toBe(true)
      expect(result.match_type).toBe('exact')
    })
  })

  describe('alternative match', () => {
    it('accepts known alternatives', () => {
      const result = assessor.assess(
        'Ik wandel naar de winkel',
        'Ik loop naar de winkel',
        ['Ik wandel naar de winkel', 'Ik ga naar de winkel']
      )
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(3)
      expect(result.match_type).toBe('alternative')
    })

    it('is case-insensitive for alternatives', () => {
      const result = assessor.assess(
        'ik ga naar de winkel',
        'Ik loop naar de winkel',
        ['Ik ga naar de winkel']
      )
      expect(result.correct).toBe(true)
      expect(result.match_type).toBe('alternative')
    })
  })

  describe('diacritics difference', () => {
    it('marks as fuzzy with grade 2 for missing accents on reference', () => {
      const result = assessor.assess('een kat', 'één kat')
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(2)
      expect(result.match_type).toBe('fuzzy')
      expect(result.feedback).toContain('accents')
    })

    it('marks as fuzzy with grade 2 for missing accents on alternative', () => {
      const result = assessor.assess(
        'een cafe',
        'een bar',
        ['één café']
      )
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(2)
      expect(result.match_type).toBe('fuzzy')
    })
  })

  describe('fuzzy match (typo)', () => {
    it('accepts single-character typo with grade 2', () => {
      const result = assessor.assess('Ik lopp naar de winkel', 'Ik loop naar de winkel')
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(2)
      expect(result.match_type).toBe('fuzzy')
      expect(result.feedback).toContain('minor typo')
    })

    it('accepts typo against alternative', () => {
      const result = assessor.assess(
        'Ik wandel naar de wimkel',
        'Ik loop naar de winkel',
        ['Ik wandel naar de winkel']
      )
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(2)
      expect(result.match_type).toBe('fuzzy')
    })

    it('accepts letter transposition (zeins/ziens) in longer sentence', () => {
      const result = assessor.assess('tot zeins volgende week', 'Tot ziens volgende week!')
      expect(result.correct).toBe(true)
      expect(result.grade).toBe(2)
      expect(result.match_type).toBe('fuzzy')
    })

    it('rejects clearly wrong short answer', () => {
      const result = assessor.assess('Ik loppp naar de winkel', 'Ik loop naar de winkel')
      expect(result.correct).toBe(false)
      expect(result.grade).toBe(0)
      expect(result.match_type).toBe('wrong')
    })
  })

  describe('wrong answers', () => {
    it('marks completely wrong answer', () => {
      const result = assessor.assess('De hond slaapt', 'Ik loop naar de winkel')
      expect(result.correct).toBe(false)
      expect(result.grade).toBe(0)
      expect(result.match_type).toBe('wrong')
      expect(result.feedback).toContain('Ik loop naar de winkel')
    })

    it('marks empty answer as wrong', () => {
      const result = assessor.assess('', 'Ik loop naar de winkel')
      expect(result.correct).toBe(false)
      expect(result.grade).toBe(0)
      expect(result.match_type).toBe('wrong')
    })

    it('marks whitespace-only answer as wrong', () => {
      const result = assessor.assess('   ', 'Ik loop naar de winkel')
      expect(result.correct).toBe(false)
      expect(result.grade).toBe(0)
    })
  })

  describe('reference answer always returned', () => {
    it('includes reference_answer in all results', () => {
      const ref = 'Ik loop naar de winkel'
      expect(assessor.assess('Ik loop naar de winkel', ref).reference_answer).toBe(ref)
      expect(assessor.assess('wrong', ref).reference_answer).toBe(ref)
      expect(assessor.assess('Ik lopp naar de winkel', ref).reference_answer).toBe(ref)
    })
  })

  describe('Dutch-specific cases', () => {
    it('handles de/het articles', () => {
      const result = assessor.assess('de kat', 'de kat')
      expect(result.correct).toBe(true)
    })

    it('handles separable verbs', () => {
      const result = assessor.assess(
        'Ik bel je morgen op',
        'Ik bel je morgen op'
      )
      expect(result.correct).toBe(true)
    })

    it('handles ij digraph', () => {
      const result = assessor.assess('zij is blij', 'Zij is blij')
      expect(result.correct).toBe(true)
    })

    it('handles single-word translations', () => {
      const result = assessor.assess('kat', 'kat')
      expect(result.correct).toBe(true)
    })
  })
})
