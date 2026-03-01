import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { TaaltuigDynamoDBClient, CardInsight, DEFAULT_SETTINGS } from '@taaltuig/dynamodb-client'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  missingBodyResponse,
  invalidJsonResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const TABLE_NAME = process.env.TABLE_NAME!
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

// Use Sonnet 4.5 for generation (cross-region inference profile)
const GENERATOR_MODEL = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'

const SYSTEM_PROMPT = `You are a Dutch language expert. Generate insights ONLY when they provide genuine "aha moment" learning value. Most cards need zero insights.

## Insight Types (use sparingly)

1. **compound**: Break down compound words
   - ONLY when BOTH parts are non-obvious to an English speaker
   - SKIP if either part is a cognate or already known from the card context
   - SKIP simple prefix/suffix patterns (e.g., on-, be-, ver-, -heid, -lijk)
   - SKIP if the English translation already reveals the compound (e.g., "ziekenhuis" = hospital — "sick house" is already implied)
   - The bar is HIGH: most compound words should NOT get this insight
   - Format: "part1 (meaning) + part2 (meaning)"

2. **verb_forms**: Key verb forms for irregular verbs
   - ONLY for truly irregular verbs (NOT regular -te/-de patterns)
   - Include: irregular present (if any), past, past participle, imperative (if unusual)
   - Format: "present: [if irregular], past: [form], pp: [form], imp: [if unusual]"

3. **root**: Etymology that unlocks meaning
   - ONLY when etymology genuinely helps remember the word
   - Skip vague connections like "related to German..."
   - Format: "from [root] meaning [X]"

4. **pronunciation**: Tricky sounds for English speakers
   - ONLY for sounds that are truly alien to English (e.g., ui, eu, harsh g)
   - SKIP oe, ij, sch — these are common and learners pick them up quickly
   - SKIP single-letter sounds that work similarly in English
   - SKIP if the word is short/simple enough that pronunciation is obvious
   - Generate this type VERY rarely — at most 1 in 20 cards
   - Format: "[letters] sounds like [description]"

5. **confusable**: Commonly confused word pairs
   - ONLY for words learners actually mix up
   - Must be genuinely similar in sound or spelling
   - Format: "vs [word] ([meaning])"

6. **example**: Short example sentence showing usage
   - ONLY when the word has non-obvious usage patterns
   - ONLY for idioms, collocations, or grammar that surprises
   - Skip basic "Ik heb een X" sentences
   - Format: "sentence — translation" (max 8 words Dutch)

7. **plural**: Irregular or tricky plural forms
   - ONLY for nouns with unexpected plural patterns
   - Skip regular -en/-s plurals
   - Format: "plural: [form]"

8. **separable_verb**: Separable verb information
   - ONLY for separable verbs where prefix separation isn't obvious
   - Format: "[prefix] + [stem]: [example showing separation]"

## Rules
- Generate 0-3 insights per card (empty array is fine and expected)
- Fewer is better - only add insights that genuinely help
- Only add insight if it genuinely helps memorization
- Never generate just to have something
- Skip obvious cognates entirely
- Be concise (max 60 chars)

## Output
JSON array only, no markdown. Start directly with [`

interface GenerateInsightsRequest {
  card_ids: string[]
}

interface CardInput {
  card_id: string
  front: string
  back: string
}

interface GeneratedCardInsights {
  card_id: string
  insights: Array<{
    type: string
    content: string
  }>
}

