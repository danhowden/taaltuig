# Lambda Development Standards

## Code Quality Workflow

**Linting runs automatically before every build via `prebuild` hooks.**

When you run `pnpm build`, it automatically:
1. Runs `pnpm lint` first (prebuild)
2. Fails the build if linting errors are found
3. Only proceeds to build if linting passes

**Manual linting (optional):**
```bash
# Lint all lambdas
pnpm -r --filter '@taaltuig/lambda-*' lint

# Lint single lambda
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

**Common ESLint Rules:**
- No `any` types - use proper TypeScript types or `unknown`
- No unused variables - prefix with `_` if intentionally unused (e.g., `_userId`)
- Prefer `const` over `let` when variables aren't reassigned
- No `require()` - use ES6 `import` statements

**Development workflow:**
1. Make code changes
2. Run `pnpm build` (automatically lints, then builds)
3. Run `pnpm test` to verify tests pass

## Test Structure

All lambda tests follow Vitest conventions:

- **File naming**: `src/index.test.ts` (alongside `src/index.ts`)
- **Run tests**: `pnpm test` (single run) or `pnpm test:watch` (watch mode)
- **Coverage**: Use `vitest --coverage` when configured

## Test Patterns

### Handler Tests (API Gateway Lambdas)

Test all handler outcomes:

1. **Success cases** - Valid inputs return expected responses
2. **Auth failures** - Missing/invalid JWT claims return 401
3. **Validation failures** - Invalid request body returns 400
4. **Not found** - Missing resources return 404
5. **Forbidden** - Wrong ownership returns 403
6. **Server errors** - Exceptions return 500

### Mock External Dependencies

Always mock:
- DynamoDB client methods (`TaaltuigDynamoDBClient`)
- AWS SDK calls
- Environment variables (`process.env.TABLE_NAME`)

### Test Structure Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Create mocks before module import
const mockMethodName = vi.fn()

vi.mock('@taaltuig/dynamodb-client', async () => {
  return {
    TaaltuigDynamoDBClient: vi.fn().mockImplementation(() => ({
      methodName: mockMethodName,
    })),
    SM2Scheduler: vi.fn().mockImplementation(() => ({
      schedule: vi.fn(),
    })),
  }
})

// Import handler AFTER mocking to avoid hoisting issues
const { handler } = await import('./index')

describe('Lambda Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('should handle success case', async () => {
    // Arrange
    mockMethodName.mockResolvedValue({ /* mock data */ })
    const event = { /* mock event */ } as APIGatewayProxyEventV2

    // Act
    const result = await handler(event)

    // Assert
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ /* expected */ })
  })

  it('should return 401 when unauthorized', async () => {
    const event = { requestContext: { authorizer: {} } } as APIGatewayProxyEventV2
    const result = await handler(event)
    expect(result.statusCode).toBe(401)
  })
})
```

**Important:** Use async import `await import('./index')` AFTER `vi.mock()` to prevent module hoisting issues.

## Scheduler Tests (SM2Scheduler)

Test all state transitions and grade responses:

- **NEW/LEARNING**: Again (0), Hard (2), Good (3), Easy (4)
- **RELEARNING**: All grades with step progression
- **REVIEW**: SM-2 algorithm logic with interval/ease factor calculations

### Key Assertions

- Verify `state`, `interval`, `ease_factor`, `repetitions`, `step_index`
- Check `due_date` calculations (use fixed `now` for determinism)
- Validate edge cases (minimum ease factor 1.3, step boundaries)

## Client Tests (TaaltuigDynamoDBClient)

Test CRUD operations and query logic:

- Mock `DynamoDBDocumentClient` methods
- Test input parameter construction
- Verify correct PK/SK patterns
- Test error handling and edge cases

## Principles

- **Fast**: No real AWS calls, use mocks
- **Isolated**: Each test is independent
- **Deterministic**: Fixed dates, no random values
- **Readable**: Clear arrange/act/assert structure
- **Comprehensive**: Cover happy path + all error codes
