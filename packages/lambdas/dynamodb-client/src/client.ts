import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import type {
  User,
  UserSettings,
  Card,
  ReviewItem,
  ReviewHistory,
  WritingAttempt,
  WritingExercise,
  CardExerciseLink,
  ExerciseType,
  State,
  Grade,
  CardInsight,
  InsightStatus,
} from './types'
import { DEFAULT_SETTINGS } from './types'
import { TranslationAssessor } from './assessor'

export class TaaltuigDynamoDBClient {
  private client: DynamoDBDocumentClient
  private tableName: string

  constructor(tableName: string) {
    const ddbClient = new DynamoDBClient({})
    this.client = DynamoDBDocumentClient.from(ddbClient)
    this.tableName = tableName
  }

  // ============================================================================
  // USER OPERATIONS
  // ============================================================================

  async getUser(googleSub: string): Promise<User | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${googleSub}`,
          SK: 'PROFILE',
        },
      })
    )

    return (response.Item as User) || null
  }

  async createUser(
    googleSub: string,
    email: string,
    name: string,
    pictureUrl?: string
  ): Promise<User> {
    const now = new Date().toISOString()
    const user: User = {
      PK: `USER#${googleSub}`,
      SK: 'PROFILE',
      google_sub: googleSub,
      email,
      name,
      picture_url: pictureUrl,
      created_at: now,
      last_login: now,
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
      })
    )

    return user
  }

  async updateLastLogin(googleSub: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${googleSub}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET last_login = :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
      })
    )
  }

  async getOrCreateUser(
    googleSub: string,
    email: string,
    name: string,
    pictureUrl?: string
  ): Promise<User> {
    let user = await this.getUser(googleSub)

    if (!user) {
      user = await this.createUser(googleSub, email, name, pictureUrl)
      // Also create default settings
      await this.createDefaultSettings(googleSub)
    } else {
      await this.updateLastLogin(googleSub)
    }

    return user
  }

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  async getSettings(userId: string): Promise<UserSettings | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'SETTINGS',
        },
      })
    )

    return (response.Item as UserSettings) || null
  }

  async createDefaultSettings(userId: string): Promise<UserSettings> {
    const settings: UserSettings = {
      PK: `USER#${userId}`,
      SK: 'SETTINGS',
      user_id: userId,
      ...DEFAULT_SETTINGS,
      updated_at: new Date().toISOString(),
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: settings,
      })
    )

    return settings
  }

  async updateSettings(
    userId: string,
    updates: Partial<
      Omit<UserSettings, 'PK' | 'SK' | 'user_id' | 'updated_at'>
    >
  ): Promise<UserSettings> {
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, unknown> = {}

    // Build update expression dynamically
    Object.entries(updates).forEach(([key, value]) => {
      updateExpressions.push(`#${key} = :${key}`)
      expressionAttributeNames[`#${key}`] = key
      expressionAttributeValues[`:${key}`] = value
    })

    // Always update the updated_at timestamp
    updateExpressions.push('#updated_at = :updated_at')
    expressionAttributeNames['#updated_at'] = 'updated_at'
    expressionAttributeValues[':updated_at'] = new Date().toISOString()

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'SETTINGS',
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    // Fetch and return updated settings
    const settings = await this.getSettings(userId)
    if (!settings) {
      throw new Error('Failed to fetch updated settings')
    }

    return settings
  }

  // ============================================================================
  // REVIEW QUEUE OPERATIONS
  // ============================================================================

  async getReviewQueue(userId: string, options?: { extraNew?: number }): Promise<{
    queue: ReviewItem[]
    stats: {
      due_count: number
      new_count: number
      learning_count: number
      total_count: number
      new_remaining_today: number
    }
  }> {
    const now = new Date().toISOString()
    const extraNew = options?.extraNew || 0

    // Run all independent queries in parallel
    const [settings, reviewItems, learningItems, relearningItems, newCardsToday] =
      await Promise.all([
        this.getSettings(userId),
        this.queryReviewItemsByState(userId, 'REVIEW', now),
        this.queryReviewItemsByState(userId, 'LEARNING', now),
        this.queryReviewItemsByState(userId, 'RELEARNING', now),
        this.countNewCardsToday(userId),
      ])

    if (!settings) {
      throw new Error('User settings not found')
    }

    // 5. Get ALL NEW items, shuffle, then take up to daily limit (+ any extra requested)
    // This ensures forward/reverse pairs don't always appear together
    const remainingNew = Math.max(
      0,
      settings.new_cards_per_day - newCardsToday
    )

    // Add extra cards if requested (for "continue session" feature)
    const totalNewToFetch = remainingNew + extraNew

    if (totalNewToFetch === 0) {
      // No new cards available today
      const queue = [...reviewItems, ...learningItems, ...relearningItems]
      return {
        queue,
        stats: {
          due_count: reviewItems.length,
          new_count: 0,
          learning_count: learningItems.length + relearningItems.length,
          total_count: queue.length,
          new_remaining_today: 0,
        },
      }
    }

    // Fetch ALL NEW items
    const allNewItems = await this.queryNewReviewItems(userId)

    // Filter out disabled categories if set
    const filteredNewItems = settings.disabled_categories && settings.disabled_categories.length > 0
      ? allNewItems.filter(item =>
          !item.category || !settings.disabled_categories!.includes(item.category)
        )
      : allNewItems

    // Shuffle the entire pool, then take what's needed
    const shuffledNewItems = this.shuffleArray(filteredNewItems).slice(0, totalNewToFetch)

    // Combine all items
    const queue = [
      ...reviewItems,
      ...learningItems,
      ...relearningItems,
      ...shuffledNewItems,
    ]

    return {
      queue,
      stats: {
        due_count: reviewItems.length,
        new_count: shuffledNewItems.length,
        learning_count: learningItems.length + relearningItems.length,
        total_count: queue.length,
        new_remaining_today: Math.max(0, remainingNew - shuffledNewItems.length),
      },
    }
  }

  private async queryReviewItemsByState(
    userId: string,
    state: State,
    dueBeforeOrAt?: string
  ): Promise<ReviewItem[]> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#${state}`,
      },
    }

    // Add due date filter if provided
    if (dueBeforeOrAt && params.ExpressionAttributeValues) {
      params.KeyConditionExpression += ' AND GSI1SK <= :due'
      params.ExpressionAttributeValues[':due'] = dueBeforeOrAt
    }

    const response = await this.client.send(new QueryCommand(params))
    return (response.Items as ReviewItem[]) || []
  }

  private async queryNewReviewItems(userId: string): Promise<ReviewItem[]> {
    // Fetch ALL NEW items (with pagination) so we can randomly select from the entire pool
    // This prevents forward/reverse pairs from always appearing together
    let allItems: ReviewItem[] = []
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined

    do {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}#NEW`,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      allItems = allItems.concat((response.Items as ReviewItem[]) || [])
      lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastEvaluatedKey)

    return allItems
  }

  private async countNewCardsToday(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]

    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        FilterExpression: 'state_before = :state',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#HISTORY#${today}`,
          ':state': 'NEW',
        },
      })
    )

    return response.Items?.length || 0
  }

  // ============================================================================
  // CARD OPERATIONS
  // ============================================================================

  async createCard(
    userId: string,
    front: string,
    back: string,
    explanation?: string,
    tags?: string[],
    source: string = 'manual',
    category?: string
  ): Promise<{ card: Card; reviewItems: ReviewItem[] }> {
    const cardId = this.generateUUID()
    const now = new Date().toISOString()

    const card = {
      PK: `USER#${userId}`,
      SK: `CARD#${cardId}`,
      card_id: cardId,
      user_id: userId,
      front,
      back,
      explanation,
      source,
      category,
      tags: tags || [],
      created_at: now,
      updated_at: now,
    }

    // Create the card
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: card,
      })
    )

    // Create two review items (forward and reverse)
    const settings = await this.getSettings(userId)
    if (!settings) {
      throw new Error('User settings not found')
    }

    const forwardReviewItem = await this.createReviewItem(
      userId,
      cardId,
      'forward',
      front,
      back,
      explanation,
      category,
      settings.starting_ease
    )

    const reverseReviewItem = await this.createReviewItem(
      userId,
      cardId,
      'reverse',
      back,
      front,
      explanation,
      category,
      settings.starting_ease
    )

    return {
      card,
      reviewItems: [forwardReviewItem, reverseReviewItem],
    }
  }

  private async createReviewItem(
    userId: string,
    cardId: string,
    direction: 'forward' | 'reverse',
    front: string,
    back: string,
    explanation: string | undefined,
    category: string | undefined,
    startingEase: number
  ): Promise<ReviewItem> {
    const reviewItemId = this.generateUUID()
    const now = new Date().toISOString()

    const reviewItem: ReviewItem = {
      PK: `USER#${userId}`,
      SK: `REVIEWITEM#${reviewItemId}`,
      GSI1PK: `USER#${userId}#NEW`,
      GSI1SK: now,
      review_item_id: reviewItemId,
      card_id: cardId,
      user_id: userId,
      direction,
      state: 'NEW',
      interval: 0,
      ease_factor: startingEase,
      repetitions: 0,
      step_index: 0,
      due_date: now,
      created_at: now,
      updated_at: now,
      // Denormalized card data
      front,
      back,
      explanation,
      category,
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: reviewItem,
      })
    )

    return reviewItem
  }

  async listCards(userId: string): Promise<Card[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'CARD#',
        },
      })
    )

    return (response.Items as Card[]) || []
  }

  /**
   * List cards with server-side pagination and filtering
   * Queries cards in batches, applies filters in-memory, accumulates until limit
   */
  async listCardsPaginated(
    userId: string,
    options: {
      limit: number
      cursor?: string
      category?: string
      insightStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'any'
      search?: string
    }
  ): Promise<{ cards: Card[]; cursor: string | null; hasMore: boolean }> {
    const { limit, cursor, category, insightStatus, search } = options
    const batchSize = 200 // DynamoDB batch size to stay under 1MB limit
    const searchLower = search?.toLowerCase()

    // Decode cursor (LastEvaluatedKey from DynamoDB)
    let lastEvaluatedKey: Record<string, unknown> | undefined
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
      } catch {
        // Invalid cursor, start from beginning
        lastEvaluatedKey = undefined
      }
    }

    const matchedCards: Card[] = []
    let hasMoreInDb = true
    let finalLastKey: Record<string, unknown> | undefined
    let brokeEarly = false

    // Keep fetching until we have enough cards or exhausted the database
    while (matchedCards.length < limit && hasMoreInDb) {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'CARD#',
          },
          Limit: batchSize,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      const cards = (response.Items as Card[]) || []
      brokeEarly = false

      // Apply filters in-memory
      for (const card of cards) {
        if (matchedCards.length >= limit) {
          // We have enough, but there's more in this batch
          // Store where we left off (use this card's key as exclusive start for next page)
          finalLastKey = { PK: card.PK, SK: card.SK }
          brokeEarly = true
          break
        }

        // Category filter
        if (category && card.category !== category) {
          continue
        }

        // Insight status filter
        if (insightStatus) {
          const hasInsights = card.insights && card.insights.length > 0

          if (insightStatus === 'none') {
            if (hasInsights) continue
          } else if (insightStatus === 'any') {
            if (!hasInsights) continue
          } else {
            // pending, approved, rejected
            if (!hasInsights) continue
            const hasMatchingStatus = card.insights!.some(
              (insight) => insight.status === insightStatus
            )
            if (!hasMatchingStatus) continue
          }
        }

        // Search filter (case-insensitive search in front, back, explanation)
        if (searchLower) {
          const frontMatch = card.front?.toLowerCase().includes(searchLower)
          const backMatch = card.back?.toLowerCase().includes(searchLower)
          const explanationMatch = card.explanation?.toLowerCase().includes(searchLower)
          if (!frontMatch && !backMatch && !explanationMatch) {
            continue
          }
        }

        matchedCards.push(card)
      }

      // Update cursor for next iteration (only if we didn't break early)
      if (!brokeEarly) {
        if (response.LastEvaluatedKey) {
          lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown>
          finalLastKey = lastEvaluatedKey
        } else {
          hasMoreInDb = false
          finalLastKey = undefined
        }
      }
    }

    // Determine if there are more results
    const hasMore = brokeEarly || hasMoreInDb

    // Encode cursor for next page
    let nextCursor: string | null = null
    if (hasMore && finalLastKey) {
      nextCursor = Buffer.from(JSON.stringify(finalLastKey)).toString('base64')
    }

    return {
      cards: matchedCards.slice(0, limit),
      cursor: nextCursor,
      hasMore,
    }
  }

  async getCard(userId: string, cardId: string): Promise<Card | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
      })
    )

    return (response.Item as Card) || null
  }

  async updateCard(
    userId: string,
    cardId: string,
    updates: {
      front?: string
      back?: string
      explanation?: string
      tags?: string[]
    }
  ): Promise<Card> {
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, unknown> = {}

    // Build update expression dynamically
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`)
        expressionAttributeNames[`#${key}`] = key
        expressionAttributeValues[`:${key}`] = value
      }
    })

    // Always update the updated_at timestamp
    updateExpressions.push('#updated_at = :updated_at')
    expressionAttributeNames['#updated_at'] = 'updated_at'
    expressionAttributeValues[':updated_at'] = new Date().toISOString()

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    // If front/back/explanation changed, update denormalized data in review items
    if (updates.front || updates.back || updates.explanation) {
      await this.updateReviewItemsAfterCardUpdate(userId, cardId, updates)
    }

    // Fetch and return updated card
    const card = await this.getCard(userId, cardId)
    if (!card) {
      throw new Error('Card not found after update')
    }
    return card
  }

  private async updateReviewItemsAfterCardUpdate(
    userId: string,
    cardId: string,
    updates: {
      front?: string
      back?: string
      explanation?: string
    }
  ): Promise<void> {
    // Query all review items for this card
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'card_id = :cardId',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REVIEWITEM#',
          ':cardId': cardId,
        },
      })
    )

    const reviewItems = response.Items || []

    // Update each review item
    for (const item of reviewItems) {
      const updateExpressions: string[] = []
      const expressionAttributeNames: Record<string, string> = {}
      const expressionAttributeValues: Record<string, unknown> = {}

      // For forward direction: front stays front, back stays back
      // For reverse direction: front is back, back is front
      const isForward = item.direction === 'forward'

      if (updates.front) {
        const fieldToUpdate = isForward ? 'front' : 'back'
        updateExpressions.push(`#${fieldToUpdate} = :${fieldToUpdate}`)
        expressionAttributeNames[`#${fieldToUpdate}`] = fieldToUpdate
        expressionAttributeValues[`:${fieldToUpdate}`] = updates.front
      }

      if (updates.back) {
        const fieldToUpdate = isForward ? 'back' : 'front'
        updateExpressions.push(`#${fieldToUpdate} = :${fieldToUpdate}`)
        expressionAttributeNames[`#${fieldToUpdate}`] = fieldToUpdate
        expressionAttributeValues[`:${fieldToUpdate}`] = updates.back
      }

      if (updates.explanation !== undefined) {
        updateExpressions.push('#explanation = :explanation')
        expressionAttributeNames['#explanation'] = 'explanation'
        expressionAttributeValues[':explanation'] = updates.explanation
      }

      if (updateExpressions.length > 0) {
        updateExpressions.push('#updated_at = :updated_at')
        expressionAttributeNames['#updated_at'] = 'updated_at'
        expressionAttributeValues[':updated_at'] = new Date().toISOString()

        await this.client.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )
      }
    }
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    // First, delete all review items for this card
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'card_id = :cardId',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REVIEWITEM#',
          ':cardId': cardId,
        },
      })
    )

    const reviewItems = response.Items || []

    // Delete each review item
    for (const item of reviewItems) {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        })
      )
    }

    // Delete the card
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
      })
    )
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Fisher-Yates shuffle to randomize array order
   * Used to prevent forward/reverse card pairs from appearing consecutively
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // ============================================================================
  // REVIEW SUBMISSION OPERATIONS
  // ============================================================================

  async getReviewItem(
    userId: string,
    reviewItemId: string
  ): Promise<ReviewItem | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `REVIEWITEM#${reviewItemId}`,
        },
      })
    )

    return (response.Item as ReviewItem) || null
  }

  async updateReviewItem(
    userId: string,
    reviewItemId: string,
    updates: {
      state: State
      interval: number
      ease_factor: number
      repetitions: number
      step_index: number
      due_date: string
      last_reviewed: string
    }
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `REVIEWITEM#${reviewItemId}`,
        },
        UpdateExpression: `SET
          #state = :state,
          GSI1PK = :gsi1pk,
          GSI1SK = :gsi1sk,
          #interval = :interval,
          ease_factor = :ease_factor,
          repetitions = :repetitions,
          step_index = :step_index,
          due_date = :due_date,
          last_reviewed = :last_reviewed,
          updated_at = :updated_at`,
        ExpressionAttributeNames: {
          '#state': 'state',
          '#interval': 'interval',
        },
        ExpressionAttributeValues: {
          ':state': updates.state,
          ':gsi1pk': `USER#${userId}#${updates.state}`,
          ':gsi1sk': updates.due_date,
          ':interval': updates.interval,
          ':ease_factor': updates.ease_factor,
          ':repetitions': updates.repetitions,
          ':step_index': updates.step_index,
          ':due_date': updates.due_date,
          ':last_reviewed': updates.last_reviewed,
          ':updated_at': new Date().toISOString(),
        },
      })
    )
  }

  async createReviewHistory(
    userId: string,
    reviewItemId: string,
    grade: Grade,
    durationMs: number,
    stateBefore: State,
    stateAfter: State,
    intervalBefore: number,
    intervalAfter: number,
    easeFactorBefore: number,
    easeFactorAfter: number
  ): Promise<void> {
    const timestamp = new Date().toISOString()
    const date = timestamp.split('T')[0]

    const history: ReviewHistory = {
      PK: `USER#${userId}`,
      SK: `HISTORY#${timestamp}#${reviewItemId}`,
      GSI2PK: `USER#${userId}#HISTORY#${date}`,
      GSI2SK: timestamp,
      review_item_id: reviewItemId,
      user_id: userId,
      grade,
      duration_ms: durationMs,
      state_before: stateBefore,
      state_after: stateAfter,
      interval_before: intervalBefore,
      interval_after: intervalAfter,
      ease_factor_before: easeFactorBefore,
      ease_factor_after: easeFactorAfter,
      reviewed_at: timestamp,
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: history,
      })
    )
  }

  /**
   * Reset daily reviews - deletes all review history for today
   * and resets ReviewItems back to NEW state
   * Useful for testing purposes
   */
  async resetDailyReviews(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Query today's history using GSI2
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#HISTORY#${today}`,
        },
      })
    )

    const historyItems = response.Items || []
    const reviewItemIds = new Set<string>()

    // Collect unique review_item_ids from history
    for (const item of historyItems) {
      reviewItemIds.add(item.review_item_id)
    }

    // Get user settings for starting ease
    const settings = await this.getSettings(userId)
    if (!settings) {
      throw new Error('User settings not found')
    }

    // Reset each ReviewItem back to NEW state
    for (const reviewItemId of reviewItemIds) {
      const reviewItem = await this.getReviewItem(userId, reviewItemId)
      if (reviewItem) {
        await this.client.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: {
              PK: `USER#${userId}`,
              SK: `REVIEWITEM#${reviewItemId}`,
            },
            UpdateExpression:
              'SET #state = :state, #gsi1pk = :gsi1pk, #gsi1sk = :gsi1sk, #interval = :interval, #ease_factor = :ease_factor, #repetitions = :repetitions, #step_index = :step_index, #due_date = :due_date, #updated_at = :updated_at REMOVE last_reviewed',
            ExpressionAttributeNames: {
              '#state': 'state',
              '#gsi1pk': 'GSI1PK',
              '#gsi1sk': 'GSI1SK',
              '#interval': 'interval',
              '#ease_factor': 'ease_factor',
              '#repetitions': 'repetitions',
              '#step_index': 'step_index',
              '#due_date': 'due_date',
              '#updated_at': 'updated_at',
            },
            ExpressionAttributeValues: {
              ':state': 'NEW',
              ':gsi1pk': `USER#${userId}#NEW`,
              ':gsi1sk': now,
              ':interval': 0,
              ':ease_factor': settings.starting_ease,
              ':repetitions': 0,
              ':step_index': 0,
              ':due_date': now,
              ':updated_at': now,
            },
          })
        )
      }
    }

    // Delete all history items for today
    for (const item of historyItems) {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        })
      )
    }

    return historyItems.length
  }

  // ============================================================================
  // CATEGORY OPERATIONS
  // ============================================================================

  async renameCategory(
    userId: string,
    oldCategory: string,
    newCategory: string
  ): Promise<{
    cardsUpdated: number
    reviewItemsUpdated: number
    settingsUpdated: boolean
  }> {
    let cardsUpdated = 0
    let reviewItemsUpdated = 0
    let settingsUpdated = false

    // 1. Update all cards with the old category
    const cards = await this.listCards(userId)
    const cardsToUpdate = cards.filter((card) => card.category === oldCategory)

    for (const card of cardsToUpdate) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `CARD#${card.card_id}`,
          },
          UpdateExpression: 'SET category = :newCategory, updated_at = :now',
          ExpressionAttributeValues: {
            ':newCategory': newCategory,
            ':now': new Date().toISOString(),
          },
        })
      )
      cardsUpdated++
    }

    // 2. Update all review items with the old category (denormalized data)
    const reviewItems = await this.listAllReviewItems(userId)
    const reviewItemsToUpdate = reviewItems.filter(
      (item) => item.category === oldCategory
    )

    for (const item of reviewItemsToUpdate) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
          UpdateExpression: 'SET category = :newCategory, updated_at = :now',
          ExpressionAttributeValues: {
            ':newCategory': newCategory,
            ':now': new Date().toISOString(),
          },
        })
      )
      reviewItemsUpdated++
    }

    // 3. Update user settings if disabled_categories contains the old category
    const settings = await this.getSettings(userId)
    if (settings?.disabled_categories) {
      const index = settings.disabled_categories.indexOf(oldCategory)
      if (index !== -1) {
        const updatedCategories = [...settings.disabled_categories]
        updatedCategories[index] = newCategory

        await this.updateSettings(userId, {
          disabled_categories: updatedCategories,
        })
        settingsUpdated = true
      }
    }

    return {
      cardsUpdated,
      reviewItemsUpdated,
      settingsUpdated,
    }
  }

  async listAllReviewItems(userId: string): Promise<ReviewItem[]> {
    const allItems: ReviewItem[] = []
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined

    do {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'REVIEWITEM#',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      allItems.push(...((response.Items as ReviewItem[]) || []))
      lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastEvaluatedKey)

    return allItems
  }

  // ============================================================================
  // INSIGHT OPERATIONS
  // ============================================================================

  /**
   * Update insights on a card (called after AI generation)
   */
  async updateCardInsights(
    userId: string,
    cardId: string,
    insights: CardInsight[]
  ): Promise<Card> {
    const now = new Date().toISOString()

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression:
          'SET insights = :insights, insights_generated_at = :generated_at, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':insights': insights,
          ':generated_at': now,
          ':updated_at': now,
        },
      })
    )

    const card = await this.getCard(userId, cardId)
    if (!card) {
      throw new Error('Card not found after update')
    }
    return card
  }

  /**
   * Get cards by their IDs (for batch operations)
   */
  async getCardsByIds(userId: string, cardIds: string[]): Promise<Card[]> {
    const cards: Card[] = []

    for (const cardId of cardIds) {
      const card = await this.getCard(userId, cardId)
      if (card) {
        cards.push(card)
      }
    }

    return cards
  }

  /**
   * Get cards with insights that need review (pending or AI-approved)
   */
  async getCardsWithInsightsForReview(
    userId: string,
    statusFilter?: InsightStatus | 'ai_approved' | 'all'
  ): Promise<Card[]> {
    const allCards = await this.listCards(userId)

    return allCards.filter((card) => {
      if (!card.insights || card.insights.length === 0) {
        return false
      }

      if (statusFilter === 'all') {
        return true
      }

      if (statusFilter === 'ai_approved') {
        // Cards with at least one AI-approved insight (not yet human reviewed)
        return card.insights.some(
          (insight) =>
            insight.status === 'approved' && insight.reviewed_by === 'ai'
        )
      }

      if (statusFilter === 'pending') {
        // Cards with at least one pending insight
        return card.insights.some((insight) => insight.status === 'pending')
      }

      // Default: cards with any non-human-reviewed insights
      return card.insights.some(
        (insight) =>
          insight.status === 'pending' ||
          (insight.status === 'approved' && insight.reviewed_by === 'ai')
      )
    })
  }

  /**
   * Update a single insight's status (for human review)
   */
  async updateInsightStatus(
    userId: string,
    cardId: string,
    insightIndex: number,
    update: {
      status: InsightStatus
      reviewed_by: 'ai' | 'human'
      content?: string
      rejection_reason?: string
    }
  ): Promise<Card> {
    const card = await this.getCard(userId, cardId)
    if (!card) {
      throw new Error('Card not found')
    }

    if (!card.insights || insightIndex >= card.insights.length) {
      throw new Error('Insight not found')
    }

    const now = new Date().toISOString()
    const insights = [...card.insights]
    insights[insightIndex] = {
      ...insights[insightIndex],
      status: update.status,
      reviewed_by: update.reviewed_by,
      reviewed_at: now,
      ...(update.content && { content: update.content }),
      ...(update.rejection_reason && {
        rejection_reason: update.rejection_reason,
      }),
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression: 'SET insights = :insights, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':insights': insights,
          ':updated_at': now,
        },
      })
    )

    // If approved, sync to review items
    if (update.status === 'approved') {
      await this.syncInsightsToReviewItems(userId, cardId, insights)
    }

    const updatedCard = await this.getCard(userId, cardId)
    if (!updatedCard) {
      throw new Error('Card not found after update')
    }
    return updatedCard
  }

  /**
   * Delete an insight from a card (used when rejecting)
   */
  async deleteInsight(
    userId: string,
    cardId: string,
    insightIndex: number
  ): Promise<Card> {
    const card = await this.getCard(userId, cardId)
    if (!card) {
      throw new Error('Card not found')
    }

    if (!card.insights || insightIndex >= card.insights.length) {
      throw new Error('Insight not found')
    }

    const now = new Date().toISOString()
    const insights = card.insights.filter((_, i) => i !== insightIndex)

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression: 'SET insights = :insights, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':insights': insights,
          ':updated_at': now,
        },
      })
    )

    // Sync to review items (with remaining insights)
    await this.syncInsightsToReviewItems(userId, cardId, insights)

    const updatedCard = await this.getCard(userId, cardId)
    if (!updatedCard) {
      throw new Error('Card not found after update')
    }
    return updatedCard
  }

  /**
   * Bulk update insights status (for AI validation)
   */
  async bulkUpdateInsightsStatus(
    userId: string,
    cardId: string,
    insightUpdates: Array<{
      index: number
      status: InsightStatus
      rejection_reason?: string
    }>
  ): Promise<Card> {
    const card = await this.getCard(userId, cardId)
    if (!card) {
      throw new Error('Card not found')
    }

    if (!card.insights) {
      throw new Error('Card has no insights')
    }

    const now = new Date().toISOString()
    const insights = [...card.insights]

    for (const update of insightUpdates) {
      if (update.index < insights.length) {
        insights[update.index] = {
          ...insights[update.index],
          status: update.status,
          reviewed_by: 'ai',
          reviewed_at: now,
          ...(update.rejection_reason && {
            rejection_reason: update.rejection_reason,
          }),
        }
      }
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression: 'SET insights = :insights, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':insights': insights,
          ':updated_at': now,
        },
      })
    )

    // Sync approved insights to review items
    const approvedInsights = insights.filter((i) => i.status === 'approved')
    if (approvedInsights.length > 0) {
      await this.syncInsightsToReviewItems(userId, cardId, insights)
    }

    const updatedCard = await this.getCard(userId, cardId)
    if (!updatedCard) {
      throw new Error('Card not found after update')
    }
    return updatedCard
  }

  /**
   * Sync approved insights to review items (denormalization)
   */
  private async syncInsightsToReviewItems(
    userId: string,
    cardId: string,
    insights: CardInsight[]
  ): Promise<void> {
    // Only copy approved insights to review items
    const approvedInsights = insights.filter((i) => i.status === 'approved')

    // Query all review items for this card
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'card_id = :cardId',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REVIEWITEM#',
          ':cardId': cardId,
        },
      })
    )

    const reviewItems = response.Items || []
    const now = new Date().toISOString()

    // Update each review item with approved insights
    for (const item of reviewItems) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
          UpdateExpression:
            'SET insights = :insights, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':insights': approvedInsights.length > 0 ? approvedInsights : null,
            ':updated_at': now,
          },
        })
      )
    }
  }

  /**
   * Get review items for a specific card
   */
  async getReviewItemsByCardId(
    userId: string,
    cardId: string
  ): Promise<ReviewItem[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'card_id = :cardId',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REVIEWITEM#',
          ':cardId': cardId,
        },
      })
    )

    return (response.Items as ReviewItem[]) || []
  }

  /**
   * Clear all insights from cards and review items (debug/testing)
   */
  async clearAllInsights(
    userId: string
  ): Promise<{ clearedCards: number; clearedReviewItems: number }> {
    const now = new Date().toISOString()
    let clearedCards = 0
    let clearedReviewItems = 0

    // Get all cards with insights
    const cardsResponse = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'attribute_exists(insights)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'CARD#',
        },
      })
    )

    // Clear insights from cards
    for (const card of cardsResponse.Items || []) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: card.PK, SK: card.SK },
          UpdateExpression:
            'REMOVE insights, insights_generated_at SET updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':updated_at': now,
          },
        })
      )
      clearedCards++
    }

    // Get all review items with insights
    const reviewItemsResponse = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'attribute_exists(insights)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REVIEWITEM#',
        },
      })
    )

    // Clear insights from review items
    for (const item of reviewItemsResponse.Items || []) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: item.PK, SK: item.SK },
          UpdateExpression: 'REMOVE insights SET updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':updated_at': now,
          },
        })
      )
      clearedReviewItems++
    }

    return { clearedCards, clearedReviewItems }
  }

  // ============================================================================
  // WRITING EXERCISE OPERATIONS
  // ============================================================================

  /**
   * Store a writing attempt and return the assessment result.
   */
  async createWritingAttempt(
    userId: string,
    exerciseId: string,
    exerciseType: ExerciseType,
    userAnswer: string,
    referenceAnswer: string,
    alternatives: string[],
    durationMs: number
  ): Promise<WritingAttempt> {
    const assessor = new TranslationAssessor()
    const assessment = assessor.assess(userAnswer, referenceAnswer, alternatives)

    const timestamp = new Date().toISOString()
    const date = timestamp.split('T')[0]

    const attempt: WritingAttempt = {
      PK: `USER#${userId}`,
      SK: `ATTEMPT#${timestamp}#${exerciseId}`,
      GSI2PK: `USER#${userId}#WRITING#${date}`,
      GSI2SK: timestamp,
      user_id: userId,
      exercise_id: exerciseId,
      exercise_type: exerciseType,
      user_answer: userAnswer,
      score: assessment.grade,
      feedback: assessment.feedback,
      match_type: assessment.match_type,
      confidence: 1.0, // deterministic
      assessment_mode_used: 'deterministic',
      duration_ms: durationMs,
      flagged: false,
      created_at: timestamp,
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: attempt,
      })
    )

    return attempt
  }

  /**
   * Count writing attempts completed today for daily limit enforcement.
   */
  async countWritingAttemptsToday(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]

    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING#${today}`,
        },
        Select: 'COUNT',
      })
    )

    return response.Count || 0
  }

  // ============================================================================
  // STORED EXERCISE OPERATIONS
  // ============================================================================

  /**
   * Store a batch of AI-generated exercises and their card-exercise links.
   * DynamoDB BatchWrite supports max 25 items per request.
   */
  async storeExercises(userId: string, exercises: WritingExercise[]): Promise<void> {
    // Build all items: exercises + card-exercise links
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = []

    for (const exercise of exercises) {
      allItems.push(exercise)

      // Create a card-exercise link for each target vocabulary card
      for (const cardId of exercise.target_vocabulary) {
        const link: CardExerciseLink = {
          PK: `USER#${userId}`,
          SK: `CARD_EXERCISE#${cardId}#${exercise.exercise_id}`,
          exercise_id: exercise.exercise_id,
          exercise_type: exercise.type,
          exercise_status: exercise.status,
          prompt: exercise.prompt,
          generated_at: exercise.generated_at,
        }
        allItems.push(link)
      }
    }

    // BatchWrite in chunks of 25
    for (let i = 0; i < allItems.length; i += 25) {
      const chunk = allItems.slice(i, i + 25)
      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((item: Record<string, unknown>) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      )
    }
  }

  /**
   * Get pending/validated exercises from the user's exercise pool.
   * Returns exercises ordered by status (pending first), then generated_at.
   * High-priority (user-requested) exercises are shuffled into the first 3 positions.
   */
  async getExercisePool(userId: string, limit: number): Promise<WritingExercise[]> {
    // Query pending exercises
    const pendingResponse = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :status)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
          ':status': 'pending#',
        },
        Limit: limit,
      })
    )

    // Also query validated exercises
    const validatedResponse = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :status)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
          ':status': 'validated#',
        },
        Limit: limit,
      })
    )

    const allExercises = [
      ...((pendingResponse.Items as WritingExercise[]) || []),
      ...((validatedResponse.Items as WritingExercise[]) || []),
    ].slice(0, limit)

    // Shuffle high-priority exercises into first 3 positions
    const highPriority = allExercises.filter((e) => e.priority === 'high')
    const normal = allExercises.filter((e) => e.priority !== 'high')

    if (highPriority.length === 0) {
      return allExercises
    }

    const result = [...normal]
    for (const hp of highPriority) {
      const pos = Math.floor(Math.random() * Math.min(3, result.length + 1))
      result.splice(pos, 0, hp)
    }

    return result.slice(0, limit)
  }

  /**
   * Get a single exercise by ID.
   */
  async getExercise(userId: string, exerciseId: string): Promise<WritingExercise | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `EXERCISE#${exerciseId}`,
        },
      })
    )

    return (response.Item as WritingExercise) || null
  }

  /**
   * Get exercises linked to a specific card.
   */
  async getExercisesForCard(userId: string, cardId: string): Promise<CardExerciseLink[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `CARD_EXERCISE#${cardId}#`,
        },
      })
    )

    return (response.Items as CardExerciseLink[]) || []
  }

  /**
   * Mark exercises as served (batch update).
   */
  async markExercisesServed(userId: string, exerciseIds: string[]): Promise<void> {
    const timestamp = new Date().toISOString()

    for (const exerciseId of exerciseIds) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `EXERCISE#${exerciseId}`,
          },
          UpdateExpression: 'SET #status = :status, served_at = :served_at, GSI2SK = :gsi2sk',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'served',
            ':served_at': timestamp,
            ':gsi2sk': `served#${timestamp}`,
          },
        })
      )
    }
  }

  /**
   * Mark an exercise as completed and update its card-exercise link.
   */
  async markExerciseCompleted(userId: string, exerciseId: string): Promise<void> {
    const timestamp = new Date().toISOString()

    // Update the exercise status
    const exercise = await this.getExercise(userId, exerciseId)
    if (!exercise) return

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `EXERCISE#${exerciseId}`,
        },
        UpdateExpression: 'SET #status = :status, completed_at = :completed_at, GSI2SK = :gsi2sk',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':completed_at': timestamp,
          ':gsi2sk': `completed#${timestamp}`,
        },
      })
    )

    // Update card-exercise links
    for (const cardId of exercise.target_vocabulary) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `CARD_EXERCISE#${cardId}#${exerciseId}`,
          },
          UpdateExpression: 'SET exercise_status = :status',
          ExpressionAttributeValues: {
            ':status': 'completed',
          },
        })
      )
    }
  }

  /**
   * Count pending exercises in the pool.
   */
  async getExercisePoolCount(userId: string): Promise<number> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :status)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
          ':status': 'pending#',
        },
        Select: 'COUNT',
      })
    )

    return response.Count || 0
  }

  /**
   * Get all exercises across all statuses (for admin view).
   */
  async getAllExercises(userId: string, limit: number = 200): Promise<WritingExercise[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
        },
        Limit: limit,
        ScanIndexForward: false, // newest first
      })
    )

    return (response.Items as WritingExercise[]) || []
  }

  /**
   * Delete all incomplete (non-completed) exercises and their card-exercise links.
   * Returns count of deleted items.
   */
  async clearIncompleteExercises(userId: string): Promise<{ deleted: number }> {
    // Get all exercises from the pool (all statuses)
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
        },
      })
    )

    const exercises = (response.Items as WritingExercise[]) || []
    const toDelete = exercises.filter((e) => e.status !== 'completed')

    if (toDelete.length === 0) {
      return { deleted: 0 }
    }

    // Collect all items to delete: exercises + their card-exercise links
    const deleteKeys: { PK: string; SK: string }[] = []

    for (const exercise of toDelete) {
      deleteKeys.push({ PK: exercise.PK, SK: exercise.SK })

      for (const cardId of exercise.target_vocabulary) {
        deleteKeys.push({
          PK: `USER#${userId}`,
          SK: `CARD_EXERCISE#${cardId}#${exercise.exercise_id}`,
        })
      }
    }

    // Batch delete in chunks of 25
    for (let i = 0; i < deleteKeys.length; i += 25) {
      const chunk = deleteKeys.slice(i, i + 25)
      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
        })
      )
    }

    return { deleted: toDelete.length }
  }

  /**
   * Get vocabulary cards suitable for exercise generation.
   * Queries ReviewItems across all states, weighted by recency and difficulty.
   * Returns deduplicated cards with their review metadata.
   */
  async getVocabularyForGeneration(userId: string): Promise<
    { card_id: string; front: string; back: string; state: State; ease_factor: number; last_reviewed?: string; due_date: string }[]
  > {
    // Query review items across all states
    const states: State[] = ['REVIEW', 'LEARNING', 'RELEARNING', 'NEW']
    const allItems: ReviewItem[] = []

    for (const state of states) {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}#${state}`,
          },
        })
      )
      allItems.push(...((response.Items as ReviewItem[]) || []))
    }

    // Deduplicate by card_id (forward and reverse review items point to same card)
    const seenCardIds = new Set<string>()
    const results: { card_id: string; front: string; back: string; state: State; ease_factor: number; last_reviewed?: string; due_date: string }[] = []

    for (const item of allItems) {
      if (seenCardIds.has(item.card_id)) continue
      seenCardIds.add(item.card_id)

      results.push({
        card_id: item.card_id,
        front: item.front,
        back: item.back,
        state: item.state,
        ease_factor: item.ease_factor,
        last_reviewed: item.last_reviewed,
        due_date: item.due_date,
      })
    }

    return results
  }

  /**
   * Get card IDs already used in recent pending exercises (to avoid repetition).
   */
  async getRecentExerciseCardIds(userId: string): Promise<Set<string>> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :status)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#WRITING_POOL`,
          ':status': 'pending#',
        },
        ProjectionExpression: 'target_vocabulary',
      })
    )

    const cardIds = new Set<string>()
    for (const item of (response.Items || [])) {
      const exercise = item as WritingExercise
      for (const cardId of exercise.target_vocabulary) {
        cardIds.add(cardId)
      }
    }

    return cardIds
  }
}
