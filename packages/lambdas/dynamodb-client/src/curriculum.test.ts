import { describe, it, expect } from 'vitest'
import {
  CURRICULUM,
  CEFR_LEVELS,
  MASTERY_THRESHOLD,
  MASTERY_MIN_EXERCISES,
  LEVEL_ADVANCEMENT_THRESHOLD,
  getTopic,
  getTrackableTopics,
  getLeafTopics,
  getAllTopics,
  getChildren,
  getAncestorIds,
  getLevelMeta,
} from './curriculum'
import type { CEFRLevel } from './types'

describe('Curriculum', () => {
  it('should have topics for all 6 CEFR levels', () => {
    const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    for (const level of levels) {
      const topics = getAllTopics(level)
      expect(topics.length).toBeGreaterThan(0)
    }
  })

  it('should have unique topic IDs', () => {
    const ids = CURRICULUM.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have valid parent_id references', () => {
    const ids = new Set(CURRICULUM.map((t) => t.id))
    for (const topic of CURRICULUM) {
      if (topic.parent_id) {
        expect(ids.has(topic.parent_id)).toBe(true)
      }
    }
  })

  it('should have parent topics marked as categories', () => {
    const parentIds = new Set(
      CURRICULUM.filter((t) => t.parent_id).map((t) => t.parent_id!)
    )
    for (const parentId of parentIds) {
      const parent = getTopic(parentId)
      expect(parent?.is_category).toBe(true)
    }
  })

  it('should have trackable topics with at least one suitable exercise type', () => {
    const trackable = CURRICULUM.filter((t) => t.trackable)
    for (const topic of trackable) {
      expect(topic.suitable_exercise_types.length).toBeGreaterThan(0)
    }
  })

  it('should have vocabulary themes marked as non-trackable', () => {
    const vocabThemes = CURRICULUM.filter(
      (t) => !t.is_category && t.id.includes('.vocabulary.')
    )
    expect(vocabThemes.length).toBeGreaterThan(0)
    for (const theme of vocabThemes) {
      expect(theme.trackable).toBe(false)
    }
  })

  it('should have grammar topics marked as trackable', () => {
    const grammarLeaves = CURRICULUM.filter(
      (t) => !t.is_category && t.id.includes('.grammar.')
    )
    expect(grammarLeaves.length).toBeGreaterThan(0)
    for (const topic of grammarLeaves) {
      expect(topic.trackable).toBe(true)
    }
  })

  it('should compute topic counts per level (trackable only)', () => {
    for (const level of CEFR_LEVELS) {
      const trackable = getTrackableTopics(level.level)
      expect(level.topic_count).toBe(trackable.length)
      expect(level.topic_count).toBeGreaterThan(0)
    }
  })

  it('should have sensible mastery constants', () => {
    expect(MASTERY_THRESHOLD).toBe(0.8)
    expect(MASTERY_MIN_EXERCISES).toBe(8)
    expect(LEVEL_ADVANCEMENT_THRESHOLD).toBe(0.7)
  })
})

describe('getTopic', () => {
  it('should find a topic by ID', () => {
    const topic = getTopic('a1.grammar.verbs.present_regular')
    expect(topic).toBeDefined()
    expect(topic!.name).toBe('Present Tense — Regular')
    expect(topic!.level).toBe('A1')
    expect(topic!.trackable).toBe(true)
  })

  it('should return undefined for unknown ID', () => {
    expect(getTopic('nonexistent')).toBeUndefined()
  })
})

describe('getTrackableTopics', () => {
  it('should return only trackable grammar topics', () => {
    const trackable = getTrackableTopics('A1')
    for (const topic of trackable) {
      expect(topic.trackable).toBe(true)
      expect(topic.is_category).toBe(false)
    }
    // A1 has 18 grammar leaf topics
    expect(trackable.length).toBe(18)
  })
})

describe('getLeafTopics', () => {
  it('should return all non-category topics (trackable + vocab themes)', () => {
    const leaves = getLeafTopics('A1')
    for (const leaf of leaves) {
      expect(leaf.is_category).toBe(false)
    }
    // A1: 18 grammar + 8 vocabulary themes = 26
    expect(leaves.length).toBe(26)
  })
})

describe('getChildren', () => {
  it('should return direct children of a category', () => {
    const children = getChildren('a1.grammar.verbs')
    expect(children.length).toBeGreaterThan(0)
    for (const child of children) {
      expect(child.parent_id).toBe('a1.grammar.verbs')
    }
  })
})

describe('getAncestorIds', () => {
  it('should return ancestor chain for a leaf topic', () => {
    const ancestors = getAncestorIds('a1.grammar.verbs.present_regular')
    expect(ancestors).toEqual(['a1.grammar.verbs', 'a1.grammar'])
  })

  it('should return empty array for top-level category', () => {
    const ancestors = getAncestorIds('a1.grammar')
    expect(ancestors).toEqual([])
  })
})

describe('getLevelMeta', () => {
  it('should return metadata for each level', () => {
    const meta = getLevelMeta('A1')
    expect(meta).toBeDefined()
    expect(meta!.name).toBe('Beginner')
    expect(meta!.vocab_benchmark.min).toBe(500)
    expect(meta!.vocab_benchmark.max).toBe(1000)
  })
})
