import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as path from 'path'
import { Construct } from 'constructs'

interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string
  domainName?: string // e.g., 'taal.danhowden.com'
}

/**
 * Frontend Stack - S3 + CloudFront
 *
 * Hosts the React SPA with HTTPS, CDN distribution, and SPA routing support
 */
export class FrontendStack extends cdk.Stack {
  public readonly distributionUrl: string

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    // S3 bucket for static website hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `taaltuig-frontend-${this.account}`,
      publicReadAccess: false, // CloudFront will access via OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete bucket on stack deletion
      autoDeleteObjects: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true, // Enable versioning for rollback capability
      lifecycleRules: [
        {
          // Delete old versions after 30 days to control storage costs
          noncurrentVersionExpiration: cdk.Duration.days(30),
          // Clean up incomplete multipart uploads
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    })

    // Security headers policy
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        responseHeadersPolicyName: 'TaaltuigSecurityHeaders',
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: `default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${props.apiUrl} wss://*.execute-api.eu-central-1.amazonaws.com https://accounts.google.com; frame-src https://accounts.google.com;`,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
        },
      }
    )

    // Custom domain + ACM certificate (if domainName provided)
    let certificate: acm.ICertificate | undefined
    let hostedZone: route53.IHostedZone | undefined

    if (props.domainName) {
      // Look up the Route53 hosted zone (derives parent domain from subdomain)
      const zoneName = props.domainName.split('.').slice(1).join('.')
      hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: zoneName,
      })

      // Create ACM certificate in us-east-1 (required for CloudFront)
      certificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
        domainName: props.domainName,
        hostedZone,
        region: 'us-east-1',
      })
    }

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      ...(props.domainName &&
        certificate && {
          domainNames: [props.domainName],
          certificate,
        }),
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
      },
      errorResponses: [
        {
          // SPA routing: serve index.html for 404s
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          // Handle 403 errors (S3 returns 403 for missing files)
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      comment: 'Taaltuig Frontend CDN',
    })

    // Route53 alias record pointing domain to CloudFront
    if (props.domainName && hostedZone) {
      new route53.ARecord(this, 'SiteAliasRecord', {
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution)
        ),
        zone: hostedZone,
      })

      new route53.AaaaRecord(this, 'SiteAliasRecordV6', {
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution)
        ),
        zone: hostedZone,
      })
    }

    // Deploy frontend build artifacts to S3
    // Note: This will deploy on every CDK deploy. In production, use CI/CD pipeline.
    const frontendPath = path.join(__dirname, '../../../frontend/dist')

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(frontendPath)],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'], // Invalidate all cached files on deploy
      memoryLimit: 512,
      retainOnDelete: false,
    })

    this.distributionUrl = props.domainName ?? distribution.distributionDomainName

    // ============================================================================
    // OUTPUTS
    // ============================================================================

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distributionUrl}`,
      description: 'CloudFront Distribution URL',
      exportName: 'TaaltuigFrontendUrl',
    })

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    })

    new cdk.CfnOutput(this, 'BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket Name',
    })

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: props.apiUrl,
      description: 'API Gateway URL for frontend configuration',
    })
  }
}
