import { describe, it, expect } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import JSZip from 'jszip'
import { readAnkiCollection } from 'anki-reader'

// Types for anki-reader library (which doesn't export types)
interface AnkiCard {
  getFields?: () => Record<string, string>
  getFront?: () => string
  getBack?: () => string
  getTags?: () => string[]
}

interface AnkiDeck {
  getCards: () => Record<string, AnkiCard>
  name?: string
}

describe('Anki deck structure inspection', () => {
  it('should inspect Dutch deck for categories, tags, and deck structure', async () => {
    const deckPath = path.join(__dirname, '../../../../docs/anki-examples/dutch-large.apkg')
    const buffer = await fs.readFile(deckPath)

    const zip = await JSZip.loadAsync(buffer)

    // Find collection database
    const collectionFile = zip.file('collection.anki21') ||
                          zip.file('collection.anki2') ||
                          zip.file('collection.anki21b')

    expect(collectionFile).toBeTruthy()

    const collectionBuffer = await collectionFile!.async('uint8array')
    const collection = await readAnkiCollection(collectionBuffer)

    // Get all decks
    const decks = collection.getDecks() as Record<string, AnkiDeck>

    console.log('\n🗂️  DECK STRUCTURE:')
    console.log(`   Total decks: ${Object.keys(decks).length}`)

    Object.entries(decks).forEach(([deckId, deck]) => {
      const deckName = deck.name || 'Unnamed'
      const cards = deck.getCards()
      const cardCount = Object.keys(cards).length

      console.log(`\n   📁 Deck: "${deckName}"`)
      console.log(`      - Deck ID: ${deckId}`)
      console.log(`      - Cards: ${cardCount}`)
    })

    // Analyze tags across all cards
    const allTags = new Set<string>()
    const cardsWithTags: { front: string; tags: string[] }[] = []

    Object.values(decks).forEach((deck) => {
      const cards = deck.getCards()
      Object.values(cards).forEach((card: AnkiCard) => {
        const tags = card.getTags ? card.getTags() : []
        if (tags && tags.length > 0) {
          tags.forEach((tag: string) => allTags.add(tag))
          cardsWithTags.push({
            front: card.getFront ? card.getFront() : '',
            tags: tags
          })
        }
      })
    })

    console.log(`\n🏷️  TAGS:`)
    console.log(`   Unique tags: ${allTags.size}`)
    if (allTags.size > 0) {
      console.log(`   Tags found:`, Array.from(allTags))
      console.log(`\n   Sample cards with tags:`)
      cardsWithTags.slice(0, 5).forEach((card, i) => {
        console.log(`      ${i+1}. "${card.front}" - Tags: ${JSON.stringify(card.tags)}`)
      })
    } else {
      console.log(`   ❌ No tags found in this deck`)
    }

    // Check for categories in card fields
    console.log(`\n📊 CARD FIELDS ANALYSIS:`)
    const firstDeck = Object.values(decks)[0]
    const firstCards = Object.values(firstDeck.getCards()).slice(0, 3)

    firstCards.forEach((card: AnkiCard, i) => {
      const fields = card.getFields ? card.getFields() : {}
      console.log(`\n   Card ${i+1} fields:`)
      Object.entries(fields).forEach(([fieldName, value]) => {
        console.log(`      - ${fieldName}: "${value}"`)
      })
    })

    // Summary
    console.log(`\n📋 SUMMARY:`)
    console.log(`   - The deck ${allTags.size > 0 ? 'HAS' : 'DOES NOT HAVE'} tags`)
    console.log(`   - The deck ${Object.keys(decks).length > 1 ? 'HAS' : 'DOES NOT HAVE'} multiple sub-decks`)
    console.log(`   - Categories would need to be added via UX or inferred from content`)
  }, 30000)

  it('should inspect Spanish deck structure', async () => {
    const deckPath = path.join(__dirname, '../../../../docs/anki-examples/spanish-small.apkg')
    const buffer = await fs.readFile(deckPath)

    const zip = await JSZip.loadAsync(buffer)
    const collectionFile = zip.file('collection.anki21') ||
                          zip.file('collection.anki2') ||
                          zip.file('collection.anki21b')

    const collectionBuffer = await collectionFile!.async('uint8array')
    const collection = await readAnkiCollection(collectionBuffer)

    const decks = collection.getDecks() as Record<string, AnkiDeck>

    console.log('\n🗂️  SPANISH DECK STRUCTURE:')
    Object.entries(decks).forEach(([_deckId, deck]) => {
      const deckName = deck.name || 'Unnamed'
      const cards = deck.getCards()
      console.log(`   Deck: "${deckName}" (${Object.keys(cards).length} cards)`)
    })
  }, 30000)
})
