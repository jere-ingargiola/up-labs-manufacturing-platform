#!/bin/bash

echo "🔍 Discovering existing CDK-created database secrets..."
echo "====================================================="
echo ""

# Set AWS profile
export AWS_PROFILE=${AWS_PROFILE:-manufacturing-platform}

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check if user is authenticated with the correct profile
echo "Using AWS profile: $AWS_PROFILE"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$AWS_PROFILE'."
    echo "   Run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME=${CDK_STACK_NAME:-ManufacturingPlatformStack}

echo "🔧 Searching for secrets in region: $AWS_REGION"
echo "   Stack name pattern: $STACK_NAME"
echo ""

# List all secrets that might be from the CDK stack
echo "📋 All database-related secrets:"
aws secretsmanager list-secrets \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'SecretList[?contains(Name, `Postgres`) || contains(Name, `Timescale`) || contains(Name, `TimescaleCredentials`) || contains(Name, `PostgresCredentials`) || contains(Description, `PostgreSQL`) || contains(Description, `TimescaleDB`)].{Name:Name,Description:Description,Arn:ARN}' \
    --output table

echo ""
echo "🎯 CDK Stack-specific secrets (if any):"
aws secretsmanager list-secrets \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "SecretList[?contains(Name, '$STACK_NAME')].{Name:Name,Description:Description,Arn:ARN}" \
    --output table

echo ""
echo "💡 To use these secrets in testRunner.js, set:"
echo ""

# Try to find the specific secrets and generate export commands
POSTGRES_ARN=$(aws secretsmanager list-secrets --profile "$AWS_PROFILE" --region "$AWS_REGION" --query "SecretList[?contains(Name, 'PostgresCredentials') || (contains(Name, '$STACK_NAME') && contains(Description, 'PostgreSQL'))].ARN | [0]" --output text 2>/dev/null)
TIMESCALE_ARN=$(aws secretsmanager list-secrets --profile "$AWS_PROFILE" --region "$AWS_REGION" --query "SecretList[?contains(Name, 'TimescaleCredentials') || (contains(Name, '$STACK_NAME') && contains(Description, 'TimescaleDB'))].ARN | [0]" --output text 2>/dev/null)

if [ "$POSTGRES_ARN" != "None" ] && [ "$POSTGRES_ARN" != "" ]; then
    echo "export POSTGRES_SECRET_ARN=\"$POSTGRES_ARN\""
else
    echo "# PostgreSQL secret not found - you may need to deploy CDK first"
fi

if [ "$TIMESCALE_ARN" != "None" ] && [ "$TIMESCALE_ARN" != "" ]; then
    echo "export TIMESCALE_SECRET_ARN=\"$TIMESCALE_ARN\""
else
    echo "# TimescaleDB secret not found - you may need to deploy CDK first"
fi

echo ""
echo "📚 Or run with discovered secrets:"
if [ "$POSTGRES_ARN" != "None" ] && [ "$POSTGRES_ARN" != "" ] && [ "$TIMESCALE_ARN" != "None" ] && [ "$TIMESCALE_ARN" != "" ]; then
    echo "POSTGRES_SECRET_ARN=\"$POSTGRES_ARN\" TIMESCALE_SECRET_ARN=\"$TIMESCALE_ARN\" node testRunner.js normal"
else
    echo "# Secrets not found - deploy CDK stack first: cd ../../../cdk && ./deploy.sh"
fi