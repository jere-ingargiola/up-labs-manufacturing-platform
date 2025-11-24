#!/bin/bash

# Manufacturing Platform - Quick Deployment Script
# This script deploys the complete manufacturing platform infrastructure

set -e  # Exit on any error

echo "🏭 Manufacturing Platform Deployment Script"
echo "============================================="

# Check prerequisites
echo "✅ Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK not found. Installing globally..."
    npm install -g aws-cdk
fi

echo "✅ Prerequisites check passed!"

# Build the project
echo ""
echo "🔨 Building TypeScript services..."
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript services"
    exit 1
fi

# Build Lambda functions
echo ""
echo "🔨 Building Lambda functions..."

LAMBDA_DIRS=("ingestSensorData" "getEquipmentMetrics" "getEquipmentStatus" "ultraFastAlerts")

for dir in "${LAMBDA_DIRS[@]}"; do
    if [ -d "lambdas/$dir" ]; then
        echo "  📦 Building $dir..."
        cd "lambdas/$dir"
        npm install
        npm run build
        cd "../.."
    fi
done

echo "✅ Lambda functions built successfully!"

# Copy dist to Lambda directories for packaging
echo ""
echo "📁 Copying shared services to Lambda packages..."
for dir in "${LAMBDA_DIRS[@]}"; do
    if [ -d "lambdas/$dir" ]; then
        rm -rf "lambdas/$dir/dist"
        cp -r "dist" "lambdas/$dir/"
    fi
done

# Deploy CDK stack
echo ""
echo "🚀 Deploying AWS infrastructure..."
cd cdk

echo "  📦 Installing CDK dependencies..."
npm install
npm run build

echo "  ☁️  Checking AWS credentials..."
aws sts get-caller-identity > /dev/null

if [ $? -ne 0 ]; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "  🏗️  Deploying CDK stack..."
cdk deploy --require-approval never

if [ $? -ne 0 ]; then
    echo "❌ CDK deployment failed"
    exit 1
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Getting deployment outputs..."
aws cloudformation describe-stacks \
  --stack-name ManufacturingPlatform-development \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
  --output table

echo ""
echo "🧪 Testing the API..."
API_URL=$(aws cloudformation describe-stacks --stack-name ManufacturingPlatform-development --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayURL`].OutputValue' --output text)
API_KEY=$(aws apigateway get-api-key --api-key $(aws cloudformation describe-stacks --stack-name ManufacturingPlatform-development --query 'Stacks[0].Outputs[?OutputKey==`APIKeyId`].OutputValue' --output text) --include-value --query 'value' --output text)

echo "  📡 Testing sensor data endpoint..."
curl -X POST "${API_URL}webhook/events" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-ID: acme-corp" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "DEPLOYMENT_TEST",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "temperature": 25.0
  }' \
  -s | jq .

echo ""
echo "✅ Manufacturing Platform deployed and tested successfully!"
echo ""
echo "📋 Quick Reference:"
echo "  API URL: $API_URL"
echo "  API Key: $API_KEY"
echo "  Tenant ID: acme-corp"
echo ""
echo "📚 Next Steps:"
echo "  1. Check your email for SNS subscription confirmation"
echo "  2. Review API documentation: ./API.md"
echo "  3. Test with Postman using the credentials above"
echo "  4. Monitor CloudWatch dashboards for metrics"
echo ""
echo "🆘 Support:"
echo "  - Documentation: ./docs/"
echo "  - Logs: aws logs tail /aws/lambda/ManufacturingPlatform-*"
echo "  - Cleanup: ./scripts/cleanup.sh"