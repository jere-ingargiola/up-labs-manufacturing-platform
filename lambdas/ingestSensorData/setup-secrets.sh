#!/bin/bash

echo "🔐 AWS Secrets Manager Setup for Manufacturing Platform"
echo "======================================================"
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
echo "Using AWS region: $AWS_REGION"
echo ""

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local description=$2
    local username=$3
    local host=$4
    local dbname=$5
    
    echo "Setting up secret: $secret_name"
    echo "Database host: $host"
    echo ""
    
    # Prompt for password
    echo -n "Enter password for $username@$host: "
    read -s password
    echo ""
    
    # Create secret JSON
    secret_json=$(cat <<EOF
{
  "username": "$username",
  "password": "$password", 
  "host": "$host",
  "dbname": "$dbname",
  "port": 5432
}
EOF
)
    
    # Try to create secret, update if it already exists
    if aws secretsmanager create-secret \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --name "$secret_name" \
        --description "$description" \
        --secret-string "$secret_json" &> /dev/null; then
        echo "✅ Created secret: $secret_name"
    else
        # Secret exists, update it
        if aws secretsmanager update-secret \
            --profile "$AWS_PROFILE" \
            --region "$AWS_REGION" \
            --secret-id "$secret_name" \
            --secret-string "$secret_json" &> /dev/null; then
            echo "✅ Updated existing secret: $secret_name"
        else
            echo "❌ Failed to create/update secret: $secret_name"
            return 1
        fi
    fi
    echo ""
}

# PostgreSQL setup
echo "1. PostgreSQL Database Setup"
echo "-----------------------------"
POSTGRES_HOST=${POSTGRES_HOST:-"manufacturingplatform-developme-postgresdb113281d2-tsgocyznjzyn.cnqweieki09q.us-east-1.rds.amazonaws.com"}
create_or_update_secret \
    "manufacturing-platform/postgres" \
    "PostgreSQL credentials for manufacturing platform" \
    "postgres" \
    "$POSTGRES_HOST" \
    "manufacturing"

# TimescaleDB setup  
echo "2. TimescaleDB Database Setup"
echo "-----------------------------"
TIMESCALE_HOST=${TIMESCALE_HOST:-"manufacturingplatform-developme-timescaledb8c85e6b5-ktkleipzexpy.cnqweieki09q.us-east-1.rds.amazonaws.com"}
create_or_update_secret \
    "manufacturing-platform/timescale" \
    "TimescaleDB credentials for manufacturing platform" \
    "postgres" \
    "$TIMESCALE_HOST" \
    "manufacturing"

echo "🎉 Secrets setup complete!"
echo ""
echo "You can now run the testRunner without setting password environment variables:"
echo "  cd /path/to/lambdas/ingestSensorData"
echo "  node testRunner.js normal"
echo ""
echo "To view/manage secrets:"
echo "  aws secretsmanager list-secrets --profile $AWS_PROFILE --region $AWS_REGION"
echo "  aws secretsmanager get-secret-value --profile $AWS_PROFILE --secret-id manufacturing-platform/postgres --region $AWS_REGION"