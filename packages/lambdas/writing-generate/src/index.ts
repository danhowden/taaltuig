import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import type { WritingExercise, ExerciseType, State } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

// Use Sonnet 4.5 for exercise generation (cross-region inference profile)
const GENERATOR_MODEL = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'

const SYSTEM_PROMPT = `You are a Dutch language exercise generator. Create natural, pedagogically valuable Dutch sentences that incorporate specific vocabulary words.

## Exercise Types

You MUST generate a mix of these three types in the ratio specified by the user.

### fill_blank
Show a Dutch sentence with one word replaced by "___". The user types the missing word.

The ONLY valid blanking strategies are:
1. **Articles**: de/het — the rest of the sentence contains a noun where only one article is correct. E.g., "___ huis is groot" → "het"
2. **Prepositions**: where the verb or context requires a specific preposition. E.g., "Ik wacht ___ de bus" → "op"
3. **Auxiliary verbs**: ben/bent/is/zijn/heb/heeft/hebben — in a sentence with a past participle or specific structure. E.g., "Ik ___ gisteren naar de winkel gelopen" → "ben"
4. **Verb conjugation**: give the infinitive in parentheses and blank the conjugated form. E.g., "Hij ___ (lopen) elke dag naar school" → "loopt"

NEVER blank: nouns, adjectives, numbers, adverbs, pronouns, months, time words, or any word where multiple categories of words could fit. If you can imagine 3+ unrelated words filling the blank, it's a bad exercise.

- reference_answer is the single missing word (NOT the full sentence)
- alternatives: other valid words that could fill the blank
- Sentences should be 5-10 words long

### word_reorder
Show Dutch words in scrambled order. The user arranges them into the correct sentence.
- Only use when word order is pedagogically interesting (inversion, subordinate clauses, verb-final, time-manner-place)
- prompt: words separated by " / " in scrambled order — scramble thoroughly
- CRITICAL: all words must be in their final conjugated/declined forms as they appear in the answer. The user is testing word ORDER, not conjugation. If the answer is "Ik word twintig", the prompt must contain "word" NOT "worden"
- The first word should NOT be capitalized in the scramble (the user figures out which word starts the sentence)
- reference_answer: the correctly ordered sentence
- alternatives: other valid orderings if they exist (usually empty for Dutch)
- Sentences should be 5-8 words long
- Example: { "type": "word_reorder", "prompt": "de / naar / loop / winkel / ik", "reference_answer": "Ik loop naar de winkel", "alternatives": [] }

### translation
Show an English sentence. The user writes the Dutch translation.
- The English prompt must be unambiguous — avoid sentences with multiple valid interpretations
- reference_answer: the primary correct Dutch translation
- alternatives: other valid Dutch translations (2-4 alternatives)
- Sentences should be 5-10 words long
- Example: { "type": "translation", "prompt": "I walk to the store", "reference_answer": "Ik loop naar de winkel", "alternatives": ["Ik wandel naar de winkel"] }

## Rules
- Sentences must be natural Dutch that a native speaker would actually say
- Difficulty should match the specified CEFR level
- Each exercise must use at least one target vocabulary word
- Vary sentence structures and grammar patterns — do NOT repeat the same pattern
- Each exercise should test a different grammar point or vocabulary usage
- Focus on phrases and sentences, not single words
- Do NOT generate trivially easy exercises (e.g., "De ___ is groot" where the blank is obvious from context)

## Output
Return a JSON array only, no markdown. Start directly with [

Each exercise object must have:
- type: one of "fill_blank", "word_reorder", "translation"
- prompt: what the user sees
- reference_answer: the correct answer
- alternatives: array of other valid answers
- target_words: array of Dutch words from the vocabulary list that this exercise uses
- grammar_focus: brief description of the grammar pattern tested (e.g., "present tense", "word order", "perfectum")
`

interface GenerateRequest {
  card_id?: string
  exercise_type?: ExerciseType
}

interface GeneratedExercise {
  type: string
  prompt: string
  reference_answer: string
  alternatives: string[]
  target_words: string[]
  grammar_focus: string
}

interface VocabCard {
  card_id: string
  front: string
  back: string
  state: State
  ease_factor: number
  last_reviewed?: string
  due_date: string
}

/**
 * Score a vocabulary card for exercise generation priority.
 * Higher score = more likely to be selected.
 */
