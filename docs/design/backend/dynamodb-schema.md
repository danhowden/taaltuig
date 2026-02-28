# DynamoDB Schema Design

## Overview
Single-table design for Taaltuig SRS system optimized for cost and performance.

**Cost Estimate:** ~$1-3/month on-demand pricing for MVP traffic

---

## Table Structure

**Table Name:** `taaltuig-main`

**Primary Key:**
- `PK` (Partition Key) - String
- `SK` (Sort Key) - String

**Global Secondary Indexes:**

**GSI1** - For querying review items by state and due date
- `GSI1PK` (Partition Key) - String
- `GSI1SK` (Sort Key) - String

**GSI2** - For counting new cards by date
- `GSI2PK` (Partition Key) - String
- `GSI2SK` (Sort Key) - String

---

## Entity Patterns

### 1. User
Stores Google OAuth authenticated users.

```
PK: USER#<google_sub>
SK: PROFILE
google_sub: <google_sub>
email: <email>
name: <name>
picture_url: <url>
created_at: <timestamp>
last_login: <timestamp>
```

**Access Patterns:**
- Get user by google_sub: `Query(PK=USER#<google_sub>, SK=PROFILE)`
- Query by user_id (internal): Use `user_id` which equals google_sub

---

### 2. User Settings
SRS configuration per user.

```
PK: USER#<user_id>
SK: SETTINGS
user_id: <user_id>
new_cards_per_day: 20
max_reviews_per_day: null
learning_steps: [1, 10]
relearning_steps: [10]
graduating_interval: 1
easy_interval: 4
starting_ease: 2.5
easy_bonus: 1.3
interval_modifier: 1.0
updated_at: <timestamp>
```

**Access Patterns:**
- Get settings: `GetItem(PK=USER#<user_id>, SK=SETTINGS)`
- Update settings: `UpdateItem(PK=USER#<user_id>, SK=SETTINGS)`

---

### 3. Card
User-created flashcard content.

```
PK: USER#<user_id>
SK: CARD#<card_id>
card_id: <uuid>
user_id: <user_id>
front: "de kat"
back: "the cat"
explanation: "de = common gender article"
source: "manual"
tags: ["animals", "nouns"]
deck_id: null
created_at: <timestamp>
updated_at: <timestamp>
```

**Access Patterns:**
- Get card by ID: `GetItem(PK=USER#<user_id>, SK=CARD#<card_id>)`
- List all cards for user: `Query(PK=USER#<user_id>, SK begins_with CARD#)`

---

### 4. Review Item
Scheduling state per review direction (2 per card).

```
PK: USER#<user_id>
SK: REVIEWITEM#<review_item_id>
GSI1PK: USER#<user_id>#<state>
GSI1SK: <due_date_iso>

review_item_id: <uuid>
card_id: <card_id>
user_id: <user_id>
direction: "forward"
state: "REVIEW"
interval: 7.0
ease_factor: 2.5
repetitions: 3
step_index: 0
due_date: <timestamp>
last_reviewed: <timestamp>
created_at: <timestamp>
updated_at: <timestamp>

# Denormalized card data for queue queries
front: "de kat"
back: "the cat"
explanation: "de = common gender article"
```

**Access Patterns:**
- Get review item by ID: `GetItem(PK=USER#<user_id>, SK=REVIEWITEM#<id>)`
- Get due items: `Query(GSI1, GSI1PK=USER#<user_id>#REVIEW, GSI1SK <= now)`
- Get NEW items: `Query(GSI1, GSI1PK=USER#<user_id>#NEW)`
- Get LEARNING items: `Query(GSI1, GSI1PK=USER#<user_id>#LEARNING, GSI1SK <= now)`
- Get RELEARNING items: `Query(GSI1, GSI1PK=USER#<user_id>#RELEARNING, GSI1SK <= now)`

---

### 5. Review History
Audit log of all reviews.

```
PK: USER#<user_id>
SK: HISTORY#<timestamp>#<review_item_id>
GSI2PK: USER#<user_id>#HISTORY#<date_YYYY-MM-DD>
GSI2SK: <timestamp>

review_item_id: <review_item_id>
user_id: <user_id>
grade: 3
duration_ms: 4500
state_before: "REVIEW"
state_after: "REVIEW"
interval_before: 7.0
interval_after: 14.5
ease_factor_before: 2.5
ease_factor_after: 2.5
reviewed_at: <timestamp>
```

**Access Patterns:**
- Insert history: `PutItem`
- Get history for user: `Query(PK=USER#<user_id>, SK begins_with HISTORY#)`
- Count new cards today: `Query(GSI2, GSI2PK=USER#<user_id>#HISTORY#2026-01-20, filter state_before=NEW)`

---

## Key Access Patterns Implementation

### Get Daily Review Queue

