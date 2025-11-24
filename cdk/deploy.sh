#!/bin/bash

# Build and deploy script for Manufacturing Platform CDK

set -e

echo "🏗️  Building Manufacturing Platform Infrastructure..."

# Navigate to CDK directory
#cd cdk

# Install dependencies
echo "📦 Installing CDK dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check for AWS CLI and CDK CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo "❌ CDK CLI not found. Installing..."
    npm install -g aws-cdk
fi

# Get deployment parameters
ENVIRONMENT=${1:-development}
TENANT_ID=${2:-}
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "🌍 Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $REGION"
if [ -n "$TENANT_ID" ]; then
    echo "  Tenant ID: $TENANT_ID"
    echo "  Deployment Type: Single-Tenant"
else
    echo "  Deployment Type: Multi-Tenant"
fi

# Set AWS Profile
export AWS_PROFILE=${AWS_PROFILE:-manufacturing-platform}
echo "  AWS Profile: $AWS_PROFILE"

# Bootstrap CDK (if needed)
echo "🥾 Bootstrapping CDK..."
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$REGION

# Deploy based on tenant configuration
if [ -n "$TENANT_ID" ]; then
    echo "🚀 Deploying single-tenant infrastructure for tenant: $TENANT_ID"
    cdk deploy --context environment=$ENVIRONMENT --context tenantId=$TENANT_ID --require-approval never
else
    echo "🚀 Deploying multi-tenant infrastructure"
    cdk deploy --context environment=$ENVIRONMENT --require-approval never
fi

echo "✅ Deployment completed successfully!"

# Output useful information
echo ""
echo "📋 Post-deployment information:"
echo "  Check CloudFormation outputs for:"
echo "  - API Gateway URL"
echo "  - Database endpoints"
echo "  - S3 bucket names"
echo "  - Kafka cluster ARN"
echo ""
echo "  Monitor the deployment in AWS Console:"
echo "  - CloudFormation: https://console.aws.amazon.com/cloudformation/home?region=$REGION"
echo "  - Lambda: https://console.aws.amazon.com/lambda/home?region=$REGION"
echo "  - API Gateway: https://console.aws.amazon.com/apigateway/home?region=$REGION"
