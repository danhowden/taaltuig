# System Architecture

## Overview
Taaltuig is a serverless web application built on AWS infrastructure, using a React SPA frontend and Lambda-based backend services. The architecture uses DynamoDB for storage, HTTP API Gateway for REST endpoints, WebSocket API for real-time updates, and S3 for file uploads. Costs are ~$1-3/month for typical usage.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   React SPA (Vite)                                     │  │
│  │   - Review interface                                   │  │
│  │   - Card management + Anki import                      │  │
│  │   - Auth flows                                         │  │
│  │   - WebSocket for real-time progress                   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────┬────────────────────────────────────────────────┘
              │ HTTPS / WSS
              ▼
┌──────────────────────────────────────────────────────────────┐
│                      CDN / Hosting                            │
│  CloudFront + S3 (static assets)                             │
└─────────────┬────────────────────────────────────────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌─────────────┐  ┌──────────────┐
│ HTTP API    │  │ WebSocket API│
│ (v2)        │  │              │
│ JWT Auth    │  │ Lambda Auth  │
└──────┬──────┘  └──────┬───────┘
       │                │
       │  ┌─────────────┘
       │  │    ┌────────────────┐
       │  │    │  S3 Bucket     │
       │  │    │  (Anki uploads)│
       │  │    └────────┬───────┘
       ▼  ▼             ▼
  ┌────────────────────────────┐
  │   19 Lambda Functions      │
  │  - Auth, Reviews, Cards    │
  │  - Import, Debug, Settings │
  └──────────┬─────────────────┘
             ▼
    ┌──────────────────┐
    │   DynamoDB       │
    │  Single Table    │
    │  (taaltuig-main) │
    └──────────────────┘
```

---

## Core Components

### 1. Frontend (React SPA)
**Technology**: React 18 + TypeScript + Vite

**Responsibilities**:
- Render review interface (flashcards)
- Handle user interactions (grading, navigation)
- Manage local state (current queue, session)
- Communicate with backend API
- Auth token management

**Key Pages/Routes**:
- `/` - Landing/home
- `/login` - Authentication
- `/review` - Daily review session
- `/cards` - Card management (Phase 3)
- `/stats` - Progress tracking (Phase 5)

**Hosting**:
- S3 bucket (static files)
- CloudFront distribution (CDN, HTTPS)

---

### 2. API Layer (AWS API Gateway v2 HTTP API)
**Type**: HTTP API (lower cost and latency than REST API)

**HTTP Endpoints** (17+):
```
# Auth
GET    /api/auth/me                      # Get/create user profile

# Reviews
GET    /api/reviews/queue                # Fetch daily review queue
POST   /api/reviews/submit               # Submit review grade

# Settings
GET    /api/settings                     # Get user SRS settings
PUT    /api/settings                     # Update user SRS settings

# Cards
POST   /api/cards                        # Create new card
GET    /api/cards                        # List all cards
PUT    /api/cards/{card_id}              # Update card
DELETE /api/cards/{card_id}              # Delete card

# Categories
PUT    /api/categories/rename            # Rename category across all cards

# Import
POST   /api/import/upload-url            # Get presigned S3 URL
POST   /api/import/anki                  # Trigger Anki import

# Debug
POST   /api/debug/reset-daily-reviews    # Reset review history
POST   /api/debug/clear-database         # Clear all user data
```

**WebSocket API**:
```
wss://{api-id}.execute-api.{region}.amazonaws.com/prod
- $connect    # Connection with JWT validation
- $disconnect # Cleanup
- importAnki  # Real-time progress updates
```

**Authentication**:
- HTTP API: JWT Authorizer (validates Google OAuth2 tokens)
- WebSocket: Lambda Authorizer (validates JWT from query param)
- Bearer token in `Authorization` header for HTTP
- Token in `?token=` query param for WebSocket

**CORS**: Enabled for all origins (tighten in production)

---

### 3. Lambda Functions (19 total)

#### Shared Package: `@taaltuig/dynamodb-client`
**Purpose**: DynamoDB access patterns and SM-2 scheduling logic

**Exports**:
```typescript
// DynamoDB operations
class DynamoDBClient {
  getUser(googleSub: string): Promise<User>
  createUser(data: CreateUserInput): Promise<User>
  getSettings(userId: string): Promise<UserSettings>
  updateSettings(userId: string, settings: Partial<UserSettings>): Promise<void>
  getReviewQueue(userId: string): Promise<QueueItem[]>
  submitReview(userId: string, itemId: string, grade: number): Promise<void>
  // ... card operations, import operations, etc.
}

