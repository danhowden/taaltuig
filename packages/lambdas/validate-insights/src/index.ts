import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { TaaltuigDynamoDBClient, InsightStatus } from '@taaltuig/dynamodb-client'
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

const cloudWatchClient = new CloudWatchClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

/**
 * Emit CloudWatch metrics for insights validation
 */
async function emitMetrics(
  cardsProcessed: number,
  insightsApproved: number,
  insightsRejected: number
): Promise<void> {
  try {
    const timestamp = new Date()
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'Taaltuig/Insights',
        MetricData: [
          {
            MetricName: 'CardsProcessed',
            Value: cardsProcessed,
            Unit: 'Count',
            Timestamp: timestamp,
          },
          {
            MetricName: 'InsightsApproved',
            Value: insightsApproved,
            Unit: 'Count',
            Timestamp: timestamp,
          },
          {
            MetricName: 'InsightsRejected',
            Value: insightsRejected,
            Unit: 'Count',
            Timestamp: timestamp,
          },
        ],
      })
    )
    console.log(
      `Emitted metrics: cards=${cardsProcessed}, approved=${insightsApproved}, rejected=${insightsRejected}`
    )
  } catch (err) {
    // Log but don't fail the request if metrics fail
    console.error('Failed to emit CloudWatch metrics:', err)
  }
}

// Use Haiku 4.5 for validation (cross-region inference profile) - fast and cost-effective
const VALIDATOR_MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

const SYSTEM_PROMPT = `You are validating AI-generated Dutch vocabulary insights. Be strict - reject anything that doesn't provide clear learning value.

## Validation Criteria by Type

**compound:**
- REJECT by default — only approve truly surprising breakdowns
- REJECT if: either part is a cognate (sounds like English), the English translation already implies the breakdown (e.g., "ziekenhuis" → hospital is obviously "sick house"), it's a simple prefix/suffix pattern (on-/be-/ver-/-heid/-lijk), or the parts are basic words the learner already knows
- APPROVE only if: both parts are non-obvious to English speakers AND the breakdown creates a genuine "aha" moment that aids memory

**verb_forms:**
- APPROVE if: forms are correct AND verb is truly irregular (not just spelling change)
- REJECT if: forms incorrect, or verb follows regular -te/-de, ge-t/-d patterns

**root:**
- APPROVE if: etymology is accurate AND creates genuine "aha" understanding
- REJECT if: speculation, vague "related to" claims, or doesn't help memory

**pronunciation:**
- REJECT by default — only approve for truly alien sounds
- REJECT if: the sound is oe, ij, or sch (common enough that learners pick them up quickly), the word is short/simple, the pronunciation is guessable from spelling, or the description is vague
- APPROVE only if: the sound is genuinely alien to English speakers (ui, eu, harsh g) AND the description is concrete and actionable

**confusable:**
- APPROVE if: words genuinely look/sound similar AND learners actually confuse them. Dutch homonyms (same spelling, different meaning) are excellent confusables — e.g. "bank" (couch vs financial bank)
- REJECT if: tenuous connection or unlikely confusion

**example:**
- APPROVE if: shows non-obvious usage, idiom, or surprising grammar pattern
- REJECT if: basic sentence structure, obvious usage, or too long (>8 Dutch words)

**plural:**
- APPROVE if: plural form is genuinely irregular or unexpected
- REJECT if: follows regular -en/-s patterns, or plural is obvious

**separable_verb:**
- APPROVE if: correctly identifies separable prefix AND shows useful separation example
- REJECT if: verb isn't actually separable, or separation pattern is obvious

## Output Format
Return ONLY valid JSON array, no markdown, no explanation. Start directly with [

Example:
[{"card_id":"abc123","insights":[{"index":0,"approved":true},{"index":1,"approved":false,"reason":"Too obvious for English speakers"}]}]`

interface ValidateInsightsRequest {
  card_ids: string[]
}

interface CardForValidation {
  card_id: string
  front: string
  back: string
  insights: Array<{
    index: number
    type: string
    content: string
  }>
}

interface ValidationResult {
  card_id: string
  insights: Array<{
    index: number
    approved: boolean
    reason?: string
  }>
}

