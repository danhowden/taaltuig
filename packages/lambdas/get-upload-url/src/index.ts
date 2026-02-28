import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import {
  getUserIdFromEvent,
  parseJsonBody,
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
  jsonResponse,
} from '@taaltuig/lambda-utils'

// Configure S3 client without checksums for browser-compatible presigned URLs
const s3Client = new S3Client({
  requestHandler: {
    requestTimeout: 0,
  },
})
const BUCKET_NAME = process.env.ANKI_IMPORT_BUCKET!

interface UploadUrlRequest {
  filename: string
  contentType?: string
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getUserIdFromEvent(event)
    if (!userId) {
      return unauthorizedResponse()
    }

    // Parse request body
    const parsed = parseJsonBody(event)
    if (parsed.error) {
      return badRequestResponse('filename is required', 'MISSING_FIELD')
    }

    const body = parsed.data as UploadUrlRequest
    if (!body.filename) {
      return badRequestResponse('filename is required', 'MISSING_FIELD')
    }

    // Validate file extension
    if (!body.filename.toLowerCase().endsWith('.apkg')) {
      return badRequestResponse(
        'Only .apkg files are supported',
        'INVALID_FILE_TYPE'
      )
    }

    // Generate unique S3 key with user prefix
    const fileId = randomUUID()
    const s3Key = `uploads/${userId}/${fileId}/${body.filename}`

    // Create presigned URL (valid for 5 minutes)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      signableHeaders: new Set(),
    })

    return jsonResponse({
      uploadUrl,
      s3Key,
      s3Bucket: BUCKET_NAME,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return serverErrorResponse(error, true)
  }
}