// SM-2 Scheduler
class SM2Scheduler {
  schedule(item: ReviewItem, grade: Grade, settings: UserSettings): ScheduleResult
  initializeReviewItem(cardId: string, direction: Direction): ReviewItem
}
```

**Why shared library?**
- Centralizes all DynamoDB access patterns
- Includes SM-2 algorithm implementation
- Reusable across all 19 Lambda functions
- Easy to unit test independently
- Single source of truth for data model

---

#### Lambda: `GetReviewQueue`
**Trigger**: `GET /api/reviews/queue`

**Flow**:
```typescript
import { DynamoDBClient } from '@taaltuig/dynamodb-client'

async function handler(event: APIGatewayProxyEventV2) {
  const db = new DynamoDBClient()

  // 1. Extract user_id from JWT (validated by API Gateway)
  const userId = event.requestContext.authorizer.jwt.claims.sub

  // 2. Get review queue (uses GSI1 for due items, GSI2 for counting)
  const queue = await db.getReviewQueue(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(queue)
  }
}
```

**DynamoDB Operations**:
```typescript
// In @taaltuig/dynamodb-client
async getReviewQueue(userId: string) {
  // Query GSI1 for due REVIEW items
  const reviewItems = await this.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#REVIEW`,
      ':now': new Date().toISOString()
    }
  })

  // Query GSI1 for due LEARNING items
  const learningItems = await this.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#LEARNING`,
      ':now': new Date().toISOString()
    }
  })

  // Query GSI2 to count new cards today
  const today = new Date().toISOString().split('T')[0]
  const historyToday = await this.query({
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    FilterExpression: 'state_before = :state',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}#HISTORY#${today}`,
      ':state': 'NEW'
    }
  })

  // Get NEW items up to daily limit
  const settings = await this.getSettings(userId)
  const newCardsToday = historyToday.Items.length
  const remainingNew = Math.max(0, settings.new_cards_per_day - newCardsToday)

  const newItems = await this.query({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}#NEW` },
    Limit: remainingNew
  })

  return {
    queue: [...reviewItems.Items, ...learningItems.Items, ...newItems.Items],
    stats: {
      due_count: reviewItems.Items.length + learningItems.Items.length,
      new_count: newItems.Items.length,
      new_remaining_today: remainingNew
    }
  }
}
```

**Performance**: GSI1/GSI2 indexes enable sub-10ms queries

---

#### Lambda: `SubmitReview`
**Trigger**: `POST /api/reviews/submit`

**Request Body**:
```json
{
  "review_item_id": "uuid",
  "grade": 3,
  "duration_ms": 4500
}
```

**Flow**:
```typescript
import { DynamoDBClient, SM2Scheduler } from '@taaltuig/dynamodb-client'