export function scoreVocabularyCard(card: VocabCard, now: Date): number {
  let score = 0

  // Recently reviewed cards get high weight
  if (card.last_reviewed) {
    const reviewDate = new Date(card.last_reviewed)
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceReview <= 7) score += 30
    else if (daysSinceReview <= 14) score += 20
    else if (daysSinceReview <= 30) score += 10
  }

  // Low ease factor = struggling with this card
  if (card.ease_factor < 2.0) score += 25
  else if (card.ease_factor < 2.3) score += 15

  // LEARNING/RELEARNING cards get medium weight
  if (card.state === 'LEARNING' || card.state === 'RELEARNING') score += 20

  // NEW cards get low weight (~20% inclusion target)
  if (card.state === 'NEW') score += 5

  // Due soon = prime for recall
  const dueDate = new Date(card.due_date)
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (daysUntilDue <= 3 && daysUntilDue > 0) score += 15

  // Well-known cards get low weight
  if (card.state === 'REVIEW' && card.ease_factor >= 2.5 && !card.last_reviewed) {
    score += 1
  }

  return score
}

/**
 * Filter out trivial vocabulary not worth generating exercises for.
 */
export function isContentWord(front: string): boolean {
  const trivialWords = new Set([
    'de', 'het', 'een', 'ja', 'nee', 'en', 'of', 'is', 'in', 'op',
    'te', 'van', 'dat', 'die', 'er', 'aan', 'met', 'niet', 'ook',
    'al', 'om', 'dan', 'maar', 'als', 'nog', 'wel', 'bij', 'zo',
  ])

  const normalized = front.toLowerCase().trim()
  if (normalized.length <= 1) return false
  return !trivialWords.has(normalized)
}

/**
 * Select and weight vocabulary for exercise generation.
 */
export function selectVocabulary(
  allCards: VocabCard[],
  recentExerciseCardIds: Set<string>,
  batchSize: number,
  now: Date
): VocabCard[] {
  // Filter out trivial words and cards already in pending exercises
  const eligible = allCards.filter(
    (card) => isContentWord(card.front) && !recentExerciseCardIds.has(card.card_id)
  )

  if (eligible.length === 0) return []

  // Score and sort
  const scored = eligible.map((card) => ({
    card,
    score: scoreVocabularyCard(card, now),
  }))
  scored.sort((a, b) => b.score - a.score)

  // Take top candidates, but include some randomization
  // Take 2x the needed amount, then randomly sample
  const candidatePool = scored.slice(0, batchSize * 3)
  const selected: VocabCard[] = []
  const remaining = [...candidatePool]

  while (selected.length < batchSize && remaining.length > 0) {
    // Weighted random: higher scored items more likely to be picked
    const totalScore = remaining.reduce((sum, item) => sum + item.score + 1, 0)
    let random = Math.random() * totalScore
    let idx = 0
    for (let i = 0; i < remaining.length; i++) {
      random -= remaining[i].score + 1
      if (random <= 0) {
        idx = i
        break
      }
    }
    selected.push(remaining[idx].card)
    remaining.splice(idx, 1)
  }

  return selected
}

/**
 * Call Bedrock to generate exercises from vocabulary.
 */
async function generateExercisesFromAI(
  vocabulary: VocabCard[],
  exerciseCount: number
): Promise<GeneratedExercise[]> {
  const vocabList = vocabulary
    .map((v) => `- ${v.front} → ${v.back}`)
    .join('\n')

  const fillCount = Math.round(exerciseCount * 0.5)
  const reorderCount = Math.round(exerciseCount * 0.25)
  const translationCount = exerciseCount - fillCount - reorderCount

  const userPrompt = `Generate exactly ${exerciseCount} exercises using these Dutch vocabulary words:

${vocabList}

Generate this exact mix:
- ${fillCount} fill_blank exercises
- ${reorderCount} word_reorder exercises
- ${translationCount} translation exercises

Target CEFR A1-A2 level. Each exercise should test a different grammar point or word usage.`

  const response = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: GENERATOR_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    })
  )

  const responseBody = JSON.parse(new TextDecoder().decode(response.body))
  const content = responseBody.content?.[0]?.text || '[]'

  // Parse the JSON response — strip markdown fences if present
  const jsonText = content.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const exercises: GeneratedExercise[] = JSON.parse(jsonText)

  return exercises
}

/**
 * Build WritingExercise entities from AI-generated exercises.
 */
