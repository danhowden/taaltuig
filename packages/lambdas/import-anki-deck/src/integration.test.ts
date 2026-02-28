import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock AWS SDK and DynamoDB client
const mockS3Send = vi.fn()
const mockWebSocketSend = vi.fn()
const mockCreateCard = vi.fn()

vi.mock('@aws-sdk/client-s3', async () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockS3Send,
    })),
    GetObjectCommand: vi.fn(),
  }
})

vi.mock('@aws-sdk/client-apigatewaymanagementapi', async () => {
  return {
    ApiGatewayManagementApiClient: vi.fn().mockImplementation(() => ({
      send: mockWebSocketSend,
    })),
    PostToConnectionCommand: vi.fn().mockImplementation((input) => ({ input })),
  }
})

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      createCard: mockCreateCard,
    })),
  }
})

const { handler } = await import('./index')

describe('import-anki-deck integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.WEBSOCKET_API_ENDPOINT = 'https://test-ws-api.execute-api.us-east-1.amazonaws.com/prod'
    mockWebSocketSend.mockResolvedValue({})
    mockCreateCard.mockResolvedValue({})
  })

  const createMockEvent = (
    body: unknown,
    userId = 'test-user'
  ): APIGatewayProxyEventV2 => ({
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: userId },
        },
      },
    } as APIGatewayProxyEventV2['requestContext'],
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2)

  it('should successfully import real Dutch Anki deck and verify structure', async () => {
    // Read the actual Dutch Anki deck file
    const deckPath = path.join(__dirname, '../../../../docs/anki-examples/dutch-large.apkg')
    const deckBuffer = await fs.readFile(deckPath)

    // Create a Readable stream from the buffer for S3 mock
    const { Readable } = await import('stream')
    const mockStream = new Readable()
    mockStream.push(deckBuffer)
    mockStream.push(null)

    mockS3Send.mockResolvedValue({ Body: mockStream })

    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/dutch-large.apkg',
    })

    const result = await handler(event)

    // Verify successful import
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)
    expect(body.imported).toBeGreaterThan(0)
    expect(body.total).toBeGreaterThan(0)

    console.log(`\n✅ Successfully imported ${body.imported} cards from Dutch deck`)
    console.log(`   Total notes: ${body.total}`)
    console.log(`   Skipped: ${body.skipped}`)

    // Verify cards were created
    expect(mockCreateCard).toHaveBeenCalled()
    const callCount = mockCreateCard.mock.calls.length
    expect(callCount).toBe(body.imported)

    // Analyze the imported cards
    const cards = mockCreateCard.mock.calls.map(call => ({
      userId: call[0],
      front: call[1],
      back: call[2],
      explanation: call[3],
      tags: call[4],
      source: call[5],
      category: call[6],
    }))

    console.log(`\n📊 Card Analysis:`)
    console.log(`   First card front: "${cards[0].front}"`)
    console.log(`   First card back: "${cards[0].back}"`)
    console.log(`   First card explanation: "${cards[0].explanation || '(none)'}"`)
    console.log(`   First card tags: ${JSON.stringify(cards[0].tags)}`)
    console.log(`   Source: ${cards[0].source}`)
    console.log(`   Category: ${cards[0].category}`)

    // Check for cards with explanations (extra fields)
    const cardsWithExplanations = cards.filter(c => c.explanation && c.explanation.trim() !== '')
    console.log(`\n   Cards with explanations: ${cardsWithExplanations.length}`)

    if (cardsWithExplanations.length > 0) {
      console.log(`   Example explanation: "${cardsWithExplanations[0].explanation}"`)
    }

    // Verify all cards have userId and source
    cards.forEach(card => {
      expect(card.userId).toBe('test-user')
      expect(card.source).toBe('anki')
    })

    // Check for common Dutch words to verify content
    const dutchWords = ['de', 'het', 'een', 'is', 'zijn', 'hebben', 'maar', 'of', 'en']
    const hasDutchContent = cards.some(card =>
      dutchWords.some(word =>
        card.front.toLowerCase().includes(word) ||
        card.back.toLowerCase().includes(word)
      )
    )
    expect(hasDutchContent).toBe(true)
    console.log(`   ✅ Verified Dutch language content`)
  }, 30000) // 30 second timeout for file I/O

  it('should successfully import Spanish deck for comparison', async () => {
    const deckPath = path.join(__dirname, '../../../../docs/anki-examples/spanish-small.apkg')
    const deckBuffer = await fs.readFile(deckPath)

    const { Readable } = await import('stream')
    const mockStream = new Readable()
    mockStream.push(deckBuffer)
    mockStream.push(null)

    mockS3Send.mockResolvedValue({ Body: mockStream })

    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/spanish-small.apkg',
    })

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)

    console.log(`\n✅ Successfully imported ${body.imported} cards from Spanish deck`)
    console.log(`   Total notes: ${body.total}`)

    // Verify Spanish content
    const cards = mockCreateCard.mock.calls.map(call => ({
      front: call[1],
      back: call[2],
    }))

    const spanishWords = ['el', 'la', 'un', 'una', 'es', 'son', 'pero', 'y', 'o']
    const hasSpanishContent = cards.some(card =>
      spanishWords.some(word =>
        card.front.toLowerCase().includes(word) ||
        card.back.toLowerCase().includes(word)
      )
    )
    expect(hasSpanishContent).toBe(true)
    console.log(`   ✅ Verified Spanish language content`)
  }, 30000)

  it('should analyze Dutch deck structure and identify categories/patterns', async () => {
    const deckPath = path.join(__dirname, '../../../../docs/anki-examples/dutch-large.apkg')
    const deckBuffer = await fs.readFile(deckPath)

    const { Readable } = await import('stream')
    const mockStream = new Readable()
    mockStream.push(deckBuffer)
    mockStream.push(null)

    mockS3Send.mockResolvedValue({ Body: mockStream })

    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/dutch-large.apkg',
    })

    const result = await handler(event)
    expect(result.statusCode).toBe(200)

    // Analyze card structure
    const cards = mockCreateCard.mock.calls.map(call => ({
      front: call[1],
      back: call[2],
      explanation: call[3],
      tags: call[4],
      category: call[6],
    }))

    console.log(`\n🔍 Dutch Deck Analysis:`)
    console.log(`   Total cards: ${cards.length}`)

    // Count unique categories
    const uniqueCategories = new Set(cards.map(c => c.category))
    console.log(`   Unique categories: ${uniqueCategories.size}`)
    console.log(`   Sample categories:`)
    Array.from(uniqueCategories).slice(0, 5).forEach(cat => {
      const count = cards.filter(c => c.category === cat).length
      console.log(`      - "${cat}": ${count} cards`)
    })

    // Check for categories by analyzing front/back patterns
    const categories = {
      verbs: cards.filter(c =>
        c.back.toLowerCase().includes('to ') ||
        c.front.match(/\ben\b/)
      ).length,
      adjectives: cards.filter(c =>
        ['big', 'small', 'good', 'bad', 'new', 'old'].some(adj =>
          c.back.toLowerCase().includes(adj)
        )
      ).length,
      nouns: cards.filter(c =>
        c.front.toLowerCase().startsWith('de ') ||
        c.front.toLowerCase().startsWith('het ')
      ).length,
    }

    console.log(`\n   📚 Detected Patterns:`)
    console.log(`      - Potential verbs: ${categories.verbs}`)
    console.log(`      - Potential adjectives: ${categories.adjectives}`)
    console.log(`      - Nouns with articles (de/het): ${categories.nouns}`)

    // Sample cards from each category
    const sampleVerb = cards.find(c => c.back.toLowerCase().includes('to '))
    const sampleAdjective = cards.find(c => ['groot', 'klein', 'goed'].includes(c.front.toLowerCase()))
    const sampleNoun = cards.find(c => c.front.toLowerCase().startsWith('de ') || c.front.toLowerCase().startsWith('het '))

    if (sampleVerb) {
      console.log(`\n   📝 Sample Verb:`)
      console.log(`      ${sampleVerb.front} → ${sampleVerb.back}`)
    }

    if (sampleAdjective) {
      console.log(`\n   📝 Sample Adjective:`)
      console.log(`      ${sampleAdjective.front} → ${sampleAdjective.back}`)
    }

    if (sampleNoun) {
      console.log(`\n   📝 Sample Noun with Article:`)
      console.log(`      ${sampleNoun.front} → ${sampleNoun.back}`)
    }

    // Check for common Dutch frequency words
    const commonDutchWords = {
      'de': cards.filter(c => c.front.includes('de')).length,
      'het': cards.filter(c => c.front.includes('het')).length,
      'een': cards.filter(c => c.front.includes('een')).length,
      'zijn': cards.filter(c => c.front.includes('zijn')).length,
      'hebben': cards.filter(c => c.front.includes('hebben')).length,
    }

    console.log(`\n   🔤 Common Word Occurrences:`)
    Object.entries(commonDutchWords).forEach(([word, count]) => {
      console.log(`      "${word}": ${count} cards`)
    })

    // Verify deck quality
    expect(cards.length).toBeGreaterThan(1000)
    expect(cards.every(c => c.front && c.back)).toBe(true)
    console.log(`\n   ✅ All cards have both front and back content`)
  }, 30000)
})
