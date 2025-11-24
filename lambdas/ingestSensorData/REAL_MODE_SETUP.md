# Real Database Testing Setup

This guide explains how to run the testRunner against **real databases and AWS services** instead of mocked ones.

## ⚠️ Important Warning

Running in real mode will:
- Write actual data to your PostgreSQL and TimescaleDB databases
- Create files in your S3 buckets
- Send messages to Kafka topics
- Consume AWS resources and may incur costs

## Prerequisites

### 1. Database Access
Ensure your databases are accessible:
- PostgreSQL RDS instance is running and accessible
- TimescaleDB RDS instance is running and accessible  
- Security groups allow connections from your IP
- Database credentials are available

### 2. AWS Access
Configure AWS credentials:
```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### 3. Network Access
Ensure connectivity:
- RDS instances are accessible from your network
- MSK Kafka cluster allows connections (if using managed Kafka)
- S3 buckets are accessible

## Setup Instructions

### Method 1: Interactive Setup (Recommended)
```bash
# Run the setup script
./setup-real-env.sh

# Then run tests
node testRunner.js normal
```

### Method 2: AWS Secrets Manager (Recommended for Production)
```bash
# Create secrets in AWS Secrets Manager first:
aws secretsmanager create-secret \
  --name "manufacturing-platform/postgres" \
  --description "PostgreSQL credentials for manufacturing platform" \
  --secret-string '{"username":"postgres","password":"your_postgres_password","host":"your-postgres-host","dbname":"manufacturing"}'

aws secretsmanager create-secret \
  --name "manufacturing-platform/timescale" \
  --description "TimescaleDB credentials for manufacturing platform" \
  --secret-string '{"username":"postgres","password":"your_timescale_password","host":"your-timescale-host","dbname":"manufacturing"}'

# Then run tests (credentials will be fetched automatically)
node testRunner.js normal
```

### Method 3: Manual Environment Variables
```bash
# Database passwords (fallback method)
export POSTGRES_PASSWORD="your_postgres_password"
export TIMESCALE_PASSWORD="your_timescale_password"

# Database endpoints (update to match your RDS endpoints)
export POSTGRES_HOST="your-postgres-rds-endpoint.us-east-1.rds.amazonaws.com"
export TIMESCALE_HOST="your-timescale-rds-endpoint.us-east-1.rds.amazonaws.com"

# Database names and users
export POSTGRES_DB="manufacturing"
export TIMESCALE_DB="manufacturing"
export POSTGRES_USER="postgres"  
export TIMESCALE_USER="postgres"

# AWS configuration
export AWS_REGION="us-east-1"
export SHARED_S3_BUCKET="your-s3-bucket-name"
export KAFKA_BROKERS="your-msk-cluster.kafka.us-east-1.amazonaws.com:9092"

# Run tests
node testRunner.js normal
```

## Test Scenarios

```bash
# Individual scenarios
node testRunner.js normal     # Normal sensor data
node testRunner.js temp       # Critical temperature alert
node testRunner.js vib        # Critical vibration alert  
node testRunner.js pressure   # Critical pressure alert
node testRunner.js multi      # Multiple critical alerts

# All scenarios
node testRunner.js all
```

## What Gets Written

### TimescaleDB (`sensor_data_raw` table)
- Time-series sensor readings
- Equipment metrics (temperature, vibration, pressure)
- Metadata (facility_id, line_id, timestamps)

### PostgreSQL (`equipment_status` table)  
- Current equipment status
- Last seen timestamps
- Current readings summary

### S3 Bucket
- Raw sensor data archives
- Path: `sensor-data/YYYY/MM/DD/HH/EQUIPMENT_ID/timestamp.json`

### Kafka Topics
- Sensor data messages to `sensor-data-{tenant-id}` topic
- Alert messages to `alerts-{tenant-id}` topic

## Troubleshooting

### Connection Issues
```bash
# Test database connectivity
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version();"

# Test S3 access  
aws s3 ls s3://$SHARED_S3_BUCKET/

# Check AWS credentials
aws sts get-caller-identity
```

### Common Errors

**"password authentication failed"**
- Verify POSTGRES_PASSWORD and TIMESCALE_PASSWORD are correct
- Check database user permissions

**"connection refused"**  
- Verify database endpoints are correct
- Check security group rules allow your IP
- Ensure databases are running

**"Access Denied" (S3)**
- Verify AWS credentials have S3 permissions
- Check bucket name is correct
- Ensure bucket exists and is accessible

**Kafka connection errors**
- Verify MSK cluster endpoint
- Check security groups for Kafka access
- Ensure Kafka cluster is running

## Reverting to Mock Mode

To go back to mock mode, edit `testRunner.js`:

```javascript
// Change these lines:
process.env.MOCK_SERVICES = 'true';
process.env.SKIP_DB_CONNECTIONS = 'true';
```

## Security Notes

- Never commit database passwords to git
- Use IAM roles instead of access keys when possible  
- Restrict database access to specific IP ranges
- Monitor AWS costs when testing with real resources
- Clean up test data regularly to avoid storage costs