async function handler(event: APIGatewayProxyEventV2) {
  const db = new DynamoDBClient()
  const userId = event.requestContext.authorizer.jwt.claims.sub
  const { review_item_id, grade, duration_ms } = JSON.parse(event.body)

  // 1. Load current state
  const reviewItem = await db.getReviewItem(userId, review_item_id)
  const settings = await db.getSettings(userId)

  // 2. Calculate new state using SM-2 scheduler
  const scheduler = new SM2Scheduler()
  const result = scheduler.schedule(reviewItem, grade, settings, new Date())

  // 3. Update review item with new scheduling state
  await db.updateReviewItem(userId, review_item_id, {
    state: result.state,
    interval: result.interval,
    ease_factor: result.ease_factor,
    repetitions: result.repetitions,
    step_index: result.step_index,
    due_date: result.due_date,
    last_reviewed: new Date(),
    // Update GSI1 keys for new state
    GSI1PK: `USER#${userId}#${result.state}`,
    GSI1SK: result.due_date.toISOString()
  })

  // 4. Insert history record
  const timestamp = new Date().toISOString()
  const date = timestamp.split('T')[0]
  await db.putItem({
    PK: `USER#${userId}`,
    SK: `HISTORY#${timestamp}#${review_item_id}`,
    GSI2PK: `USER#${userId}#HISTORY#${date}`,
    GSI2SK: timestamp,
    review_item_id,
    grade,
    duration_ms,
    state_before: reviewItem.state,
    state_after: result.state,
    interval_before: reviewItem.interval,
    interval_after: result.interval,
    ease_factor_before: reviewItem.ease_factor,
    ease_factor_after: result.ease_factor,
    reviewed_at: timestamp
  })

  return {
    statusCode: 200,
    body: JSON.stringify({
      next_review: result.due_date,
      interval_days: result.interval,
      state: result.state
    })
  }
}
```

**DynamoDB Operations**:
- 1 GetItem (review item)
- 1 GetItem (settings)
- 1 UpdateItem (review item with conditional expression)
- 1 PutItem (history record)

**Concurrency**: DynamoDB handles concurrent updates; conditional expressions prevent conflicts

---

#### Lambda: `ImportAnkiDeck`
**Trigger**: `POST /api/import/anki` or WebSocket `importAnki` route

**Flow**:
```typescript
import { DynamoDBClient, SM2Scheduler } from '@taaltuig/dynamodb-client'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import { parseAnkiDeck } from 'anki-reader'

async function handler(event: APIGatewayProxyEventV2) {
  const db = new DynamoDBClient()
  const userId = event.requestContext.authorizer.jwt.claims.sub
  const { s3_key, connection_id } = JSON.parse(event.body)

  // WebSocket client for progress updates
  const wsClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
  })

  // 1. Download and parse Anki deck from S3
  const file = await s3.getObject({ Bucket: BUCKET, Key: s3_key })
  const deck = await parseAnkiDeck(file.Body)

  await sendProgress(connection_id, { step: 'parsing', progress: 25 })

  // 2. Import cards in batches
  const scheduler = new SM2Scheduler()
  for (let i = 0; i < deck.notes.length; i++) {
    const note = deck.notes[i]

    // Create card
    const cardId = crypto.randomUUID()
    await db.createCard(userId, {
      card_id: cardId,
      front: note.fields[0],
      back: note.fields[1],
      explanation: note.fields[2] || '',
      category: deck.name,
      source: 'anki'
    })

    // Create bidirectional review items
    await db.createReviewItem(userId, scheduler.initializeReviewItem(cardId, 'forward'))
    await db.createReviewItem(userId, scheduler.initializeReviewItem(cardId, 'reverse'))

    // Send progress update every 10 cards
    if (i % 10 === 0) {
      const progress = 25 + Math.floor((i / deck.notes.length) * 75)
      await sendProgress(connection_id, {
        step: 'importing',
        progress,
        imported: i,
        total: deck.notes.length
      })
    }
  }

  await sendProgress(connection_id, { step: 'complete', progress: 100 })

  return { statusCode: 200, body: JSON.stringify({ imported: deck.notes.length }) }
}

async function sendProgress(connectionId: string, data: any) {
  await wsClient.send(new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(data)
  }))
}
```

**Key Features**:
- Real-time WebSocket progress updates
- Batch processing for large decks
- Automatic bidirectional review item creation
- S3 integration for file uploads

---

### 4. Database (DynamoDB - Chosen)

**Technology**: Amazon DynamoDB with single-table design

**Why DynamoDB**:
- **Cost**: ~$1-3/month (vs $20+/month for RDS)
- **Serverless**: No cold starts, auto-scaling, pay per request
- **Performance**: Sub-10ms latency for all operations
- **No VPC**: Simpler Lambda configuration
- **Fully managed**: No backups, patches, or maintenance

**Trade-offs**:
- More complex data modeling (single-table design)
- No ad-hoc SQL queries (requires predefined access patterns)
- Data denormalization (card content embedded in ReviewItems)

**Table Structure**:
- Table name: `taaltuig-main`
- Billing: On-demand (pay per request)
- Primary key: `PK` (partition key), `SK` (sort key)
- GSI1: Query review items by state and due date
- GSI2: Query review history by date (for counting new cards)

**Entity Patterns**:
```
User:         PK=USER#{google_sub}  SK=PROFILE
Settings:     PK=USER#{user_id}     SK=SETTINGS
Card:         PK=USER#{user_id}     SK=CARD#{card_id}
ReviewItem:   PK=USER#{user_id}     SK=REVIEWITEM#{id}
              GSI1PK=USER#{user_id}#{state}  GSI1SK={due_date}
