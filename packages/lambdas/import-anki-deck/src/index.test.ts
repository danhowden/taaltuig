import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { Readable } from 'stream'

// Mock dependencies
const mockS3Send = vi.fn()
const mockWebSocketSend = vi.fn()
const mockFsStat = vi.fn()
const mockFsReadFile = vi.fn()
const mockFsMkdir = vi.fn()
const mockFsRm = vi.fn()
const mockFsUnlink = vi.fn()
const mockFsRealpath = vi.fn()
const mockFsWriteFile = vi.fn()
const mockZipLoadAsync = vi.fn()
const mockReadAnkiCollection = vi.fn()
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

vi.mock('fs/promises', async () => {
  return {
    stat: mockFsStat,
    readFile: mockFsReadFile,
    mkdir: mockFsMkdir,
    rm: mockFsRm,
    unlink: mockFsUnlink,
    realpath: mockFsRealpath,
    writeFile: mockFsWriteFile,
  }
})

vi.mock('jszip', async () => {
  return {
    default: {
      loadAsync: mockZipLoadAsync,
    },
  }
})

vi.mock('anki-reader', async () => {
  return {
    readAnkiCollection: mockReadAnkiCollection,
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

describe('import-anki-deck handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.WEBSOCKET_API_ENDPOINT = 'https://test-ws-api.execute-api.us-east-1.amazonaws.com/prod'
    mockWebSocketSend.mockResolvedValue({})

    // Fix fs.stat mock to return object with isDirectory method
    mockFsStat.mockImplementation((path: string) => {
      return Promise.resolve({
        size: 1024,
        isDirectory: () => !path.includes('.'),
      })
    })
  })

  const createMockEvent = (
    body: unknown,
    userId = 'test-user',
    connectionId?: string,
    authType: 'websocket' | 'http' = 'http'
  ): APIGatewayProxyEventV2 => ({
    requestContext: {
      authorizer: authType === 'websocket'
        ? { sub: userId } // WebSocket Lambda Authorizer format
        : { jwt: { claims: { sub: userId } } }, // HTTP API JWT Authorizer format
      connectionId,
    } as APIGatewayProxyEventV2['requestContext'],
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEventV2)

  it('should return 401 when unauthorized (no authorizer)', async () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
      body: JSON.stringify({ s3Bucket: 'bucket', s3Key: 'key' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('should return 401 when HTTP API JWT is missing sub claim', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {},
          },
        },
      },
      body: JSON.stringify({ s3Bucket: 'bucket', s3Key: 'key' }),
    } as unknown as APIGatewayProxyEventV2

    const result = await handler(event)

    expect(result.statusCode).toBe(401)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('should authorize with WebSocket Lambda Authorizer format', async () => {
    const event = createMockEvent(
      { s3Bucket: 'test-bucket', s3Key: 'uploads/user/deck.apkg' },
      'websocket-user-123',
      'connection-abc',
      'websocket'
    )

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => 'test',
        getBack: () => 'test',
        getFields: () => ({ Front: 'test', Back: 'test' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({ 1: mockCards[0] }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)

    // Verify card was created with WebSocket user ID
    expect(mockCreateCard).toHaveBeenCalledWith(
      'websocket-user-123',
      'test',
      'test',
      '',
      [],
      'anki',
      expect.stringContaining('/') // category in format "collection/deck"
    )
  })

  it('should authorize with HTTP API JWT Authorizer format', async () => {
    const event = createMockEvent(
      { s3Bucket: 'test-bucket', s3Key: 'uploads/user/deck.apkg' },
      'http-user-456',
      undefined,
      'http'
    )

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => 'test',
        getBack: () => 'test',
        getFields: () => ({ Front: 'test', Back: 'test' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({ 1: mockCards[0] }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)

    // Verify card was created with HTTP API user ID
    expect(mockCreateCard).toHaveBeenCalledWith(
      'http-user-456',
      'test',
      'test',
      '',
      [],
      'anki',
      expect.stringContaining('/') // category in format "collection/deck"
    )
  })

  it('should return 400 when s3Bucket is missing', async () => {
    const event = createMockEvent({ s3Key: 'key' })

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 's3Bucket and s3Key are required',
      code: 'MISSING_FIELDS',
    })
  })

  it('should return 400 when s3Key is missing', async () => {
    const event = createMockEvent({ s3Bucket: 'bucket' })

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 's3Bucket and s3Key are required',
      code: 'MISSING_FIELDS',
    })
  })

  it('should return 400 when file is too large', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    // Mock S3 download
    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    // Mock file size check - 101MB
    mockFsStat.mockResolvedValue({ size: 101 * 1024 * 1024 })
    mockFsUnlink.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Maximum file size is 100MB',
      code: 'FILE_TOO_LARGE',
    })
  })

  it('should return 400 for invalid ZIP format', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    // Mock S3 download
    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    // Mock file size check
    mockFsStat.mockResolvedValue({ size: 1024 })

    // Mock invalid ZIP (missing magic bytes)
    mockFsReadFile.mockResolvedValue(Buffer.from('not a zip file'))
    mockFsUnlink.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'File is not a valid ZIP archive',
      code: 'INVALID_FORMAT',
    })
  })

  it('should return 400 when uncompressed size is too large', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    // Mock S3 download
    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    // Valid ZIP magic bytes
    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    // Mock ZIP with huge uncompressed size
    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('file1.txt', {
          dir: false,
          _data: { uncompressedSize: 260 * 1024 * 1024 },
        })
      }),
    }
    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Maximum uncompressed size is 250MB',
      code: 'UNCOMPRESSED_TOO_LARGE',
    })
  })

  it('should return 400 when no collection database found', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('media/file.mp3', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => null), // No collection file
    }
    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockFsUnlink.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'No collection database found in .apkg file',
      code: 'INVALID_ANKI_DECK',
    })
  })

  it('should successfully import cards from Anki deck', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    // Mock Anki cards
    const mockCards = [
      {
        getFront: () => 'hallo',
        getBack: () => 'hello',
        getFields: () => ({ Front: 'hallo', Back: 'hello' }),
      },
      {
        getFront: () => 'dag',
        getBack: () => 'goodbye',
        getFields: () => ({ Front: 'dag', Back: 'goodbye', Extra: 'farewell' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({
        1: mockCards[0],
        2: mockCards[1],
      }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(2)
    expect(body.skipped).toBe(0)
    expect(body.total).toBe(2)

    expect(mockCreateCard).toHaveBeenCalledTimes(2)
    expect(mockCreateCard).toHaveBeenCalledWith(
      'test-user',
      'hallo',
      'hello',
      '',
      [],
      'anki',
      expect.stringContaining('/') // category in format "collection/deck"
    )
    expect(mockCreateCard).toHaveBeenCalledWith(
      'test-user',
      'dag',
      'goodbye',
      'farewell',
      [],
      'anki',
      expect.stringContaining('/') // category in format "collection/deck"
    )
  })

  it('should handle partial failures when creating cards', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => 'card1',
        getBack: () => 'back1',
        getFields: () => ({ Front: 'card1', Back: 'back1' }),
      },
      {
        getFront: () => 'card2',
        getBack: () => 'back2',
        getFields: () => ({ Front: 'card2', Back: 'back2' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({
        1: mockCards[0],
        2: mockCards[1],
      }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)

    // First card succeeds, second fails
    mockCreateCard
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Duplicate card'))

    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.imported).toBe(1)
    expect(body.skipped).toBe(1)
    expect(body.total).toBe(2)
  })

  it('should return 500 on S3 error', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    mockS3Send.mockRejectedValue(new Error('S3 connection failed'))

    const result = await handler(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'S3 connection failed',
      code: 'INTERNAL_SERVER_ERROR',
    })
  })

  it('should strip HTML tags and entities from card content', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => '<b>bold text</b>&nbsp;[sound:audio.mp3]',
        getBack: () => 'normal &amp; escaped',
        getFields: () => ({
          Front: '<b>bold text</b>&nbsp;[sound:audio.mp3]',
          Back: 'normal &amp; escaped',
        }),
      },
    ]

    const mockDeck = {
      getCards: () => ({ 1: mockCards[0] }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    await handler(event)

    expect(mockCreateCard).toHaveBeenCalledWith(
      'test-user',
      'bold text',
      'normal & escaped',
      '',
      [],
      'anki',
      expect.stringContaining('/') // category in format "collection/deck"
    )
  })

  it('should handle WebSocket events with connectionId', async () => {
    // Test that handler completes successfully when connectionId is provided
    const event = createMockEvent(
      {
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/user/deck.apkg',
      },
      'test-user',
      'test-connection-123'
    )

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => 'hallo',
        getBack: () => 'hello',
        getFields: () => ({ Front: 'hallo', Back: 'hello' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({ 1: mockCards[0] }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    // Handler should complete successfully even with WebSocket
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(1)
    expect(body.total).toBe(1)
  })

  it('should work without WebSocket when connectionId is not provided', async () => {
    const event = createMockEvent({
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/user/deck.apkg',
    })

    const mockStream = new Readable()
    mockStream.push(Buffer.from('test'))
    mockStream.push(null)
    mockS3Send.mockResolvedValue({ Body: mockStream })

    mockFsStat.mockResolvedValue({ size: 1024 })

    const zipBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('rest of zip'),
    ])
    mockFsReadFile.mockResolvedValue(zipBuffer)
    mockFsMkdir.mockResolvedValue(undefined)

    const mockCards = [
      {
        getFront: () => 'test',
        getBack: () => 'test',
        getFields: () => ({ Front: 'test', Back: 'test' }),
      },
    ]

    const mockDeck = {
      getCards: () => ({ 1: mockCards[0] }),
    }

    const mockCollection = {
      getDecks: () => ({ deck1: mockDeck }),
    }

    const mockCollectionFile = {
      async: vi.fn(() => new Uint8Array([1, 2, 3])),
    }

    const mockZip = {
      forEach: vi.fn((callback: (relativePath: string, file: unknown) => void) => {
        callback('collection.anki21', {
          dir: false,
          _data: { uncompressedSize: 1024 },
        })
      }),
      file: vi.fn(() => mockCollectionFile),
    }

    mockZipLoadAsync.mockResolvedValue(mockZip)
    mockReadAnkiCollection.mockResolvedValue(mockCollection)
    mockCreateCard.mockResolvedValue({})
    mockFsUnlink.mockResolvedValue(undefined)
    mockFsRm.mockResolvedValue(undefined)

    const result = await handler(event)

    // Should complete successfully even without WebSocket
    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(1)

    // WebSocket should not have been called (no connectionId)
    expect(mockWebSocketSend).not.toHaveBeenCalled()
  })
})
