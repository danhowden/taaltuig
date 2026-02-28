import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

/**
 * Database Stack - DynamoDB Single Table Design
 *
 * Cost-optimized serverless database using DynamoDB on-demand pricing.
 * Estimated cost: $1-3/month for MVP traffic.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Main DynamoDB table with single-table design
    this.table = new dynamodb.Table(this, 'TaaltuigMainTable', {
      tableName: 'taaltuig-main',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect data on stack deletion
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      timeToLiveAttribute: 'ttl', // Optional: for expiring data
    })

    // GSI1 - For querying review items by state and due date
    // Access pattern: Get all review items in a specific state (NEW, LEARNING, REVIEW, RELEARNING)
    // sorted by due date
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL, // Include all attributes
    })

    // GSI2 - For querying review history by date
    // Access pattern: Count new cards reviewed on a specific date
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
      exportName: 'TaaltuigTableName',
    })

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
    })

    new cdk.CfnOutput(this, 'BillingMode', {
      value: 'PAY_PER_REQUEST',
      description: 'On-demand pricing - only pay for what you use',
    })
  }
}