History:      PK=USER#{user_id}     SK=HISTORY#{timestamp}#{item_id}
              GSI2PK=USER#{user_id}#HISTORY#{date}  GSI2SK={timestamp}
```

See `/docs/design/backend/dynamodb-schema.md` for complete schema details.

---

### 5. Authentication

#### Technology: OAuth2 with Google Sign-In + API Gateway JWT Authorizer

**Why this approach?**
- No password storage/management required
- Users trust Google authentication
- API Gateway has built-in JWT validation
- Simple frontend integration
- No email verification needed
- Lower security burden for MVP

#### OAuth2 Flow

```
┌──────────┐                                    ┌──────────────┐
│ Frontend │                                    │    Google    │
│          │  1. Redirect to Google OAuth       │   OAuth 2.0  │
│          ├───────────────────────────────────>│              │
│          │                                    │              │
│          │  2. User approves                  │              │
│          │                                    │              │
│          │  3. Redirect back with id_token    │              │
│          │<───────────────────────────────────┤              │
└─────┬────┘                                    └──────────────┘
      │
      │ 4. Store token (localStorage)
      │
      │ 5. API request with Authorization: Bearer <id_token>
      ▼
┌────────────────┐
│  API Gateway   │
│  JWT Authorizer│  6. Validate token signature (Google JWKS)
│                │  7. Extract claims (sub, email, name)
└────────┬───────┘
         │
         │ 8. Forward to Lambda with user context
         ▼
┌────────────────┐
│    Lambda      │
│                │  9. Get/create user by google_sub
│                │  10. Process request
└────────────────┘
```

#### API Gateway JWT Authorizer Configuration

```typescript
// CDK configuration
const authorizer = new apigateway.CfnAuthorizer(this, 'GoogleAuthorizer', {
  name: 'GoogleJWT',
  type: 'JWT',
  identitySource: '$request.header.Authorization',
  jwtConfiguration: {
    issuer: 'https://accounts.google.com',
    audience: [process.env.GOOGLE_CLIENT_ID],
  },
})
```

**How it works**:
- API Gateway automatically validates JWT signature using Google's public keys (JWKS)
- No Lambda code needed for auth validation
- Invalid/expired tokens get 401 before reaching Lambda
- Lambda receives verified claims in `event.requestContext.authorizer.claims`

#### Frontend: Google Sign-In Integration

```typescript
// Using @react-oauth/google library
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GoogleLogin
        onSuccess={(response) => {
          // Store id_token
          localStorage.setItem('auth_token', response.credential)
          // Navigate to app
        }}
        onError={() => console.error('Login failed')}
      />
    </GoogleOAuthProvider>
  )
}

// Making authenticated requests
fetch('/api/reviews/queue', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
})
```

#### Lambda: Extract User Identity

```typescript
async function handler(event: APIGatewayProxyEventV2) {
  // API Gateway already validated the JWT
  const claims = event.requestContext.authorizer.jwt.claims

  const googleSub = claims.sub        // Google's unique user ID
  const email = claims.email          // User's email
  const name = claims.name            // User's name

  // Get or create user in database
  let user = await db.getUserByGoogleSub(googleSub)

  if (!user) {
    // First time sign-in: create user record
    user = await db.createUser({
      id: generateUUID(),
      google_sub: googleSub,
      email,
      name,
      created_at: new Date()
    })

    // Initialize default settings
    await db.createUserSettings(user.id, DEFAULT_SETTINGS)
  }

  // Continue with business logic using user.id
  // ...
}
```

#### Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE NOT NULL,    -- Google's user identifier
  email TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,                   -- Google profile picture
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX idx_users_google_sub ON users(google_sub);
```

**No password fields** - authentication delegated to Google.