export function buildExerciseEntities(
  userId: string,
  generated: GeneratedExercise[],
  vocabulary: VocabCard[],
  source: 'auto' | 'user_requested',
  timestamp: string
): WritingExercise[] {
  // Build a lookup from Dutch word to card_id
  const wordToCardId = new Map<string, string>()
  for (const card of vocabulary) {
    wordToCardId.set(card.front.toLowerCase().trim(), card.card_id)
  }

  return generated.map((exercise, index) => {
    const exerciseId = `${timestamp.replace(/[:.]/g, '-')}-${index}`

    // Map target_words back to card_ids
    const targetVocabulary: string[] = []
    for (const word of exercise.target_words || []) {
      const cardId = wordToCardId.get(word.toLowerCase().trim())
      if (cardId) targetVocabulary.push(cardId)
    }

    // If no target words matched, try to find cards whose front appears in the reference answer
    if (targetVocabulary.length === 0) {
      for (const card of vocabulary) {
        if (exercise.reference_answer.toLowerCase().includes(card.front.toLowerCase())) {
          targetVocabulary.push(card.card_id)
        }
      }
    }

    const priority = source === 'user_requested' ? 'high' : 'normal'

    return {
      PK: `USER#${userId}`,
      SK: `EXERCISE#${exerciseId}`,
      GSI2PK: `USER#${userId}#WRITING_POOL`,
      GSI2SK: `pending#${timestamp}`,
      exercise_id: exerciseId,
      type: (exercise.type || 'translation') as ExerciseType,
      status: 'pending' as const,
      source,
      priority,
      prompt: exercise.prompt,
      reference_answer: exercise.reference_answer,
      alternatives: exercise.alternatives || [],
      target_vocabulary: targetVocabulary,
      grammar_focus: exercise.grammar_focus,
      generated_at: timestamp,
    }
  })
}

/**
 * POST /api/writing/generate
 *
 * Generate writing exercises from vocabulary.
 * Optional body: { card_id?: string, exercise_type?: string }
 * - If card_id provided: generate exercises for that specific card (user-requested, high priority)
 * - If no card_id: generate a batch from the full vocabulary corpus (auto, normal priority)
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      console.log('No userId found in event')
      return unauthorizedResponse()
    }

    console.log(`Starting exercise generation for user ${userId}`)

    // Parse optional body
    let cardId: string | undefined
    let _exerciseType: ExerciseType | undefined
    const parsed = parseJsonBody(event)
    if (parsed.data) {
      const body = parsed.data as GenerateRequest
      cardId = body.card_id
      _exerciseType = body.exercise_type
    }

    const source = cardId ? 'user_requested' : 'auto'
    const batchSize = cardId ? 5 : 20

    console.log(`Mode: ${source}, batchSize: ${batchSize}, cardId: ${cardId || 'none'}`)

    // Get vocabulary
    let vocabulary: VocabCard[]

    if (cardId) {
      // User-requested: generate for a specific card
      const allVocab = await dbClient.getVocabularyForGeneration(userId)
      const targetCard = allVocab.find((v) => v.card_id === cardId)
      if (!targetCard) {
        console.log(`Card ${cardId} not found in vocabulary`)
        return badRequestResponse('Card not found')
      }

      // Include the target card plus some context vocabulary
      const contextCards = allVocab
        .filter((v) => v.card_id !== cardId && isContentWord(v.front))
        .slice(0, 10)
      vocabulary = [targetCard, ...contextCards]
    } else {
      // Auto: select from full corpus
      const [allVocab, recentCardIds] = await Promise.all([
        dbClient.getVocabularyForGeneration(userId),
        dbClient.getRecentExerciseCardIds(userId),
      ])

      console.log(`Vocabulary pool: ${allVocab.length} cards, ${recentCardIds.size} already in exercises`)

      vocabulary = selectVocabulary(allVocab, recentCardIds, batchSize, new Date())

      if (vocabulary.length === 0) {
        console.log('No eligible vocabulary for exercise generation')
        return jsonResponse({
          exercises_generated: 0,
          message: 'No eligible vocabulary for exercise generation',
        })
      }
    }

    console.log(`Selected ${vocabulary.length} vocabulary words for generation`)

    // Generate exercises via AI
    console.log('Calling Bedrock for exercise generation...')
    const generated = await generateExercisesFromAI(vocabulary, batchSize)
    console.log(`Bedrock returned ${generated.length} exercises`)

    if (generated.length === 0) {
      console.log('AI generated no exercises')
      return jsonResponse({
        exercises_generated: 0,
        message: 'AI generated no exercises',
      })
    }

    // Build and store exercise entities
    const timestamp = new Date().toISOString()
    const exercises = buildExerciseEntities(userId, generated, vocabulary, source, timestamp)

    console.log(`Storing ${exercises.length} exercises...`)
    await dbClient.storeExercises(userId, exercises)
    console.log(`Successfully stored ${exercises.length} exercises`)

    return jsonResponse({
      exercises_generated: exercises.length,
      source,
    })
  } catch (error) {
    console.error('Error generating writing exercises:', error)
    return serverErrorResponse('Failed to generate writing exercises')
  }
}
