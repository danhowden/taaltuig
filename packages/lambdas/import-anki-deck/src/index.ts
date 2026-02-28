import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import { Readable } from 'stream'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import JSZip from 'jszip'
import { readAnkiCollection } from 'anki-reader'
import { TaaltuigDynamoDBClient } from '@taaltuig/dynamodb-client'
import {
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

const s3Client = new S3Client({})
const TABLE_NAME = process.env.TABLE_NAME || 'taaltuig-main'
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT
const dbClient = new TaaltuigDynamoDBClient(TABLE_NAME)

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_UNCOMPRESSED_SIZE = 250 * 1024 * 1024 // 250MB

interface ImportRequest {
  s3Bucket: string
  s3Key: string
  collectionName?: string // Optional collection name for categorization
}

interface ProgressUpdate {
  stage: 'downloading' | 'parsing' | 'found' | 'importing' | 'complete' | 'error'
  message: string
  count?: number
  current?: number
  total?: number
  imported?: number
  skipped?: number
}

// Types for anki-reader library (which doesn't export types)
interface AnkiCard {
  getFields?: () => Record<string, string>
  getFront?: () => string
  getBack?: () => string
}

interface AnkiDeck {
  getCards: () => Record<string, AnkiCard>
  deckJson?: { name?: string }
}

// Helper to send progress updates via WebSocket
async function sendProgress(
  connectionId: string | undefined,
  update: ProgressUpdate
): Promise<void> {
  if (!connectionId || !WEBSOCKET_API_ENDPOINT) {
    return // Not a WebSocket request or no endpoint configured
  }

  try {
    const client = new ApiGatewayManagementApiClient({
      endpoint: WEBSOCKET_API_ENDPOINT,
    })

    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(update)),
      })
    )
  } catch (error) {
    console.error('Failed to send progress update:', error)
    // Don't throw - continue with import even if progress updates fail
  }
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Extract connectionId for WebSocket progress updates (if WebSocket request)
  const connectionId = event.requestContext.connectionId

  try {
    // Extract user ID from authorizer context (WebSocket Lambda Authorizer)
    // For HTTP API: event.requestContext.authorizer?.jwt?.claims?.sub
    // For WebSocket API: event.requestContext.authorizer?.sub
    const userId = (event.requestContext.authorizer?.sub ||
                    event.requestContext.authorizer?.jwt?.claims?.sub) as string

    if (!userId) {
      await sendProgress(connectionId, {
        stage: 'error',
        message: 'Unauthorized'
      })
      return unauthorizedResponse()
    }

    // Parse request body
    const body: ImportRequest = JSON.parse(event.body || '{}')
    if (!body.s3Bucket || !body.s3Key) {
      await sendProgress(connectionId, {
        stage: 'error',
        message: 'Missing required fields: s3Bucket and s3Key'
      })
      return badRequestResponse(
        's3Bucket and s3Key are required',
        'MISSING_FIELDS'
      )
    }

    // Download file from S3 to /tmp
    await sendProgress(connectionId, {
      stage: 'downloading',
      message: 'Downloading Anki deck from S3...'
    })
    const filePath = `/tmp/${path.basename(body.s3Key)}`
    await downloadFromS3(body.s3Bucket, body.s3Key, filePath)

    // Validate file size
    const stats = await fs.stat(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      await cleanup(filePath)
      return badRequestResponse(
        `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        'FILE_TOO_LARGE'
      )
    }

    // Validate ZIP magic bytes
    const buffer = await fs.readFile(filePath)
    if (!buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      await cleanup(filePath)
      return badRequestResponse(
        'File is not a valid ZIP archive',
        'INVALID_FORMAT'
      )
    }

    // Extract and parse .apkg file
    await sendProgress(connectionId, {
      stage: 'parsing',
      message: 'Parsing Anki package...'
    })
    const extractDir = `/tmp/${Date.now()}`
    await fs.mkdir(extractDir, { recursive: true })

    const zip = await JSZip.loadAsync(buffer)

    // Check uncompressed size
    let totalSize = 0
    zip.forEach((relativePath, file) => {
      if (!file.dir) {
        totalSize += file._data.uncompressedSize || 0
      }
    })

    if (totalSize > MAX_UNCOMPRESSED_SIZE) {
      await cleanup(filePath, extractDir)
      return badRequestResponse(
        `Maximum uncompressed size is ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB`,
        'UNCOMPRESSED_TOO_LARGE'
      )
    }

    // Find collection database file in ZIP
    const collectionFile = zip.file('collection.anki21') ||
                           zip.file('collection.anki2') ||
                           zip.file('collection.anki21b')

    if (!collectionFile) {
      await cleanup(filePath)
      return badRequestResponse(
        'No collection database found in .apkg file',
        'INVALID_ANKI_DECK'
      )
    }

    // Extract collection database
    const collectionBuffer = await collectionFile.async('uint8array')

    // Parse Anki collection
    const collection = await readAnkiCollection(collectionBuffer)

    // Get collection name (use provided name or filename without extension)
    const collectionName = body.collectionName ||
                          path.basename(body.s3Key, '.apkg').replace(/[^a-zA-Z0-9\s-]/g, '')

    // Get all decks and extract cards with category information
    const decks = collection.getDecks() as Record<string, AnkiDeck>
    const allCards: { card: AnkiCard; deckName: string }[] = []

    for (const [deckId, deck] of Object.entries(decks)) {
      const deckCards = deck.getCards()
      // Extract deck name from deckJson metadata (contains actual Anki deck name)
      const deckName = deck.deckJson?.name || `Deck ${deckId}`

      Object.values(deckCards).forEach((card) => {
        allCards.push({ card, deckName })
      })
    }

    await sendProgress(connectionId, {
      stage: 'found',
      message: `Found ${allCards.length} cards in deck`,
      count: allCards.length
    })

    // Map Anki cards to Taaltuig cards with categories
    const cards = allCards.map(({ card, deckName }) => ({
      ...mapAnkiCardToCard(userId, card),
      category: `${collectionName}/${deckName}`
    }))

    // Bulk create cards and review items in DynamoDB
    let createdCount = 0
    let skippedCount = 0

    for (let i = 0; i < cards.length; i++) {
      const cardData = cards[i]
      try {
        // Create card (automatically creates forward + reverse review items)
        await dbClient.createCard(
          userId,
          cardData.front,
          cardData.back,
          cardData.explanation,
          cardData.tags,
          'anki',
          cardData.category
        )

        createdCount++

        // Send progress update every 50 cards
        if ((i + 1) % 50 === 0 || i === cards.length - 1) {
          await sendProgress(connectionId, {
            stage: 'importing',
            message: `Importing cards... ${i + 1}/${cards.length}`,
            current: i + 1,
            total: cards.length
          })
        }
      } catch (error) {
        console.error('Error creating card:', error)
        skippedCount++
      }
    }

    // Cleanup temp files
    await cleanup(filePath, extractDir)

    // Send final progress update
    await sendProgress(connectionId, {
      stage: 'complete',
      message: `Import complete! Imported ${createdCount} cards, skipped ${skippedCount}`,
      imported: createdCount,
      skipped: skippedCount,
      total: allCards.length
    })

    return jsonResponse({
      success: true,
      imported: createdCount,
      skipped: skippedCount,
      total: allCards.length
    })
  } catch (error) {
    console.error('Import error:', error)

    // Send error progress update
    await sendProgress(connectionId, {
      stage: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })

    return serverErrorResponse(error, true)
  }
}

async function downloadFromS3(
  bucket: string,
  key: string,
  filePath: string
): Promise<void> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await s3Client.send(command)

  if (!response.Body) {
    throw new Error('S3 object has no body')
  }

  const stream = response.Body as Readable
  const writeStream = fsSync.createWriteStream(filePath)

  return new Promise((resolve, reject) => {
    stream.pipe(writeStream)
    stream.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('finish', resolve)
  })
}

interface CardData {
  front: string
  back: string
  explanation: string
  tags: string[]
}

function mapAnkiCardToCard(_userId: string, card: AnkiCard): CardData {
  // anki-reader v0.3.0: getFields() returns object like { Front: '...', Back: '...' }
  const fields = card.getFields ? card.getFields() : {}

  // Get front and back, strip HTML tags and [sound:...] references
  const front = stripHTML(card.getFront ? card.getFront() : fields.Front || '')
  const back = stripHTML(card.getBack ? card.getBack() : fields.Back || '')

  // Collect any additional fields for explanation (beyond Front/Back)
  const fieldKeys = Object.keys(fields)
  const extraFields = fieldKeys
    .filter((key) => key !== 'Front' && key !== 'Back')
    .map((key) => stripHTML(fields[key] || ''))
    .filter(Boolean)

  const explanation = extraFields.length > 0 ? extraFields.join(' • ') : ''

  return {
    front: front || '(empty)',
    back: back || '(empty)',
    explanation,
    tags: []
  }
}

function stripHTML(html: string): string {
  if (!html) return ''

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '')

  // Remove [sound:...] references
  text = text.replace(/\[sound:[^\]]+\]/g, '')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Trim whitespace
  return text.trim()
}

async function cleanup(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      const stats = await fs.stat(p)
      if (stats.isDirectory()) {
        await fs.rm(p, { recursive: true, force: true })
      } else {
        await fs.unlink(p)
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to cleanup ${p}:`, error)
    }
  }
}
