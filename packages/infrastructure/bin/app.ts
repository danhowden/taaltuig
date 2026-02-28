#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ApiStack } from '../lib/stacks/api-stack'
import { DatabaseStack } from '../lib/stacks/database-stack'
import { FrontendStack } from '../lib/stacks/frontend-stack'

const app = new cdk.App()

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
}

// Google OAuth Client ID (required for JWT authorizer)
const googleClientId = process.env.GOOGLE_CLIENT_ID
if (!googleClientId) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required')
}

// Database stack (DynamoDB single-table design)
const databaseStack = new DatabaseStack(app, 'TaaltuigDatabaseStack', {
  env,
})

// Frontend domain for CORS (optional - defaults to localhost only)
const frontendDomain = process.env.FRONTEND_DOMAIN

// API stack (API Gateway + Lambda functions)
const apiStack = new ApiStack(app, 'TaaltuigApiStack', {
  env,
  googleClientId,
  tableName: databaseStack.table.tableName,
  frontendDomain,
})
apiStack.addDependency(databaseStack)

// Frontend stack (S3 + CloudFront)
const frontendStack = new FrontendStack(app, 'TaaltuigFrontendStack', {
  env,
  apiUrl: apiStack.apiUrl,
  domainName: frontendDomain,
})
frontendStack.addDependency(apiStack)

app.synth()
