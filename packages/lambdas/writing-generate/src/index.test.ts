import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks with vi.hoisted to ensure they're available during mock factory execution
const { mockGetVocabularyForGeneration, mockGetRecentExerciseCardIds, mockStoreExercises } = vi.hoisted(() => ({
  mockGetVocabularyForGeneration: vi.fn(),
  mockGetRecentExerciseCardIds: vi.fn(),
  mockStoreExercises: vi.fn(),
}))

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      getVocabularyForGeneration: mockGetVocabularyForGeneration,
      getRecentExerciseCardIds: mockGetRecentExerciseCardIds,
      storeExercises: mockStoreExercises,
    })),
  }
})

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify([
              {
                type: 'translation',
                prompt: 'I walk to the store',
                reference_answer: 'Ik loop naar de winkel',
                alternatives: ['Ik wandel naar de winkel'],
                target_words: ['lopen', 'winkel'],
                grammar_focus: 'present tense',
              },
              {
                type: 'translation',
                prompt: 'The house is big',
                reference_answer: 'Het huis is groot',
                alternatives: [],
                target_words: ['huis', 'groot'],
                grammar_focus: 'adjectives',
              },
            ]),
          }],
        })),
      }),
    })),
    InvokeModelCommand: vi.fn(),
  }
})

const { handler, scoreVocabularyCard, isContentWord, selectVocabulary, buildExerciseEntities } = await import('./index')

function makeVocabCard(overrides: Partial<{
  card_id: string
  front: string
  back: string
  state: string
  ease_factor: number
  last_reviewed: string | undefined
  due_date: string
}> = {}) {
  return {
    card_id: overrides.card_id ?? 'card-1',
    front: overrides.front ?? 'lopen',
    back: overrides.back ?? 'to walk',
    state: (overrides.state ?? 'REVIEW') as 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING',
    ease_factor: overrides.ease_factor ?? 2.5,
    last_reviewed: 'last_reviewed' in overrides ? overrides.last_reviewed : '2026-03-14T10:00:00Z',
    due_date: overrides.due_date ?? '2026-03-18T00:00:00Z',
  }
}

function makeEvent(body?: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      authorizer: {
        jwt: { claims: { sub: 'user-123' } },
      },
    },
    body: body ? JSON.stringify(body) : undefined,
  } as unknown as APIGatewayProxyEventV2
}

describe('scoreVocabularyCard', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('gives high score to recently reviewed cards', () => {
    const card = makeVocabCard({ last_reviewed: '2026-03-14T10:00:00Z' })
    const score = scoreVocabularyCard(card, now)
    expect(score).toBeGreaterThanOrEqual(30)
  })

  it('gives high score to low ease factor cards', () => {
    const card = makeVocabCard({ ease_factor: 1.5, last_reviewed: undefined })
    const score = scoreVocabularyCard(card, now)
    expect(score).toBeGreaterThanOrEqual(25)
  })

  it('gives medium score to LEARNING state', () => {
    const card = makeVocabCard({ state: 'LEARNING', last_reviewed: undefined })
    const score = scoreVocabularyCard(card, now)
    expect(score).toBeGreaterThanOrEqual(20)
  })

  it('gives low score to NEW state with no other factors', () => {
    const card = makeVocabCard({ state: 'NEW', last_reviewed: undefined, due_date: '2026-12-01T00:00:00Z', ease_factor: 2.5 })
    const score = scoreVocabularyCard(card, now)
    expect(score).toBe(5)
  })

  it('gives bonus for cards due soon', () => {
    const card = makeVocabCard({ due_date: '2026-03-16T00:00:00Z', last_reviewed: undefined })
    const score = scoreVocabularyCard(card, now)
    expect(score).toBeGreaterThanOrEqual(15)
  })

  it('scores higher for recently reviewed + low ease', () => {
    const strongCard = makeVocabCard({ ease_factor: 2.8, last_reviewed: '2026-03-14T10:00:00Z' })
    const weakCard = makeVocabCard({ ease_factor: 1.5, last_reviewed: '2026-03-14T10:00:00Z' })
    expect(scoreVocabularyCard(weakCard, now)).toBeGreaterThan(scoreVocabularyCard(strongCard, now))
  })
})

describe('isContentWord', () => {
  it('returns true for content words', () => {
    expect(isContentWord('lopen')).toBe(true)
    expect(isContentWord('huis')).toBe(true)
    expect(isContentWord('winkel')).toBe(true)
  })

  it('returns false for trivial words', () => {
    expect(isContentWord('de')).toBe(false)
    expect(isContentWord('het')).toBe(false)
    expect(isContentWord('ja')).toBe(false)
    expect(isContentWord('en')).toBe(false)
  })

  it('returns false for single characters', () => {
    expect(isContentWord('a')).toBe(false)
    expect(isContentWord('x')).toBe(false)
  })

  it('handles whitespace and case', () => {
    expect(isContentWord(' De ')).toBe(false)
    expect(isContentWord(' Lopen ')).toBe(true)
  })
})