#### Token Lifecycle

- **Expiration**: Google id_tokens expire after ~1 hour
- **Refresh**: Frontend detects 401, triggers Google re-auth (silent refresh)
- **Logout**: Clear localStorage token, revoke Google OAuth consent (optional)
- **Storage**: localStorage (acceptable for MVP, consider httpOnly cookie for production)

#### Google Cloud Console Setup

1. Create OAuth 2.0 Client ID at https://console.cloud.google.com/apis/credentials
2. Configure authorized JavaScript origins (frontend domain)
3. Configure redirect URIs
4. Note Client ID → store in environment variable
5. Enable Google+ API (for profile info)

#### Security Considerations

- **Token validation**: Handled by API Gateway (checks signature, expiry, issuer)
- **HTTPS only**: Enforced by CloudFront
- **No password liability**: Google handles credentials
- **Scope**: Request minimal scopes (email, profile only)
- **Token exposure**: Frontend tokens visible in browser (acceptable for public clients)

#### API Endpoints

```
POST   /api/auth/callback       # Optional: exchange code for token (not needed with implicit flow)
GET    /api/auth/me            # Get current user profile
POST   /api/auth/logout        # Clear server-side session (minimal for stateless JWT)
```

Most auth is client-side with Google's SDK. Backend mainly needs `/api/auth/me` for profile fetching.

---

## End-to-End Review Session Flow

### Scenario: User reviews their daily queue

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User opens /review page                                  │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend: GET /api/reviews/queue                         │
│    Headers: { Authorization: "Bearer <jwt>" }               │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. GetReviewQueue Lambda                                    │
│    - Verify JWT                                             │
│    - Query database:                                        │
│      * Due ReviewItems (LEARNING, REVIEW, RELEARNING)       │
│      * NEW ReviewItems (up to daily limit)                  │
│    - JOIN with Cards table for content                      │
│    - Return queue array                                     │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend receives queue                                  │
│    { queue: [                                               │
│        {                                                     │
│          review_item_id: "abc123",                          │
│          direction: "forward",                              │
│          front: "de kat",                                   │
│          back: "the cat",                                   │
│          state: "REVIEW"                                    │
│        },                                                    │
│        ...                                                   │
│      ],                                                      │
│      stats: { due_count: 10, new_count: 5, ... }           │
│    }                                                         │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend displays first card                             │
│    - Shows "de kat" (front)                                 │
│    - User clicks "Show Answer"                              │
│    - Reveals "the cat" (back)                               │
│    - Shows grade buttons: Again, Hard, Good, Easy           │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. User clicks "Good" (grade = 3)                           │
│    Frontend: POST /api/reviews/submit                       │
│    {                                                         │
│      review_item_id: "abc123",                              │
│      grade: 3,                                              │
│      duration_ms: 4500                                      │
│    }                                                         │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. SubmitReview Lambda                                      │
│    - Load ReviewItem from DB                                │
│    - Load UserSettings                                      │
│    - Call scheduler.schedule(item, grade=3, settings, now)  │
│      → SM2 calculates: new interval, ease_factor, due_date  │
│    - UPDATE review_items (new state)                        │
│    - INSERT review_history (audit log)                      │
│    - Fetch next card from queue                             │
│    - Return response                                        │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Frontend receives response                               │
│    {                                                         │
│      next_review: "2024-01-26T10:00:00Z",                   │
│      interval_days: 7,                                      │
│      next_item: { ... }  // Next card in queue              │
│    }                                                         │
│    - Display next card automatically                        │
│    - Repeat steps 5-8 until queue empty                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Infrastructure as Code (CDK)

### Stack Organization
```
packages/infrastructure/lib/stacks/
├── database-stack.ts        # DynamoDB table with GSI1/GSI2
├── api-stack.ts             # HTTP API + WebSocket API + 19 Lambdas
└── frontend-stack.ts        # S3 + CloudFront distribution
```

**3 stacks total**, deployed via `pnpm deploy`

### Stack Details

**DatabaseStack**:
- DynamoDB table: `taaltuig-main`
- On-demand billing
- GSI1: Review items by state/due date
- GSI2: Review history by date
- Point-in-time recovery enabled

