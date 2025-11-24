# Manufacturing Platform - Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS CDK v2 installed globally: `npm install -g aws-cdk`
- Docker (for local development and Lambda packaging)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Lambda Funcs  │────│   Databases     │
│  (REST + Auth)  │    │ (Sensor Ingest) │    │(TimescaleDB/PG) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │      SNS        │    │       S3        │
         └──────────────│ (Email Alerts)  │    │   (Archival)    │
                        └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/jere-ingargiola/up-labs-manufacturing-platform.git
cd up-labs-manufacturing-platform
npm install
```

### 2. Build Services

```bash
# Build TypeScript services
npm run build

# Build Lambda functions
cd lambdas/ingestSensorData && npm install && npm run build && cd ../..
cd lambdas/getEquipmentMetrics && npm install && npm run build && cd ../..
cd lambdas/getEquipmentStatus && npm install && npm run build && cd ../..
cd lambdas/ultraFastAlerts && npm install && npm run build && cd ../..
```

### 3. Deploy Infrastructure

```bash
cd cdk
npm install
npm run build

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stack
cdk deploy --require-approval never
```

### 4. Configure Environment

After deployment, update environment variables:

```bash
# Get the outputs from deployment
aws cloudformation describe-stacks --stack-name ManufacturingPlatform-development --query 'Stacks[0].Outputs'
```

## Environment Configuration

### Development Environment

```bash
# Set AWS profile
export AWS_PROFILE=manufacturing-platform

# Environment variables
export NODE_ENV=development
export TENANT_ID=acme-corp
```

### Production Environment

```bash
export NODE_ENV=production
export TENANT_ID=your-production-tenant
```

## Database Setup

### TimescaleDB Extensions

```sql
-- Connect to TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create hypertables for time-series data
SELECT create_hypertable('sensor_data', 'timestamp');
SELECT add_retention_policy('sensor_data', INTERVAL '30 days');
```

### PostgreSQL Configuration

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optimize for manufacturing workloads
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

## Monitoring and Alerts

### CloudWatch Dashboards

The platform creates custom CloudWatch dashboards for:

- **Processing Latency:** Lambda execution times
- **Error Rates:** Failed requests and exceptions
- **Throughput:** Requests per second and data volume
- **Alert Frequency:** Critical alerts by equipment/facility

### SNS Alert Configuration

```bash
# Confirm email subscription (check your email after deployment)
aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:us-east-1:ACCOUNT:manufacturing-alerts-development
```

## Testing

### Local Testing

```bash
# Run sensor data ingestion test
cd lambdas/ingestSensorData
node testRunner.js temp    # Critical temperature test
node testRunner.js vib     # Critical vibration test
node testRunner.js pressure # Critical pressure test
```

### API Testing

```bash
# Test via API Gateway
curl -X POST https://API_GATEWAY_URL/development/webhook/events \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Tenant-ID: acme-corp" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "TEST_FURNACE",
    "timestamp": "2025-11-24T20:00:00.000Z",
    "temperature": 195.7
  }'
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**
   - Check API key is included: `X-API-Key`
   - Verify tenant header: `X-Tenant-ID`

2. **502 Internal Server Error**
   - Missing tenant ID header
   - Lambda timeout (increase timeout in CDK)
   - Database connection issues

3. **Lambda Import Errors**
   - Ensure `dist` folder contains compiled services
   - Check Node.js version compatibility
   - Verify Lambda packaging includes all dependencies

### Log Analysis

```bash
# View Lambda logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/LAMBDA_FUNCTION_NAME" \
  --start-time $(date -d '1 hour ago' +%s)000

# View API Gateway logs
aws logs filter-log-events \
  --log-group-name "API-Gateway-Execution-Logs_API_ID/development" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Performance Tuning

1. **Lambda Optimization**
   ```typescript
   // Increase memory for better CPU performance
   memorySize: 1024,
   // Optimize timeout for SLA requirements
   timeout: cdk.Duration.seconds(15),
   ```

2. **Database Optimization**
   ```sql
   -- Create indexes for common queries
   CREATE INDEX idx_sensor_equipment_time ON sensor_data (equipment_id, timestamp DESC);
   CREATE INDEX idx_alerts_severity_time ON alerts (severity, created_at DESC);
   ```

3. **S3 Optimization**
   ```typescript
   // Configure lifecycle for cost optimization
   lifecycleRules: [
     {
       transitions: [
         { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
         { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) }
       ]
     }
   ]
   ```

## Security Considerations

### API Key Management

- Rotate API keys every 90 days
- Use different keys per environment
- Store keys in AWS Secrets Manager for production

### Database Security

- Enable encryption at rest and in transit
- Use IAM database authentication
- Implement least-privilege access policies
- Regular security patches and updates

### Network Security

- VPC with private subnets for databases
- Security groups with minimal required ports
- NAT Gateways for Lambda internet access
- VPC endpoints for AWS services

## Cost Optimization

### Expected Monthly Costs (Development)

- **Lambda:** ~$50-100 (based on 1M requests)
- **RDS:** ~$200-400 (r6g.large instances)
- **S3:** ~$20-50 (100GB with lifecycle)
- **API Gateway:** ~$10-20 (1M requests)
- **CloudWatch:** ~$10-30 (logs and metrics)

**Total Estimated:** $290-600/month

### Production Scaling

- Use Auto Scaling for RDS
- Implement Lambda provisioned concurrency for consistent performance
- Use CloudFront for API Gateway caching
- Implement DynamoDB for high-frequency metadata

## Backup and Recovery

### Database Backups

- Automated daily backups (30-day retention)
- Point-in-time recovery enabled
- Cross-region backup replication for production

### S3 Data Protection

- Versioning enabled
- Cross-region replication
- MFA delete protection
- Lifecycle policies for cost optimization

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly:**
   - Review CloudWatch alarms and metrics
   - Check Lambda error rates and timeouts
   - Monitor database performance metrics

2. **Monthly:**
   - Review and optimize costs
   - Update dependencies and security patches
   - Rotate API keys and secrets

3. **Quarterly:**
   - Performance testing and optimization
   - Capacity planning review
   - Security audit and compliance check