/**
 * POST /api/insights/generate
 *
 * Generate AI insights for vocabulary cards using Sonnet 4.5
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    const parsed = parseJsonBody(event)
    if (parsed.error === 'MISSING_BODY') return missingBodyResponse()
    if (parsed.error === 'INVALID_JSON') return invalidJsonResponse()

    const { card_ids } = parsed.data as GenerateInsightsRequest

    if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
      return badRequestResponse('card_ids array is required', 'VALIDATION_ERROR')
    }

    if (card_ids.length > 20) {
      return badRequestResponse(
        'Maximum 20 cards per batch',
        'VALIDATION_ERROR'
      )
    }

    // Fetch cards and user settings in parallel
    const [cards, settings] = await Promise.all([
      dbClient.getCardsByIds(userId, card_ids),
      dbClient.getSettings(userId),
    ])
    if (cards.length === 0) {
      return badRequestResponse('No valid cards found', 'NOT_FOUND')
    }

    const proficiencyLevel = settings?.proficiency_level ?? DEFAULT_SETTINGS.proficiency_level

    // Build input for the model
    const cardInputs: CardInput[] = cards.map((c) => ({
      card_id: c.card_id,
      front: c.front,
      back: c.back,
    }))

    // Log input cards being processed
    console.log('=== GENERATE INSIGHTS: Processing cards ===')
    console.log(`User proficiency level: ${proficiencyLevel}`)
    for (const card of cardInputs) {
      console.log(`Card: "${card.front}" → "${card.back}"`)
    }

    // Build user message with few-shot examples
    const userMessage = `Generate insights for these Dutch vocabulary cards.

## User Context
Proficiency level: ${proficiencyLevel}
- beginner: Explain more, include basic patterns
- intermediate: Focus on nuances and exceptions
- advanced: Only rare/surprising information

## Few-shot Examples

### Example 1: Separable verb with useful insight
Card: "opbellen" → "to call (phone)"
Good insight: {"type": "separable_verb", "content": "op + bellen: Ik bel je op (I'll call you)"}

### Example 2: Truly irregular verb
Card: "zijn" → "to be"
Good insight: {"type": "verb_forms", "content": "present: ben/bent/is/zijn, past: was/waren, pp: geweest"}

### Example 3: Compound that illuminates meaning
Card: "vliegtuig" → "airplane"
Good insight: {"type": "compound", "content": "vlieg (fly) + tuig (craft/equipment)"}

### Example 3b: When to skip compound (too obvious)
Card: "ziekenhuis" → "hospital"
Response: {"card_id": "...", "insights": []}
Reason: "sick house" is already implied by the English meaning — not a genuine aha moment

### Example 4: When to return empty (regular verb)
Card: "werken" → "to work"
Response: {"card_id": "...", "insights": []}
Reason: werken follows regular patterns (werkte, gewerkt) - no insight needed

### Example 5: When to return empty (obvious cognate)
Card: "telefoon" → "telephone"
Response: {"card_id": "...", "insights": []}
Reason: obvious cognate, no insight needed

### Example 6: Irregular plural
Card: "kind" → "child"
Good insight: {"type": "plural", "content": "plural: kinderen (not *kinden)"}

## Cards to process:
${JSON.stringify(cardInputs, null, 2)}`

    // Call Bedrock with JSON prefill
    const modelRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
        {
          role: 'assistant',
          content: '[',
        },
      ],
    }

    const command = new InvokeModelCommand({
      modelId: GENERATOR_MODEL,
      body: JSON.stringify(modelRequest),
      contentType: 'application/json',
      accept: 'application/json',
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    // Extract text content from response
    const textContent = responseBody.content?.find(
      (c: { type: string }) => c.type === 'text'
    )
    if (!textContent?.text) {
      return serverErrorResponse(new Error('No text response from model'), true)
    }

    // Parse JSON from response (prepend '[' since we used assistant prefill)
    let generatedInsights: GeneratedCardInsights[]
    try {
      // Prepend '[' since we used assistant prefill with '['
      let jsonText = '[' + textContent.text.trim()
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      if (jsonText.startsWith('[```')) {
        jsonText = jsonText.replace(/^\[```json?\n?/, '[').replace(/\n?```$/, '')
      }
      generatedInsights = JSON.parse(jsonText)
    } catch {
      console.error('Failed to parse model response:', textContent.text)
      return serverErrorResponse(
        new Error('Failed to parse model response as JSON'),
        true
      )
    }

    // Store insights on cards
    const now = new Date().toISOString()
    const results: Array<{ card_id: string; insights_count: number }> = []
    const failed: string[] = []

    for (const generated of generatedInsights) {
      try {
        // Convert to CardInsight format with pending status
        const insights: CardInsight[] = generated.insights.map((i) => ({
          type: i.type as CardInsight['type'],
          content: i.content,
          status: 'pending' as const,
          generated_at: now,
        }))

        await dbClient.updateCardInsights(userId, generated.card_id, insights)
        results.push({
          card_id: generated.card_id,
          insights_count: insights.length,
        })
      } catch (err) {
        console.error(`Failed to update card ${generated.card_id}:`, err)
        failed.push(generated.card_id)
      }
    }

    return jsonResponse({
      generated: results,
      failed: failed.length > 0 ? failed : undefined,
    })
  } catch (error) {
    console.error('Error in generateInsights:', error)
    return serverErrorResponse(error, true)
  }
}