```typescript
async function getReviewQueue(userId: string): Promise<QueueItem[]> {
  const now = new Date().toISOString()
  const settings = await getSettings(userId)

  // 1. Get due REVIEW items
  const reviewItems = await dynamodb.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#REVIEW`,
      ':now': now
    }
  })

  // 2. Get due LEARNING items
  const learningItems = await dynamodb.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#LEARNING`,
      ':now': now
    }
  })

  // 3. Get due RELEARNING items
  const relearningItems = await dynamodb.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#RELEARNING`,
      ':now': now
    }
  })

  // 4. Count new cards reviewed today
  const today = new Date().toISOString().split('T')[0]
  const historyToday = await dynamodb.query({
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    FilterExpression: 'state_before = :state',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#HISTORY#${today}`,
      ':state': 'NEW'
    }
  })
  const newCardsToday = historyToday.Items.length

  // 5. Get NEW items up to limit
  const remainingNew = Math.max(0, settings.new_cards_per_day - newCardsToday)
  const newItems = await dynamodb.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#NEW`
    },
    Limit: remainingNew
  })

  // Combine all items
  return [...reviewItems.Items, ...learningItems.Items, ...relearningItems.Items, ...newItems.Items]
}
```

### Submit Review

```typescript
async function submitReview(userId: string, reviewItemId: string, grade: number, durationMs: number) {
  // 1. Get review item
  const item = await dynamodb.getItem({
    Key: {
      PK: `USER#${userId}`,
      SK: `REVIEWITEM#${reviewItemId}`
    }
  })

  // 2. Run SM-2 algorithm
  const settings = await getSettings(userId)
  const scheduler = new SM2Scheduler()
  const result = scheduler.schedule(item, grade, settings, new Date())

  // 3. Update item with new state
  await dynamodb.updateItem({
    Key: {
      PK: `USER#${userId}`,
      SK: `REVIEWITEM#${reviewItemId}`
    },
    UpdateExpression: 'SET #state = :state, interval = :interval, ease_factor = :ease, ...',
    ExpressionAttributeNames: {
      '#state': 'state',
      'GSI1PK': `USER#${userId}#${result.state}`,
      'GSI1SK': result.due_date
    },
    ExpressionAttributeValues: {
      ':state': result.state,
      ':interval': result.interval,
      ':ease': result.ease_factor,
      // ... other values
    }
  })

  // 4. Insert history record
  const timestamp = new Date().toISOString()
  const date = timestamp.split('T')[0]
  await dynamodb.putItem({
    Item: {
      PK: `USER#${userId}`,
      SK: `HISTORY#${timestamp}#${reviewItemId}`,
      GSI2PK: `USER#${userId}#HISTORY#${date}`,
      GSI2SK: timestamp,
      // ... all history fields
    }
  })

  return result
}
```

---

## Table Configuration

```typescript
const table = new dynamodb.Table(this, 'TaaltuigMainTable', {
  tableName: 'taaltuig-main',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
  removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete data on stack deletion
  pointInTimeRecovery: true, // Enable backups
})

// GSI1 - Review items by state and due date
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
})

// GSI2 - Review history by date
table.addGlobalSecondaryIndex({
  indexName: 'GSI2',
  partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
})
```

---

## Cost Analysis

### On-Demand Pricing (US East 1)
- **Write Request**: $1.25 per million
- **Read Request**: $0.25 per million
- **Storage**: $0.25 per GB-month

### Estimated Monthly Cost (1 user, 50 reviews/day)
- Reviews: 50/day × 30 = 1,500/month
- Reads: 1,500 queue fetches + 1,500 item lookups = 3,000 reads → **$0.00075**
- Writes: 1,500 updates + 1,500 history inserts = 3,000 writes → **$0.00375**
- Storage: ~0.01 GB → **$0.0025**
- **Total: ~$0.01/month per active user**

### At Scale (100 users, 50 reviews/day each)
- Total reviews: 150,000/month
- Reads: ~300,000 → **$0.075**
- Writes: ~300,000 → **$0.375**
- Storage: ~1 GB → **$0.25**
- **Total: ~$0.70/month**

**Free Tier:** 25 GB storage, 2.5M read/write units per month

---

## Data Migration Notes

### From PostgreSQL to DynamoDB

**Mapping:**
- `users.google_sub` → PK key component
- Foreign keys → Embedded in PK/SK patterns
- JOINs → Denormalized data (store card front/back in review_items)
- Indexes → GSI1, GSI2

**Trade-offs:**
- ✅ 10x cheaper
- ✅ Auto-scaling
- ✅ No cold starts
- ⚠️ More complex queries
- ⚠️ Data denormalization needed

---

## Next Steps

1. ✅ Design DynamoDB schema (this doc)
2. ⏳ Implement DynamoDB table in CDK
3. ⏳ Create helper functions for access patterns
4. ⏳ Update Lambda functions to use DynamoDB
5. ⏳ Test with real data