**ApiStack**:
- HTTP API (v2) with JWT authorizer
- WebSocket API with Lambda authorizer
- S3 bucket for Anki uploads
- 19 Lambda functions (Node.js 20)
- IAM permissions for DynamoDB + S3 + WebSocket

**FrontendStack**:
- S3 bucket for static assets
- CloudFront distribution with OAI
- Custom domain (optional)

### Lambda Configuration
All Lambdas use **esbuild** for bundling:
```typescript
const lambdaDefaults = {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
  environment: {
    NODE_OPTIONS: '--enable-source-maps',
    TABLE_NAME: props.tableName,
    ANKI_IMPORT_BUCKET: ankiImportBucket.bucketName,
  }
}

new lambda.Function(this, 'GetReviewQueueFunction', {
  ...lambdaDefaults,
  functionName: 'taaltuig-get-review-queue',
  code: lambda.Code.fromAsset(
    path.join(__dirname, '../../../lambdas/get-review-queue/dist')
  ),
})
```

Each Lambda package has its own `package.json` with esbuild script:
```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node20 --outdir=dist --format=cjs --external:@aws-sdk/*"
  }
}
```

---

## Deployment

**Current**: Manual deployment via `pnpm deploy`
- Builds all Lambda functions
- Synthesizes CloudFormation templates
- Deploys 3 stacks to AWS
- Updates frontend to S3 + CloudFront

**Future CI/CD**:
- GitHub Actions on merge to `main`
- Automated testing + deployment
- Staging environment for pre-prod validation

---

## Scalability

### Current Capacity
- **Concurrent users**: 10,000+ (Lambda auto-scales, DynamoDB on-demand)
- **Cost**: ~$1-3/month for typical usage (100 active users)
- **Latency**: <100ms API responses, <10ms DynamoDB queries

### Growth Path
DynamoDB and Lambda scale automatically with demand:
- No manual provisioning required
- Pay-per-request pricing scales cost with usage
- DynamoDB can handle 40,000+ req/sec per partition
- Lambda concurrent execution limit: 1,000 (can request increase)

### Potential Optimizations (if needed)
- DynamoDB DAX (caching layer) for hot data
- CloudFront edge caching for static responses
- Lambda reserved concurrency for critical functions

---

## Security Considerations

### Authentication
- Google OAuth2 id_tokens (expire after ~1 hour)
- HTTPS only (enforced by CloudFront)
- API Gateway validates JWT signatures automatically
- No password storage (delegated to Google)

### Authorization
- API Gateway validates JWT before reaching Lambda (401 if invalid)
- Lambda extracts user ID from verified claims (`event.requestContext.authorizer.jwt.claims.sub`)
- User ID never trusted from request body
- Database queries always filter by `user_id`

### Database
- Parameterized queries only (no SQL injection)
- Secrets stored in AWS Secrets Manager
- VPC isolation for RDS (Lambdas in same VPC)

### Rate Limiting (Future)
- API Gateway throttling: 1000 req/sec per user
- Lambda concurrency limits

---

## Decided Architecture Choices

1. ✅ **Database**: DynamoDB with single-table design (cost and performance)
2. ✅ **API**: HTTP API Gateway v2 (lower cost than REST API)
3. ✅ **Auth**: Google OAuth2 with JWT authorizer
4. ✅ **Real-time**: WebSocket API for import progress
5. ✅ **File storage**: S3 for Anki deck uploads (1-day lifecycle)
6. ✅ **Monitoring**: CloudWatch (built-in, sufficient for MVP)
7. ✅ **Environment**: Single production environment

---

## Implementation Status

**Completed**:
1. ✅ SRS Engine (SM-2 algorithm in `@taaltuig/dynamodb-client`)
2. ✅ System architecture (this doc)
3. ✅ DynamoDB schema (single-table design)
4. ✅ API implementation (17+ HTTP + WebSocket endpoints)
5. ✅ Frontend (review, cards, import, settings)
6. ✅ CDK infrastructure (3 stacks: database, api, frontend)
7. ✅ Phases 1-3 deployed and operational

**Next priorities**:
- Phase 4: Writing exercises + AI evaluation
- Phase 5: Insights and learning analytics
