import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { WebSocketLambdaAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'
import { Construct } from 'constructs'
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

interface ApiStackProps extends cdk.StackProps {
  googleClientId: string
  tableName: string
  frontendDomain?: string // Optional: custom domain for CORS
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string
  public readonly wsApiUrl: string

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    // Note: Reserved concurrency removed - account has limited capacity (min 40 unreserved required)
    // For cost control, rely on API Gateway rate limiting instead

    // CORS allowed origins: localhost for dev, custom domain for production
    const corsOrigins = [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Alternative dev port
    ]
    if (props.frontendDomain) {
      corsOrigins.push(`https://${props.frontendDomain}`)
    }

    // Create HTTP API (lower cost and latency than REST API)
    const httpApi = new apigatewayv2.HttpApi(this, 'TaaltuigHttpApi', {
      apiName: 'Taaltuig API',
      description: 'Taaltuig SRS API with Google OAuth JWT authentication',
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // Add rate limiting to the default stage (10 req/s, burst 20)
    const defaultStage = httpApi.defaultStage?.node
      .defaultChild as apigatewayv2.CfnStage
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 20,
      throttlingRateLimit: 10,
    }

    // JWT Authorizer for Google OAuth tokens
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'GoogleJwtAuthorizer',
      'https://accounts.google.com',
      {
        jwtAudience: [props.googleClientId],
        identitySource: ['$request.header.Authorization'],
      }
    )

    // ============================================================================
    // WEBSOCKET API (for real-time import progress)
    // ============================================================================

    const webSocketApi = new WebSocketApi(this, 'TaaltuigWebSocketApi', {
      apiName: 'Taaltuig WebSocket API',
      description: 'WebSocket API for real-time Anki import progress',
    })

    const webSocketStage = new WebSocketStage(this, 'WebSocketProdStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    })

    this.wsApiUrl = webSocketStage.url

    // WebSocket Lambda Authorizer (validates Google JWT tokens)
    const wsAuthorizerLambda = new lambda.Function(this, 'WsAuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      functionName: 'taaltuig-ws-authorizer',
      description: 'WebSocket authorizer for Google OAuth JWT validation',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../lambdas/ws-authorizer/dist')
      ),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128, // Right-sized for simple auth check
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        GOOGLE_CLIENT_ID: props.googleClientId,
      },
    })

    const wsAuthorizer = new WebSocketLambdaAuthorizer(
      'WebSocketAuthorizer',
      wsAuthorizerLambda,
      {
        identitySource: ['route.request.querystring.token'],
      }
    )

    // S3 bucket for Anki deck imports
    const ankiImportBucket = new s3.Bucket(this, 'AnkiImportBucket', {
      bucketName: `taaltuig-anki-imports-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: corsOrigins,
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Delete uploaded files after 1 day (they're processed immediately)
          expiration: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Common Lambda environment variables
    const commonEnvironment = {
      NODE_OPTIONS: '--enable-source-maps',
      TABLE_NAME: props.tableName,
      ANKI_IMPORT_BUCKET: ankiImportBucket.bucketName,
    }

    // Common Lambda configuration
    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 128, // Right-sized for simple Lambdas
      environment: commonEnvironment,
    }

    // ============================================================================
    // AUTH LAMBDAS
    // ============================================================================

    const getCurrentUserLambda = new lambda.Function(
      this,
      'GetCurrentUserFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-current-user',
        description: 'Get authenticated user profile (auto-creates on first access)',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-current-user/dist')
        ),
      }
    )

    // ============================================================================
    // REVIEW LAMBDAS
    // ============================================================================

    const getReviewQueueLambda = new lambda.Function(
      this,
      'GetReviewQueueFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-review-queue',
        description: 'Fetch daily review queue with due and new cards',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-review-queue/dist')
        ),
      }
    )

    const submitReviewLambda = new lambda.Function(
      this,
      'SubmitReviewFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-submit-review',
        description: 'Submit review grade and update scheduling state',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/submit-review/dist')
        ),
      }
    )

    // ============================================================================
    // CARD LAMBDAS
    // ============================================================================

    const createCardLambda = new lambda.Function(
      this,
      'CreateCardFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-create-card',
        description: 'Create new flashcard with bidirectional review items',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/create-card/dist')
        ),
      }
    )

    const listCardsLambda = new lambda.Function(
      this,
      'ListCardsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-list-cards',
        description: 'List all cards for authenticated user',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/list-cards/dist')
        ),
      }
    )

    const updateCardLambda = new lambda.Function(
      this,
      'UpdateCardFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-update-card',
        description: 'Update existing card and sync review items',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/update-card/dist')
        ),
      }
    )

    const deleteCardLambda = new lambda.Function(
      this,
      'DeleteCardFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-delete-card',
        description: 'Delete card and associated review items',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/delete-card/dist')
        ),
      }
    )

    // ============================================================================
    // SETTINGS LAMBDAS
    // ============================================================================

    const getSettingsLambda = new lambda.Function(
      this,
      'GetSettingsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-settings',
        description: 'Get user SRS configuration',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-settings/dist')
        ),
      }
    )

    const updateSettingsLambda = new lambda.Function(
      this,
      'UpdateSettingsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-update-settings',
        description: 'Update user SRS configuration',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/update-settings/dist')
        ),
      }
    )

    const renameCategoryLambda = new lambda.Function(
      this,
      'RenameCategoryFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-rename-category',
        description: 'Rename category across all cards and review items',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/rename-category/dist')
        ),
      }
    )

    // ============================================================================
    // BEDROCK / AI EXPERIMENTATION
    // ============================================================================

    const bedrockChatLambda = new lambda.Function(
      this,
      'BedrockChatFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-bedrock-chat',
        description: 'Experimental endpoint for testing AWS Bedrock models',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/bedrock-chat/dist')
        ),
        timeout: cdk.Duration.seconds(30), // Longer timeout for AI calls
        memorySize: 256, // More memory for AI processing
      }
    )

    // Grant Bedrock permissions (restricted to Claude and Nova models)
    bedrockChatLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
          'arn:aws:bedrock:*::foundation-model/amazon.nova-*',
          // Cross-region inference profiles
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    )

    // ============================================================================
    // AI INSIGHTS LAMBDAS
    // ============================================================================

    const generateInsightsLambda = new lambda.Function(
      this,
      'GenerateInsightsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-generate-insights',
        description: 'Generate AI insights for vocabulary cards using Sonnet 4.5',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/generate-insights/dist')
        ),
        timeout: cdk.Duration.seconds(60), // Longer timeout for AI calls
        memorySize: 256, // More memory for AI processing
      }
    )

    const validateInsightsLambda = new lambda.Function(
      this,
      'ValidateInsightsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-validate-insights',
        description: 'Validate AI-generated insights using Haiku 3.5',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/validate-insights/dist')
        ),
        timeout: cdk.Duration.seconds(60), // Shorter timeout for Haiku
        memorySize: 256,
      }
    )

    // Grant CloudWatch PutMetricData permission to validate-insights Lambda
    validateInsightsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'Taaltuig/Insights',
          },
        },
      })
    )

    const reviewInsightLambda = new lambda.Function(
      this,
      'ReviewInsightFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-review-insight',
        description: 'Human review of individual card insights',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/review-insight/dist')
        ),
      }
    )

    const getInsightsQueueLambda = new lambda.Function(
      this,
      'GetInsightsQueueFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-insights-queue',
        description: 'Get cards needing insight review',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-insights-queue/dist')
        ),
      }
    )

    const getMetricsLambda = new lambda.Function(
      this,
      'GetMetricsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-metrics',
        description: 'Query CloudWatch metrics for insights validation',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-metrics/dist')
        ),
      }
    )

    // Grant CloudWatch GetMetricStatistics permission to get-metrics Lambda
    getMetricsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:GetMetricStatistics'],
        resources: ['*'],
      })
    )

    // Grant Bedrock permissions for insight generation and validation
    const insightBedrockLambdas = [generateInsightsLambda, validateInsightsLambda]
    insightBedrockLambdas.forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeModel'],
          resources: [
            'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
            // Cross-region inference profiles
            `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
          ],
        })
      )
    })

    // ============================================================================
    // DEBUG LAMBDAS
    // ============================================================================

    const resetDailyReviewsLambda = new lambda.Function(
      this,
      'ResetDailyReviewsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-reset-daily-reviews',
        description: 'Reset daily review history (for testing)',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/reset-daily-reviews/dist')
        ),
      }
    )

    const clearInsightsLambda = new lambda.Function(
      this,
      'ClearInsightsFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-clear-insights',
        description: 'Clear all AI-generated insights from cards and review items',
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/clear-insights/dist')
        ),
      }
    )

    // ============================================================================
    // ANKI IMPORT LAMBDAS
    // ============================================================================

    const getUploadUrlLambda = new lambda.Function(
      this,
      'GetUploadUrlFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-get-upload-url',
        description: 'Generate presigned S3 URL for Anki deck upload',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/get-upload-url/dist')
        ),
      }
    )

    const importAnkiDeckLambda = new lambda.Function(
      this,
      'ImportAnkiDeckFunction',
      {
        ...lambdaDefaults,
        functionName: 'taaltuig-import-anki-deck',
        description: 'Parse and import Anki deck from S3 with WebSocket progress',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../lambdas/import-anki-deck/dist')
        ),
        timeout: cdk.Duration.minutes(15), // Long timeout for large imports
        memorySize: 512, // More memory for ZIP extraction
        environment: {
          ...commonEnvironment,
          WEBSOCKET_API_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
        },
      }
    )

    // WebSocket connection handlers (simple passthrough - no DynamoDB needed)
    const wsConnectLambda = new lambda.Function(this, 'WsConnectFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      functionName: 'taaltuig-ws-connect',
      description: 'WebSocket $connect handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return { statusCode: 200, body: 'Connected' };
        };
      `),
    })

    const wsDisconnectLambda = new lambda.Function(this, 'WsDisconnectFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      functionName: 'taaltuig-ws-disconnect',
      description: 'WebSocket $disconnect handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return { statusCode: 200, body: 'Disconnected' };
        };
      `),
    })

    // Grant DynamoDB permissions to all Lambdas
    const allLambdas = [
      getCurrentUserLambda,
      getReviewQueueLambda,
      submitReviewLambda,
      getSettingsLambda,
      updateSettingsLambda,
      renameCategoryLambda,
      createCardLambda,
      listCardsLambda,
      updateCardLambda,
      deleteCardLambda,
      resetDailyReviewsLambda,
      getUploadUrlLambda,
      importAnkiDeckLambda,
      generateInsightsLambda,
      validateInsightsLambda,
      reviewInsightLambda,
      getInsightsQueueLambda,
      clearInsightsLambda,
    ]

    // Import the DynamoDB table from the database stack
    const table = dynamodb.Table.fromTableName(
      this,
      'ImportedTable',
      props.tableName
    )

    // Grant read/write permissions to all Lambdas including GSI access
    allLambdas.forEach((fn) => {
      table.grantReadWriteData(fn)

      // Explicitly grant permissions for Global Secondary Indexes
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:Query',
            'dynamodb:Scan',
          ],
          resources: [
            `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.tableName}/index/*`,
          ],
        })
      )
    })

    // Grant S3 permissions for Anki import
    ankiImportBucket.grantPut(getUploadUrlLambda) // Can generate presigned URLs
    ankiImportBucket.grantRead(importAnkiDeckLambda) // Can read uploaded files

    // Grant WebSocket postToConnection permission to import lambda
    importAnkiDeckLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${webSocketStage.stageName}/POST/@connections/*`,
        ],
      })
    )

    // ============================================================================
    // API ROUTES
    // ============================================================================

    // Auth routes
    httpApi.addRoutes({
      path: '/api/auth/me',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetCurrentUserIntegration',
        getCurrentUserLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Review routes
    httpApi.addRoutes({
      path: '/api/reviews/queue',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetReviewQueueIntegration',
        getReviewQueueLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/reviews/submit',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'SubmitReviewIntegration',
        submitReviewLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Settings routes
    httpApi.addRoutes({
      path: '/api/settings',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetSettingsIntegration',
        getSettingsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/settings',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        'UpdateSettingsIntegration',
        updateSettingsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Category routes
    httpApi.addRoutes({
      path: '/api/categories/rename',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        'RenameCategoryIntegration',
        renameCategoryLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Card routes
    httpApi.addRoutes({
      path: '/api/cards',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'CreateCardIntegration',
        createCardLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/cards',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'ListCardsIntegration',
        listCardsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/cards/{card_id}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        'UpdateCardIntegration',
        updateCardLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/cards/{card_id}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration(
        'DeleteCardIntegration',
        deleteCardLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Bedrock AI experimentation route
    httpApi.addRoutes({
      path: '/api/bedrock/chat',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'BedrockChatIntegration',
        bedrockChatLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // AI Insights routes
    httpApi.addRoutes({
      path: '/api/insights/generate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'GenerateInsightsIntegration',
        generateInsightsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/insights/validate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'ValidateInsightsIntegration',
        validateInsightsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/insights/queue',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetInsightsQueueIntegration',
        getInsightsQueueLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/insights/{card_id}/review',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration(
        'ReviewInsightIntegration',
        reviewInsightLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Metrics route
    httpApi.addRoutes({
      path: '/api/metrics/insights',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'GetMetricsIntegration',
        getMetricsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Debug routes
    httpApi.addRoutes({
      path: '/api/debug/reset-daily-reviews',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'ResetDailyReviewsIntegration',
        resetDailyReviewsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/debug/clear-insights',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'ClearInsightsIntegration',
        clearInsightsLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // Anki import routes
    httpApi.addRoutes({
      path: '/api/import/upload-url',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'GetUploadUrlIntegration',
        getUploadUrlLambda
      ),
      authorizer: jwtAuthorizer,
    })

    httpApi.addRoutes({
      path: '/api/import/anki',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'ImportAnkiDeckIntegration',
        importAnkiDeckLambda
      ),
      authorizer: jwtAuthorizer,
    })

    // ============================================================================
    // WEBSOCKET ROUTES
    // ============================================================================

    webSocketApi.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration(
        'ConnectIntegration',
        wsConnectLambda
      ),
      authorizer: wsAuthorizer,
    })

    webSocketApi.addRoute('$disconnect', {
      integration: new WebSocketLambdaIntegration(
        'DisconnectIntegration',
        wsDisconnectLambda
      ),
    })

    webSocketApi.addRoute('importAnki', {
      integration: new WebSocketLambdaIntegration(
        'ImportAnkiIntegration',
        importAnkiDeckLambda
      ),
    })

    // ============================================================================
    // OUTPUTS
    // ============================================================================

    this.apiUrl = httpApi.apiEndpoint

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'Taaltuig API Gateway URL',
      exportName: 'TaaltuigApiUrl',
    })

    new cdk.CfnOutput(this, 'ApiId', {
      value: httpApi.httpApiId,
      description: 'API Gateway ID',
    })

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: this.wsApiUrl,
      description: 'WebSocket API URL for real-time updates',
      exportName: 'TaaltuigWebSocketUrl',
    })

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: webSocketApi.apiId,
      description: 'WebSocket API Gateway ID',
    })
  }
}