describe('selectVocabulary', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('filters out trivial words', () => {
    const cards = [
      makeVocabCard({ card_id: '1', front: 'de', back: 'the' }),
      makeVocabCard({ card_id: '2', front: 'lopen', back: 'to walk' }),
    ]
    const result = selectVocabulary(cards, new Set(), 5, now)
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('lopen')
  })

  it('excludes cards already in pending exercises', () => {
    const cards = [
      makeVocabCard({ card_id: '1', front: 'lopen', back: 'to walk' }),
      makeVocabCard({ card_id: '2', front: 'huis', back: 'house' }),
    ]
    const result = selectVocabulary(cards, new Set(['1']), 5, now)
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('huis')
  })

  it('returns empty array when no eligible cards', () => {
    const cards = [
      makeVocabCard({ card_id: '1', front: 'de', back: 'the' }),
    ]
    const result = selectVocabulary(cards, new Set(), 5, now)
    expect(result).toHaveLength(0)
  })

  it('respects batch size limit', () => {
    const cards = Array.from({ length: 20 }, (_, i) =>
      makeVocabCard({ card_id: `card-${i}`, front: `woord${i}`, back: `word${i}` })
    )
    const result = selectVocabulary(cards, new Set(), 5, now)
    expect(result).toHaveLength(5)
  })
})

describe('buildExerciseEntities', () => {
  const vocabulary = [
    makeVocabCard({ card_id: 'card-lopen', front: 'lopen', back: 'to walk' }),
    makeVocabCard({ card_id: 'card-winkel', front: 'winkel', back: 'store' }),
    makeVocabCard({ card_id: 'card-huis', front: 'huis', back: 'house' }),
    makeVocabCard({ card_id: 'card-groot', front: 'groot', back: 'big' }),
  ]

  const generated = [
    {
      type: 'translation',
      prompt: 'I walk to the store',
      reference_answer: 'Ik loop naar de winkel',
      alternatives: ['Ik wandel naar de winkel'],
      target_words: ['lopen', 'winkel'],
      grammar_focus: 'present tense',
    },
  ]

  const timestamp = '2026-03-15T12:00:00.000Z'

  it('builds exercise entities with correct structure', () => {
    const result = buildExerciseEntities('user-1', generated, vocabulary, 'auto', timestamp)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      PK: 'USER#user-1',
      SK: expect.stringContaining('EXERCISE#'),
      GSI2PK: 'USER#user-1#WRITING_POOL',
      GSI2SK: `pending#${timestamp}`,
      type: 'translation',
      status: 'pending',
      source: 'auto',
      priority: 'normal',
      prompt: 'I walk to the store',
      reference_answer: 'Ik loop naar de winkel',
      alternatives: ['Ik wandel naar de winkel'],
      target_vocabulary: ['card-lopen', 'card-winkel'],
      grammar_focus: 'present tense',
      generated_at: timestamp,
    })
  })

  it('sets high priority for user-requested exercises', () => {
    const result = buildExerciseEntities('user-1', generated, vocabulary, 'user_requested', timestamp)
    expect(result[0].source).toBe('user_requested')
    expect(result[0].priority).toBe('high')
  })

  it('falls back to reference answer matching when target_words dont match', () => {
    const genWithBadTargets = [{
      type: 'translation',
      prompt: 'The house is big',
      reference_answer: 'Het huis is groot',
      alternatives: [],
      target_words: ['nonexistent'],
      grammar_focus: 'adjectives',
    }]
    const result = buildExerciseEntities('user-1', genWithBadTargets, vocabulary, 'auto', timestamp)
    expect(result[0].target_vocabulary).toContain('card-huis')
    expect(result[0].target_vocabulary).toContain('card-groot')
  })
})

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('returns 401 when unauthorized', async () => {
    const event = { requestContext: { authorizer: {} } } as unknown as APIGatewayProxyEventV2
    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })

  it('generates exercises from full vocabulary corpus', async () => {
    const vocab = [
      makeVocabCard({ card_id: 'c1', front: 'lopen', back: 'to walk' }),
      makeVocabCard({ card_id: 'c2', front: 'winkel', back: 'store' }),
      makeVocabCard({ card_id: 'c3', front: 'huis', back: 'house' }),
      makeVocabCard({ card_id: 'c4', front: 'groot', back: 'big' }),
    ]
    mockGetVocabularyForGeneration.mockResolvedValue(vocab)
    mockGetRecentExerciseCardIds.mockResolvedValue(new Set())
    mockStoreExercises.mockResolvedValue(undefined)

    const event = makeEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises_generated).toBe(2)
    expect(body.source).toBe('auto')
    expect(mockStoreExercises).toHaveBeenCalledOnce()
  })

  it('generates exercises for a specific card (user-requested)', async () => {
    const vocab = [
      makeVocabCard({ card_id: 'target-card', front: 'lopen', back: 'to walk' }),
      makeVocabCard({ card_id: 'c2', front: 'winkel', back: 'store' }),
    ]
    mockGetVocabularyForGeneration.mockResolvedValue(vocab)
    mockStoreExercises.mockResolvedValue(undefined)

    const event = makeEvent({ card_id: 'target-card' })
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.source).toBe('user_requested')
    expect(mockStoreExercises).toHaveBeenCalledOnce()
  })

  it('returns 400 when card_id not found', async () => {
    mockGetVocabularyForGeneration.mockResolvedValue([])

    const event = makeEvent({ card_id: 'nonexistent' })
    const result = await handler(event)

    expect(result.statusCode).toBe(400)
  })

  it('returns success with 0 exercises when no eligible vocabulary', async () => {
    mockGetVocabularyForGeneration.mockResolvedValue([
      makeVocabCard({ card_id: '1', front: 'de', back: 'the' }),
    ])
    mockGetRecentExerciseCardIds.mockResolvedValue(new Set())
    mockStoreExercises.mockResolvedValue(undefined)

    const event = makeEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body as string)
    expect(body.exercises_generated).toBe(0)
  })

  it('handles server errors gracefully', async () => {
    mockGetVocabularyForGeneration.mockRejectedValue(new Error('DB error'))

    const event = makeEvent()
    const result = await handler(event)

    expect(result.statusCode).toBe(500)
  })
})
