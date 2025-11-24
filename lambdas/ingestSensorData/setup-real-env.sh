#!/bin/bash

echo "🔧 Setting up environment for REAL database and service connections"
echo ""

echo "Database credentials will be fetched from AWS Secrets Manager:"
echo "  - manufacturing-platform/postgres"
echo "  - manufacturing-platform/timescale"
echo ""

echo "If you prefer to use environment variables instead, set:"
echo "  export POSTGRES_PASSWORD=your_password"
echo "  export TIMESCALE_PASSWORD=your_password"
echo ""

# Optional: Set custom secret names
if [ -n "$POSTGRES_SECRET_NAME" ]; then
  export POSTGRES_SECRET_NAME
  echo "Using custom PostgreSQL secret: $POSTGRES_SECRET_NAME"
fi

if [ -n "$TIMESCALE_SECRET_NAME" ]; then
  export TIMESCALE_SECRET_NAME
  echo "Using custom TimescaleDB secret: $TIMESCALE_SECRET_NAME"
fi

# Set default AWS region if not set
export AWS_REGION=${AWS_REGION:-us-east-1}

# Database endpoints (update these to match your actual RDS endpoints)
export POSTGRES_HOST="manufacturingplatform-developme-postgresdb113281d2-tsgocyznjzyn.cnqweieki09q.us-east-1.rds.amazonaws.com"
export TIMESCALE_HOST="manufacturingplatform-developme-timescaledb8c85e6b5-ktkleipzexpy.cnqweieki09q.us-east-1.rds.amazonaws.com"
export POSTGRES_DB="manufacturing"
export TIMESCALE_DB="manufacturing"
export POSTGRES_USER="postgres"
export TIMESCALE_USER="postgres"

# Kafka configuration (update to match your MSK cluster)
export KAFKA_BROKERS="your-msk-cluster.kafka.us-east-1.amazonaws.com:9092"

# S3 bucket (update to match your actual bucket name)
export SHARED_S3_BUCKET="manufacturingplatform-developme-datastoragebucket-1234567890"

echo "✅ Environment variables set for real service connections"
echo ""
echo "Now run: node testRunner.js [scenario]"
echo ""
echo "Available scenarios:"
echo "  normal    - Normal sensor data"
echo "  temp      - Critical temperature"
echo "  vib       - Critical vibration" 
echo "  pressure  - Critical pressure"
echo "  multi     - Multiple critical alerts"
echo "  all       - Run all scenarios"