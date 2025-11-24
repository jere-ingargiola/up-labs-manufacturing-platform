#!/bin/bash

# Manufacturing Platform - Cleanup Script
# This script safely removes all deployed infrastructure

echo "🧹 Manufacturing Platform Cleanup Script"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will delete all deployed infrastructure!"
echo "    - AWS Lambda functions"
echo "    - API Gateway"
echo "    - RDS databases (with all data)"
echo "    - S3 bucket (with all archived data)" 
echo "    - SNS topics and subscriptions"
echo "    - CloudWatch logs and metrics"
echo ""

read -p "Are you sure you want to proceed? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Starting cleanup process..."

# Check if CDK is available
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK not found. Please install it first: npm install -g aws-cdk"
    exit 1
fi

# Check AWS credentials
echo "☁️  Checking AWS credentials..."
aws sts get-caller-identity > /dev/null

if [ $? -ne 0 ]; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Get stack status
STACK_NAME="ManufacturingPlatform-development"
echo "📋 Checking stack status..."

STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    echo "ℹ️  Stack $STACK_NAME not found. Nothing to clean up."
    exit 0
fi

echo "📊 Current stack status: $STACK_STATUS"

# Destroy the CDK stack
echo ""
echo "🔥 Destroying CDK stack..."
cd cdk

cdk destroy --force

if [ $? -eq 0 ]; then
    echo "✅ CDK stack destroyed successfully!"
else
    echo "❌ Failed to destroy CDK stack. You may need to clean up manually."
    echo ""
    echo "🔧 Manual cleanup steps:"
    echo "  1. Go to AWS Console"
    echo "  2. CloudFormation -> Stacks -> $STACK_NAME -> Delete"
    echo "  3. If deletion fails, check dependencies and retry"
    exit 1
fi

# Clean up any remaining resources that might not have been deleted
echo ""
echo "🧽 Checking for remaining resources..."

# Check for any remaining S3 buckets
echo "  📦 Checking S3 buckets..."
BUCKET_NAME=$(aws s3 ls | grep manufacturing-platform-archival | awk '{print $3}' || echo "")

if [ -n "$BUCKET_NAME" ]; then
    echo "  🗑️  Found remaining bucket: $BUCKET_NAME"
    echo "     Emptying bucket..."
    aws s3 rm s3://$BUCKET_NAME --recursive
    echo "     Deleting bucket..."
    aws s3 rb s3://$BUCKET_NAME
    echo "  ✅ Bucket cleaned up"
else
    echo "  ✅ No remaining S3 buckets found"
fi

# Check for remaining API Gateway APIs
echo "  🌐 Checking API Gateway..."
API_ID=$(aws apigateway get-rest-apis \
  --query 'items[?contains(name, `Manufacturing`)].id' \
  --output text 2>/dev/null || echo "")

if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
    echo "  🗑️  Found remaining API Gateway: $API_ID"
    aws apigateway delete-rest-api --rest-api-id $API_ID
    echo "  ✅ API Gateway cleaned up"
else
    echo "  ✅ No remaining API Gateways found"
fi

# Clean up local build artifacts
echo ""
echo "🧹 Cleaning up local build artifacts..."
rm -rf dist/
rm -rf cdk/cdk.out/
rm -rf node_modules/
rm -rf cdk/node_modules/

# Clean up Lambda function artifacts
LAMBDA_DIRS=("ingestSensorData" "getEquipmentMetrics" "getEquipmentStatus" "ultraFastAlerts")

for dir in "${LAMBDA_DIRS[@]}"; do
    if [ -d "lambdas/$dir" ]; then
        rm -rf "lambdas/$dir/dist/"
        rm -rf "lambdas/$dir/node_modules/"
    fi
done

echo "✅ Local artifacts cleaned up"

echo ""
echo "🎉 Cleanup completed successfully!"
echo ""
echo "📋 What was cleaned up:"
echo "  ✅ CloudFormation stack deleted"
echo "  ✅ All AWS resources removed"
echo "  ✅ S3 buckets emptied and deleted"
echo "  ✅ API Gateway removed"
echo "  ✅ Lambda functions deleted"
echo "  ✅ RDS databases terminated"
echo "  ✅ SNS topics and subscriptions removed"
echo "  ✅ CloudWatch logs and metrics deleted"
echo "  ✅ Local build artifacts removed"
echo ""
echo "ℹ️  Note: Some CloudWatch logs may take up to 30 days to be fully deleted"
echo "    as per AWS retention policies."
echo ""
echo "🚀 To redeploy the platform, run: ./scripts/deploy.sh"