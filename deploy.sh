#!/bin/bash
set -e

# Taaltuig Deployment Script
# This script handles environment variables and deploys all CDK stacks

echo "🚀 Taaltuig Deployment Script"
echo "=============================="

# Load environment variables from .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "✅ Loaded environment from .env"
else
  echo "❌ Error: .env file not found"
  echo "Please copy .env.example to .env and configure it"
  exit 1
fi

# Check for AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ Error: AWS credentials not configured"
  echo "Please run: aws configure"
  exit 1
fi

echo "✅ AWS credentials found"
echo "📦 Building all packages..."

# Build all packages
pnpm build

echo "☁️  Deploying CDK stacks..."

# Deploy infrastructure
cd packages/infrastructure
pnpm cdk deploy --all --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Check the API URL in the CDK outputs"
echo "2. Update VITE_API_BASE_URL in your frontend .env"
echo "3. Run 'pnpm --filter frontend dev' to start the frontend"