/**
 * POST /api/insights/validate
 *
 * Validate pending insights using Haiku 3.5
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

    const { card_ids } = parsed.data as ValidateInsightsRequest

    if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
      return badRequestResponse('card_ids array is required', 'VALIDATION_ERROR')
    }

    if (card_ids.length > 20) {
      return badRequestResponse(
        'Maximum 20 cards per batch',
        'VALIDATION_ERROR'
      )
    }

    // Fetch cards from database
    const cards = await dbClient.getCardsByIds(userId, card_ids)

    // Filter to only cards with pending insights
    const cardsWithPendingInsights = cards.filter(
      (c) =>
        c.insights &&
        c.insights.some((i) => i.status === 'pending')
    )

    if (cardsWithPendingInsights.length === 0) {
      return badRequestResponse(
        'No cards with pending insights found',
        'NOT_FOUND'
      )
    }

    // Build input for the model
    const cardInputs: CardForValidation[] = cardsWithPendingInsights.map((c) => ({
      card_id: c.card_id,
      front: c.front,
      back: c.back,
      insights: (c.insights || [])
        .map((i, index) => ({
          index,
          type: i.type,
          content: i.content,
          status: i.status,
        }))
        .filter((i) => i.status === 'pending')
        .map(({ index, type, content }) => ({ index, type, content })),
    }))

    // Log input cards being processed
    console.log('=== VALIDATE INSIGHTS: Processing cards ===')
    for (const card of cardInputs) {
      console.log(`Card: "${card.front}" → "${card.back}"`)
      for (const insight of card.insights) {
        console.log(`  [${insight.type}] ${insight.content}`)
      }
    }

    // Call Bedrock with JSON prefill
    const modelRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Validate these Dutch vocabulary insights:\n\n${JSON.stringify(cardInputs, null, 2)}`,
        },
        {
          role: 'assistant',
          content: '[',
        },
      ],
    }

    const command = new InvokeModelCommand({
      modelId: VALIDATOR_MODEL,
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
    let validationResults: ValidationResult[]
    try {
      // Prepend '[' since we used assistant prefill with '['
      let jsonText = '[' + textContent.text.trim()
      if (jsonText.startsWith('[```')) {
        jsonText = jsonText.replace(/^\[```json?\n?/, '[').replace(/\n?```$/, '')
      }
      const parsed = JSON.parse(jsonText) as unknown[]

      // Normalize response: model may return flat array of {card_id, index, approved, reason}
      // instead of nested {card_id, insights: [{index, approved, reason}]}
      if (
        parsed.length > 0 &&
        !Array.isArray(
          (parsed[0] as Record<string, unknown>).insights
        ) &&
        'index' in (parsed[0] as Record<string, unknown>)
      ) {
        console.log('Normalizing flat validation response to nested format')
        const grouped = new Map<
          string,
          Array<{ index: number; approved: boolean; reason?: string }>
        >()
        for (const item of parsed) {
          const flat = item as {
            card_id: string
            index: number
            approved: boolean
            reason?: string
          }
          if (!grouped.has(flat.card_id)) {
            grouped.set(flat.card_id, [])
          }
          grouped.get(flat.card_id)!.push({
            index: flat.index,
            approved: flat.approved,
            reason: flat.reason,
          })
        }
        validationResults = Array.from(grouped.entries()).map(
          ([card_id, insights]) => ({ card_id, insights })
        )
      } else {
        validationResults = parsed as ValidationResult[]
      }

      // Guard against entries with missing/invalid insights arrays
      validationResults = validationResults.filter((v) => {
        if (!v.card_id || !Array.isArray(v.insights)) {
          console.warn('Skipping invalid validation entry:', JSON.stringify(v))
          return false
        }
        return true
      })
    } catch {
      console.error('Failed to parse model response:', textContent.text)
      return serverErrorResponse(
        new Error('Failed to parse model response as JSON'),
        true
      )
    }

    // Log validation decisions
    console.log('=== VALIDATE INSIGHTS: AI Decisions ===')
    for (const validation of validationResults) {
      const card = cardInputs.find((c) => c.card_id === validation.card_id)
      const cardLabel = card ? `"${card.front}" → "${card.back}"` : validation.card_id

      for (const insight of validation.insights) {
        const insightData = card?.insights.find((i) => i.index === insight.index)
        const insightLabel = insightData
          ? `[${insightData.type}] ${insightData.content}`
          : `index ${insight.index}`

        if (insight.approved) {
          console.log(`✓ APPROVED: ${cardLabel}`)
          console.log(`  ${insightLabel}`)
        } else {
          console.log(`✗ REJECTED: ${cardLabel}`)
          console.log(`  ${insightLabel}`)
          console.log(`  Reason: ${insight.reason || 'No reason provided'}`)
        }
      }
    }

    // Update insights in database
    // For approved: update status to 'approved' with reviewed_by: 'ai'
    // For rejected: delete the insight entirely
    const results: Array<{
      card_id: string
      approved: number
      deleted: number
    }> = []
    const failed: string[] = []

    for (const validation of validationResults) {
      try {
        const approvedInsights = validation.insights.filter((i) => i.approved)
        const rejectedInsights = validation.insights.filter((i) => !i.approved)

        // First, update approved insights
        if (approvedInsights.length > 0) {
          const updates = approvedInsights.map((i) => ({
            index: i.index,
            status: 'approved' as InsightStatus,
          }))
          await dbClient.bulkUpdateInsightsStatus(userId, validation.card_id, updates)
        }

        // Then, delete rejected insights (in reverse order to preserve indices)
        const sortedRejected = [...rejectedInsights].sort((a, b) => b.index - a.index)
        for (const rejected of sortedRejected) {
          await dbClient.deleteInsight(userId, validation.card_id, rejected.index)
        }

        results.push({
          card_id: validation.card_id,
          approved: approvedInsights.length,
          deleted: rejectedInsights.length,
        })
      } catch (err) {
        console.error(`Failed to update card ${validation.card_id}:`, err)
        failed.push(validation.card_id)
      }
    }

    // Emit CloudWatch metrics (async, non-blocking)
    const totalApproved = results.reduce((sum, r) => sum + r.approved, 0)
    const totalRejected = results.reduce((sum, r) => sum + r.deleted, 0)
    await emitMetrics(cardsWithPendingInsights.length, totalApproved, totalRejected)

    return jsonResponse({
      validated: results,
      failed: failed.length > 0 ? failed : undefined,
    } as { validated: typeof results; failed?: string[] })
  } catch (error) {
    console.error('Error in validateInsights:', error)
    return serverErrorResponse(error, true)
  }
}
