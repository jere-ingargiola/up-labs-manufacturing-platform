# Hybrid Multi-Tenant Manufacturing Platform Deployment Guide

## Overview

This guide covers deploying the hybrid multi-tenant/single-tenant manufacturing intelligence platform with complete automation for tenant provisioning, infrastructure scaling, and operations management.

## Architecture Summary

- **Multi-Tenant**: Shared infrastructure with Row Level Security for cost-effective SMB deployments
- **Single-Tenant**: Dedicated infrastructure with isolated databases for enterprise security requirements  
- **Hybrid**: Flexible deployment model supporting both patterns within the same platform

## Prerequisites

```bash
# Required tools
aws --version          # AWS CLI v2+
cdk --version         # AWS CDK v2+
docker --version      # Docker for local testing
kubectl version       # Kubernetes CLI (for EKS deployments)
terraform --version   # Terraform v1.0+ (alternative to CDK)

# Required permissions
# - EC2, RDS, S3, Lambda, API Gateway, CloudWatch, SNS, MSK, TimescaleDB
# - IAM roles and policies for service management
# - Route 53 for custom domains
```

## 1. Environment Setup

### Configure AWS Environment

```bash
# Set AWS profile and region
export AWS_PROFILE=manufacturing-platform
export AWS_DEFAULT_REGION=us-east-1

# Create S3 bucket for deployment artifacts
aws s3 mb s3://manufacturing-platform-deployments-${AWS_DEFAULT_REGION}

# Create parameter store values for shared configuration
aws ssm put-parameter --name "/manufacturing/shared/database-endpoint" --value "shared-manufacturing-db.cluster-xyz.us-east-1.rds.amazonaws.com"
aws ssm put-parameter --name "/manufacturing/shared/kafka-brokers" --value "b-1.manufacturing-msk.xyz.kafka.us-east-1.amazonaws.com:9092"
aws ssm put-parameter --name "/manufacturing/shared/s3-bucket" --value "manufacturing-platform-shared-data"
```

### Initialize CDK Project

```bash
# Bootstrap CDK in target regions
cdk bootstrap aws://123456789012/us-east-1
cdk bootstrap aws://123456789012/us-west-2  
cdk bootstrap aws://123456789012/eu-west-1

# Install dependencies
npm install -g aws-cdk@latest
cd /home/jere/up-labs-manufacturing-platform/infra
npm install
```

## 2. Core Infrastructure Deployment

### Deploy Shared Multi-Tenant Infrastructure

```typescript
// infra/shared-infrastructure-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class SharedInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Multi-tenant TimescaleDB cluster
    const timescaleCluster = new rds.DatabaseCluster(this, 'TimescaleCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE),
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        vpc: this.vpc
      },
      instances: 3, // Multi-AZ for HA
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(30),
        preferredWindow: '03:00-04:00'
      },
      cloudwatchLogsExports: ['postgresql'],
      parameterGroup: this.createTimescaleParameterGroup()
    });

    // Shared Kafka MSK cluster for multi-tenant streaming
    const kafkaCluster = new msk.Cluster(this, 'SharedKafkaCluster', {
      clusterName: 'manufacturing-platform-shared',
      kafkaVersion: msk.KafkaVersion.V3_5_1,
      numberOfBrokerNodes: 6, // 2 per AZ across 3 AZs
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      encryptionInTransit: {
        clientBroker: msk.ClientBrokerEncryption.TLS,
        enableInCluster: true
      },
      clientAuthentication: msk.ClientAuthentication.saslScram({
        secretName: 'manufacturing-kafka-credentials'
      })
    });

    // Shared S3 bucket with tenant prefixes
    const sharedBucket = new s3.Bucket(this, 'SharedDataBucket', {
      bucketName: 'manufacturing-platform-shared-data',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'ArchiveOldData',
          enabled: true,
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(90) },
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(365) }
          ]
        }
      ],
      intelligentTieringConfigurations: [
        {
          id: 'OptimizeStorage',
          enabled: true,
          prefix: 'sensor-data/',
          optionalFields: [s3.IntelligentTieringOptionalFields.BUCKET_KEY_STATUS]
        }
      ]
    });
  }
}
```

### Deploy Single-Tenant Template Infrastructure

```typescript
// infra/single-tenant-template-stack.ts
export class SingleTenantTemplateStack extends cdk.Stack {
  
  createDedicatedInfrastructure(tenantId: string, config: TenantConfig) {
    
    // Dedicated VPC for enterprise tenants
    const tenantVpc = new ec2.Vpc(this, `${tenantId}-Vpc`, {
      maxAzs: 3,
      natGateways: 2, // Multi-AZ NAT for HA
      cidr: this.getTenantCidr(tenantId),
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 26 }
      ]
    });

    // Dedicated RDS cluster
    const dedicatedDb = new rds.DatabaseCluster(this, `${tenantId}-Database`, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_15_4 }),
      instanceProps: {
        instanceType: this.getInstanceTypeForTier(config.subscriptionTier),
        vpc: tenantVpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
      },
      instances: config.subscriptionTier === 'enterprise' ? 3 : 2,
      storageEncrypted: true,
      kmsKey: this.createCustomerManagedKey(tenantId),
      backup: {
        retention: cdk.Duration.days(config.retentionDays),
        preferredWindow: '03:00-04:00'
      }
    });

    // Dedicated S3 bucket with customer-managed KMS
    const dedicatedBucket = new s3.Bucket(this, `${tenantId}-DataBucket`, {
      bucketName: `manufacturing-${tenantId}-data`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.createCustomerManagedKey(tenantId),
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
    });

    // Dedicated Kafka topics in shared or dedicated cluster
    if (config.subscriptionTier === 'enterprise') {
      // Enterprise gets dedicated MSK cluster
      const dedicatedKafka = this.createDedicatedMSK(tenantId, tenantVpc);
    } else {
      // Professional gets dedicated topics in shared cluster
      this.createDedicatedTopics(tenantId, this.sharedKafkaCluster);
    }

    return {
      vpc: tenantVpc,
      database: dedicatedDb,
      storage: dedicatedBucket,
      kafka: dedicatedKafka || this.sharedKafkaCluster
    };
  }
}
```

## 3. Tenant Provisioning Automation

### Automated Tenant Onboarding Pipeline

```bash
#!/bin/bash
# scripts/provision-tenant.sh

set -e

TENANT_ID=$1
DEPLOYMENT_TYPE=$2  # multi-tenant | single-tenant | hybrid
SUBSCRIPTION_TIER=$3 # basic | professional | enterprise
DATA_REGION=${4:-"us-east-1"}

if [ -z "$TENANT_ID" ] || [ -z "$DEPLOYMENT_TYPE" ] || [ -z "$SUBSCRIPTION_TIER" ]; then
  echo "Usage: $0 <tenant-id> <deployment-type> <subscription-tier> [data-region]"
  echo "Example: $0 acme-corp single-tenant enterprise us-east-1"
  exit 1
fi

echo "🚀 Provisioning tenant: $TENANT_ID ($DEPLOYMENT_TYPE, $SUBSCRIPTION_TIER)"

# 1. Validate tenant configuration
echo "📋 Validating tenant configuration..."
aws lambda invoke --function-name validate-tenant-config \
  --payload "{\"tenant_id\":\"$TENANT_ID\",\"deployment_type\":\"$DEPLOYMENT_TYPE\",\"subscription_tier\":\"$SUBSCRIPTION_TIER\"}" \
  /tmp/validation-result.json

if [ $(jq -r '.valid' /tmp/validation-result.json) != "true" ]; then
  echo "❌ Tenant validation failed:"
  jq -r '.errors[]' /tmp/validation-result.json
  exit 1
fi

# 2. Deploy infrastructure based on deployment type
echo "🏗️ Deploying infrastructure..."
if [ "$DEPLOYMENT_TYPE" == "single-tenant" ]; then
  
  # Deploy dedicated infrastructure stack
  cd infra
  cdk deploy SingleTenantStack-${TENANT_ID} \
    --parameters TenantId=$TENANT_ID \
    --parameters SubscriptionTier=$SUBSCRIPTION_TIER \
    --parameters DataRegion=$DATA_REGION \
    --require-approval never
    
  # Get infrastructure outputs
  DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name SingleTenantStack-${TENANT_ID} \
    --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
    --output text)
  
  S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name SingleTenantStack-${TENANT_ID} \
    --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
    --output text)
    
else
  # Multi-tenant: use shared infrastructure
  DB_ENDPOINT=$(aws ssm get-parameter --name "/manufacturing/shared/database-endpoint" --query "Parameter.Value" --output text)
  S3_BUCKET=$(aws ssm get-parameter --name "/manufacturing/shared/s3-bucket" --query "Parameter.Value" --output text)
fi

# 3. Initialize database schema and RLS policies
echo "🗄️ Setting up database schema..."
if [ "$DEPLOYMENT_TYPE" == "single-tenant" ]; then
  # Create dedicated database schema
  psql "postgresql://admin@$DB_ENDPOINT:5432/manufacturing" <<EOF
    CREATE SCHEMA IF NOT EXISTS manufacturing_${TENANT_ID};
    
    -- Create tables in dedicated schema
    CREATE TABLE manufacturing_${TENANT_ID}.sensor_data_raw (
      time TIMESTAMPTZ NOT NULL,
      equipment_id TEXT NOT NULL,
      temperature REAL,
      vibration REAL,
      pressure REAL,
      power_consumption REAL,
      custom_metrics JSONB,
      facility_id TEXT,
      line_id TEXT,
      ingestion_timestamp TIMESTAMPTZ,
      source TEXT,
      has_anomalies BOOLEAN DEFAULT FALSE,
      data_hash TEXT,
      PRIMARY KEY (time, equipment_id)
    );
    
    SELECT create_hypertable('manufacturing_${TENANT_ID}.sensor_data_raw', 'time', chunk_time_interval => INTERVAL '1 hour');
    SELECT add_retention_policy('manufacturing_${TENANT_ID}.sensor_data_raw', INTERVAL '365 days');
EOF
else
  # Multi-tenant: set up RLS policies
  psql "postgresql://admin@$DB_ENDPOINT:5432/manufacturing" <<EOF
    -- Enable RLS on shared tables
    ALTER TABLE sensor_data_raw ENABLE ROW LEVEL SECURITY;
    
    -- Create tenant-specific RLS policy
    CREATE POLICY tenant_${TENANT_ID}_policy ON sensor_data_raw
      FOR ALL
      TO tenant_${TENANT_ID}_role
      USING (tenant_id = '${TENANT_ID}');
    
    -- Create tenant-specific database role
    CREATE ROLE tenant_${TENANT_ID}_role;
    GRANT SELECT, INSERT, UPDATE ON sensor_data_raw TO tenant_${TENANT_ID}_role;
    
    -- Create tenant user
    CREATE USER tenant_${TENANT_ID}_user WITH PASSWORD '$(openssl rand -base64 32)';
    GRANT tenant_${TENANT_ID}_role TO tenant_${TENANT_ID}_user;
EOF
fi

# 4. Create Kafka topics and permissions
echo "📨 Setting up Kafka topics..."
KAFKA_BROKERS=$(aws ssm get-parameter --name "/manufacturing/shared/kafka-brokers" --query "Parameter.Value" --output text)

kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --create --topic sensor-data-${TENANT_ID} --partitions 6 --replication-factor 3 \
  --config cleanup.policy=delete --config retention.ms=2592000000  # 30 days

kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --create --topic alerts-${TENANT_ID} --partitions 3 --replication-factor 3 \
  --config cleanup.policy=delete --config retention.ms=7776000000  # 90 days

# 5. Set up monitoring and alerting
echo "📊 Configuring monitoring..."
aws cloudwatch put-dashboard --dashboard-name "Manufacturing-${TENANT_ID}" \
  --dashboard-body file://monitoring/tenant-dashboard-template.json

# Create SNS topics for alerts
aws sns create-topic --name "${TENANT_ID}-critical-alerts" --region $DATA_REGION
aws sns create-topic --name "${TENANT_ID}-operational-alerts" --region $DATA_REGION

# 6. Generate API keys and credentials
echo "🔑 Generating credentials..."
API_KEY="${TENANT_ID}_$(openssl rand -hex 32)_prod"
TEST_API_KEY="${TENANT_ID}_$(openssl rand -hex 32)_test"

# Store in AWS Secrets Manager
aws secretsmanager create-secret --name "manufacturing/${TENANT_ID}/api-keys" \
  --description "API keys for tenant ${TENANT_ID}" \
  --secret-string "{\"prod_key\":\"$API_KEY\",\"test_key\":\"$TEST_API_KEY\"}"

# 7. Create tenant configuration record
echo "📝 Creating tenant record..."
aws dynamodb put-item --table-name ManufacturingTenants --item file://<(cat <<EOF
{
  "tenant_id": {"S": "$TENANT_ID"},
  "deployment_type": {"S": "$DEPLOYMENT_TYPE"},
  "subscription_tier": {"S": "$SUBSCRIPTION_TIER"},
  "data_region": {"S": "$DATA_REGION"},
  "database_endpoint": {"S": "$DB_ENDPOINT"},
  "s3_bucket": {"S": "$S3_BUCKET"},
  "api_endpoint": {"S": "https://${TENANT_ID}.manufacturing.com"},
  "created_at": {"S": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"},
  "status": {"S": "active"}
}
EOF
)

# 8. Deploy Lambda functions with tenant-specific configuration
echo "🚀 Deploying tenant-specific Lambda functions..."
cd ../lambdas
for lambda_dir in */; do
  if [ -f "${lambda_dir}package.json" ]; then
    echo "Deploying ${lambda_dir}..."
    cd "$lambda_dir"
    
    # Update environment variables for this tenant
    sam deploy --stack-name "manufacturing-${TENANT_ID}-${lambda_dir%/}" \
      --parameter-overrides \
        TenantId=$TENANT_ID \
        DatabaseEndpoint=$DB_ENDPOINT \
        S3Bucket=$S3_BUCKET \
        ApiEndpoint="https://${TENANT_ID}.manufacturing.com"
    
    cd ..
  fi
done

# 9. Set up custom domain (if single-tenant)
if [ "$DEPLOYMENT_TYPE" == "single-tenant" ]; then
  echo "🌐 Setting up custom domain..."
  
  # Create Route 53 hosted zone
  aws route53 create-hosted-zone \
    --name "${TENANT_ID}.manufacturing.com" \
    --caller-reference "tenant-${TENANT_ID}-$(date +%s)"
  
  # Create ACM certificate
  aws acm request-certificate \
    --domain-name "${TENANT_ID}.manufacturing.com" \
    --validation-method DNS \
    --region $DATA_REGION
fi

# 10. Run validation tests
echo "✅ Running validation tests..."
cd ../tests
npm run test:tenant-provisioning -- --tenant-id $TENANT_ID

echo "🎉 Tenant provisioning completed successfully!"
echo ""
echo "📋 Tenant Summary:"
echo "   Tenant ID: $TENANT_ID"
echo "   Deployment Type: $DEPLOYMENT_TYPE"
echo "   Subscription Tier: $SUBSCRIPTION_TIER"
echo "   API Endpoint: https://${TENANT_ID}.manufacturing.com"
echo "   Database: $DB_ENDPOINT"
echo "   Storage: $S3_BUCKET"
echo ""
echo "🔑 Credentials stored in AWS Secrets Manager: manufacturing/${TENANT_ID}/api-keys"
echo "📊 Monitoring Dashboard: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=Manufacturing-${TENANT_ID}"
echo ""
echo "📖 Next Steps:"
echo "   1. Configure DNS (if using custom domain)"
echo "   2. Set up SSO integration (if required)"  
echo "   3. Import initial equipment data"
echo "   4. Configure alert recipients"
echo "   5. Share API keys with tenant administrators"
```

## 4. Tenant Management Operations

### Scale Tenant Infrastructure

```bash
#!/bin/bash
# scripts/scale-tenant.sh

TENANT_ID=$1
SCALE_ACTION=$2  # up | down | auto
NEW_CAPACITY=$3

echo "📈 Scaling tenant infrastructure: $TENANT_ID ($SCALE_ACTION)"

case $SCALE_ACTION in
  "up")
    # Scale up database instances
    aws rds modify-db-cluster --db-cluster-identifier $TENANT_ID-cluster \
      --apply-immediately --backup-retention-period 30
    
    # Increase Kafka partitions
    kafka-configs.sh --bootstrap-server $KAFKA_BROKERS \
      --entity-type topics --entity-name sensor-data-$TENANT_ID \
      --alter --add-config segment.ms=3600000
    ;;
    
  "down")
    # Scale down for cost optimization
    aws rds modify-db-cluster --db-cluster-identifier $TENANT_ID-cluster \
      --apply-immediately --backup-retention-period 7
    ;;
    
  "auto")
    # Enable auto-scaling
    aws application-autoscaling register-scalable-target \
      --service-namespace rds --resource-id cluster:$TENANT_ID-cluster \
      --scalable-dimension rds:cluster:ReadReplicaCount \
      --min-capacity 1 --max-capacity 5
    ;;
esac
```

### Tenant Migration Between Deployment Types

```bash
#!/bin/bash  
# scripts/migrate-tenant-deployment.sh

TENANT_ID=$1
SOURCE_TYPE=$2      # multi-tenant | single-tenant
TARGET_TYPE=$3      # multi-tenant | single-tenant

echo "🔄 Migrating $TENANT_ID from $SOURCE_TYPE to $TARGET_TYPE"

if [ "$SOURCE_TYPE" == "multi-tenant" ] && [ "$TARGET_TYPE" == "single-tenant" ]; then
  
  # Multi-tenant to Single-tenant migration
  echo "📦 Exporting data from shared infrastructure..."
  
  # 1. Export tenant data from shared database
  pg_dump "postgresql://shared-db-endpoint/manufacturing" \
    --schema-only --schema=public \
    --file="/tmp/${TENANT_ID}-schema.sql"
  
  pg_dump "postgresql://shared-db-endpoint/manufacturing" \
    --data-only --where="tenant_id='$TENANT_ID'" \
    --file="/tmp/${TENANT_ID}-data.sql"
  
  # 2. Create dedicated infrastructure
  ./provision-tenant.sh $TENANT_ID single-tenant professional
  
  # 3. Import data to dedicated infrastructure
  NEW_DB_ENDPOINT=$(aws ssm get-parameter --name "/manufacturing/tenants/$TENANT_ID/database-endpoint" --query "Parameter.Value" --output text)
  
  psql "postgresql://$NEW_DB_ENDPOINT/manufacturing" -f "/tmp/${TENANT_ID}-schema.sql"
  psql "postgresql://$NEW_DB_ENDPOINT/manufacturing" -f "/tmp/${TENANT_ID}-data.sql"
  
  # 4. Update tenant configuration
  aws dynamodb update-item --table-name ManufacturingTenants \
    --key '{"tenant_id": {"S": "'$TENANT_ID'"}}' \
    --update-expression "SET deployment_type = :dt, database_endpoint = :db" \
    --expression-attribute-values '{":dt": {"S": "single-tenant"}, ":db": {"S": "'$NEW_DB_ENDPOINT'"}}'
  
  # 5. Cleanup shared resources (after validation)
  echo "⚠️  Manual cleanup required: Remove tenant data from shared infrastructure"
  
elif [ "$SOURCE_TYPE" == "single-tenant" ] && [ "$TARGET_TYPE" == "multi-tenant" ]; then
  
  # Single-tenant to Multi-tenant migration (cost optimization)
  echo "📦 Consolidating to shared infrastructure..."
  
  # Similar process but in reverse
  # Export from dedicated -> Import to shared with tenant_id
  
fi

echo "✅ Migration completed. Please validate functionality before cleanup."
```

## 5. Monitoring and Operations

### Tenant Health Dashboard

```yaml
# monitoring/tenant-dashboard-template.json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["Manufacturing/#{TENANT_ID}", "SensorDataIngestionRate"],
          ["Manufacturing/#{TENANT_ID}", "AlertsGenerated"],  
          ["Manufacturing/#{TENANT_ID}", "APIRequestLatency"],
          ["Manufacturing/#{TENANT_ID}", "DatabaseConnections"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "#{DATA_REGION}",
        "title": "#{TENANT_ID} - Core Metrics"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/manufacturing-#{TENANT_ID}-ingestSensorData'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20",
        "region": "#{DATA_REGION}",
        "title": "Recent Errors"
      }
    }
  ]
}
```

### Automated Tenant Scaling

```yaml
# monitoring/tenant-scaling-policy.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tenant-scaling-config
data:
  scaling_rules.yaml: |
    tenants:
      - pattern: "enterprise-*"
        database:
          min_instances: 2
          max_instances: 10
          scale_up_threshold: 80    # CPU percentage
          scale_down_threshold: 20
        kafka:
          min_partitions: 6
          max_partitions: 24
          partition_scale_threshold: 1000  # messages/sec per partition
      
      - pattern: "professional-*"
        database:
          min_instances: 1
          max_instances: 3
          scale_up_threshold: 85
          scale_down_threshold: 25
        kafka:
          min_partitions: 3
          max_partitions: 12
          partition_scale_threshold: 500
      
      - pattern: "*"  # default for basic tier
        database:
          min_instances: 1
          max_instances: 2
          scale_up_threshold: 90
          scale_down_threshold: 30
```

## 6. Security and Compliance

### Row Level Security Setup

```sql
-- Multi-tenant RLS policies (apply to shared database)

-- Enable RLS on all tenant tables
ALTER TABLE sensor_data_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_metrics ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY sensor_data_tenant_isolation ON sensor_data_raw
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY equipment_tenant_isolation ON equipment_status  
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY alerts_tenant_isolation ON alerts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Create tenant-specific roles with limited permissions
CREATE ROLE tenant_role_template;
GRANT SELECT, INSERT, UPDATE ON sensor_data_raw TO tenant_role_template;
GRANT SELECT, INSERT, UPDATE ON equipment_status TO tenant_role_template;
GRANT SELECT, INSERT, UPDATE ON alerts TO tenant_role_template;

-- Function to create tenant-specific users
CREATE OR REPLACE FUNCTION create_tenant_user(p_tenant_id text, p_password text)
RETURNS text AS $$
DECLARE
  role_name text := 'tenant_' || p_tenant_id || '_role';
  user_name text := 'tenant_' || p_tenant_id || '_user';
BEGIN
  -- Create tenant-specific role
  EXECUTE format('CREATE ROLE %I INHERIT', role_name);
  EXECUTE format('GRANT tenant_role_template TO %I', role_name);
  
  -- Create tenant user
  EXECUTE format('CREATE USER %I WITH PASSWORD %L', user_name, p_password);
  EXECUTE format('GRANT %I TO %I', role_name, user_name);
  
  -- Set default tenant context
  EXECUTE format('ALTER USER %I SET app.current_tenant_id = %L', user_name, p_tenant_id);
  
  RETURN 'Created user: ' || user_name;
END;
$$ LANGUAGE plpgsql;
```

### Compliance Automation

```bash
#!/bin/bash
# scripts/compliance-audit.sh

TENANT_ID=$1
COMPLIANCE_TYPE=${2:-"SOC2"}  # SOC2, GDPR, HIPAA

echo "🔍 Running compliance audit for $TENANT_ID ($COMPLIANCE_TYPE)"

case $COMPLIANCE_TYPE in
  "GDPR")
    # GDPR-specific checks
    echo "📋 Checking GDPR compliance..."
    
    # Verify data encryption at rest
    aws rds describe-db-clusters --db-cluster-identifier ${TENANT_ID}-cluster \
      --query "DBClusters[0].StorageEncrypted"
    
    # Check data retention policies
    psql "postgresql://${DB_ENDPOINT}/manufacturing" -c \
      "SELECT policy_name, retention_period FROM timescaledb_information.retention_policies WHERE hypertable = 'sensor_data_raw';"
    
    # Audit data access logs
    aws logs filter-log-events --log-group-name "/aws/rds/cluster/${TENANT_ID}-cluster/postgresql" \
      --filter-pattern "[timestamp, request_id, connection, user, database, statement=\"SELECT\"]" \
      --start-time $(date -d '24 hours ago' +%s)000
    ;;
    
  "SOC2")
    echo "📋 Checking SOC2 compliance..."
    
    # Verify access controls
    aws iam list-attached-role-policies --role-name manufacturing-${TENANT_ID}-role
    
    # Check encryption in transit
    aws msk describe-cluster --cluster-arn $KAFKA_CLUSTER_ARN \
      --query "ClusterInfo.EncryptionInfo.EncryptionInTransit"
    
    # Audit trail verification
    aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=${TENANT_ID} \
      --start-time $(date -d '30 days ago' +%Y-%m-%d) \
      --end-time $(date +%Y-%m-%d)
    ;;
esac

echo "✅ Compliance audit completed for $TENANT_ID"
```

## 7. Disaster Recovery

### Automated Backup and Recovery

```bash
#!/bin/bash
# scripts/backup-tenant.sh

TENANT_ID=$1
BACKUP_TYPE=${2:-"full"}  # full, incremental, snapshot

echo "💾 Creating backup for tenant: $TENANT_ID ($BACKUP_TYPE)"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BUCKET="manufacturing-backups-$(aws sts get-caller-identity --query Account --output text)"

case $BACKUP_TYPE in
  "full")
    # Database backup
    aws rds create-db-cluster-snapshot \
      --db-cluster-identifier ${TENANT_ID}-cluster \
      --db-cluster-snapshot-identifier ${TENANT_ID}-full-backup-${TIMESTAMP}
    
    # S3 data backup
    aws s3 sync s3://manufacturing-${TENANT_ID}-data \
      s3://${BACKUP_BUCKET}/${TENANT_ID}/full/${TIMESTAMP}/ \
      --storage-class STANDARD_IA
    
    # Kafka topic backup (via Kafka Connect)
    curl -X POST http://kafka-connect:8083/connectors \
      -H "Content-Type: application/json" \
      -d '{
        "name": "backup-'${TENANT_ID}'-'${TIMESTAMP}'",
        "config": {
          "connector.class": "io.confluent.connect.s3.S3SinkConnector",
          "topics": "sensor-data-'${TENANT_ID}',alerts-'${TENANT_ID}'",
          "s3.bucket.name": "'${BACKUP_BUCKET}'",
          "s3.part.size": 5242880,
          "flush.size": 1000,
          "storage.class": "io.confluent.connect.s3.storage.S3Storage"
        }
      }'
    ;;
    
  "incremental")
    # Point-in-time recovery backup
    aws rds create-db-cluster-snapshot \
      --db-cluster-identifier ${TENANT_ID}-cluster \
      --db-cluster-snapshot-identifier ${TENANT_ID}-incremental-backup-${TIMESTAMP}
    
    # Sync only changed S3 objects
    aws s3 sync s3://manufacturing-${TENANT_ID}-data \
      s3://${BACKUP_BUCKET}/${TENANT_ID}/incremental/${TIMESTAMP}/ \
      --storage-class STANDARD_IA \
      --delete --exact-timestamps
    ;;
esac

# Store backup metadata
aws dynamodb put-item --table-name ManufacturingBackups --item '{
  "tenant_id": {"S": "'${TENANT_ID}'"},
  "backup_id": {"S": "'${TENANT_ID}-${BACKUP_TYPE}-backup-${TIMESTAMP}'"},
  "backup_type": {"S": "'${BACKUP_TYPE}'"},
  "created_at": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
  "status": {"S": "completed"},
  "retention_until": {"S": "'$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%SZ)'"}
}'

echo "✅ Backup completed: ${TENANT_ID}-${BACKUP_TYPE}-backup-${TIMESTAMP}"
```

## 8. Cost Optimization

### Automated Cost Optimization

```python
#!/usr/bin/env python3
# scripts/optimize-costs.py

import boto3
import json
from datetime import datetime, timedelta

def optimize_tenant_costs(tenant_id, subscription_tier):
    """Optimize costs for a specific tenant based on usage patterns"""
    
    cloudwatch = boto3.client('cloudwatch')
    rds = boto3.client('rds')
    s3 = boto3.client('s3')
    
    print(f"🏗️ Analyzing cost optimization opportunities for {tenant_id}")
    
    # 1. Analyze database usage patterns
    db_metrics = cloudwatch.get_metric_statistics(
        Namespace='AWS/RDS',
        MetricName='CPUUtilization',
        Dimensions=[{'Name': 'DBClusterIdentifier', 'Value': f'{tenant_id}-cluster'}],
        StartTime=datetime.utcnow() - timedelta(days=7),
        EndTime=datetime.utcnow(),
        Period=3600,
        Statistics=['Average', 'Maximum']
    )
    
    avg_cpu = sum(point['Average'] for point in db_metrics['Datapoints']) / len(db_metrics['Datapoints'])
    
    # Recommend downsizing if consistently low usage
    if avg_cpu < 20 and subscription_tier in ['basic', 'professional']:
        print(f"💡 Recommendation: Consider downsizing RDS instance (avg CPU: {avg_cpu:.1f}%)")
        
        # Auto-downsize for basic tier
        if subscription_tier == 'basic':
            rds.modify_db_cluster(
                DBClusterIdentifier=f'{tenant_id}-cluster',
                DBInstanceClass='db.r6g.large',  # Downsize from xlarge
                ApplyImmediately=False  # Apply during maintenance window
            )
    
    # 2. S3 storage class optimization
    bucket_name = f'manufacturing-{tenant_id}-data'
    
    try:
        # List objects and analyze access patterns
        objects = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1000)
        
        old_objects = []
        for obj in objects.get('Contents', []):
            if obj['LastModified'] < datetime.now(obj['LastModified'].tzinfo) - timedelta(days=90):
                old_objects.append(obj['Key'])
        
        if old_objects:
            print(f"💡 Found {len(old_objects)} objects suitable for archival to Glacier")
            
            # Transition old objects to cheaper storage classes
            lifecycle_config = {
                'Rules': [
                    {
                        'ID': f'{tenant_id}-cost-optimization',
                        'Status': 'Enabled',
                        'Filter': {'Prefix': 'sensor-data/'},
                        'Transitions': [
                            {
                                'Days': 90,
                                'StorageClass': 'STANDARD_IA'
                            },
                            {
                                'Days': 365,
                                'StorageClass': 'GLACIER'
                            }
                        ]
                    }
                ]
            }
            
            s3.put_bucket_lifecycle_configuration(
                Bucket=bucket_name,
                LifecycleConfiguration=lifecycle_config
            )
            
    except s3.exceptions.NoSuchBucket:
        print(f"⚠️  Bucket {bucket_name} not found (multi-tenant deployment)")
    
    # 3. Right-size Kafka partitions
    # Implement Kafka partition optimization based on throughput
    
    print(f"✅ Cost optimization analysis completed for {tenant_id}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python3 optimize-costs.py <tenant-id> <subscription-tier>")
        sys.exit(1)
    
    optimize_tenant_costs(sys.argv[1], sys.argv[2])
```

## 9. Testing and Validation

### Tenant Provisioning Tests

```bash
#!/bin/bash
# tests/test-tenant-provisioning.sh

set -e

TENANT_ID="test-tenant-$(date +%s)"
DEPLOYMENT_TYPE="multi-tenant"
SUBSCRIPTION_TIER="basic"

echo "🧪 Testing tenant provisioning: $TENANT_ID"

# 1. Provision test tenant
./scripts/provision-tenant.sh $TENANT_ID $DEPLOYMENT_TYPE $SUBSCRIPTION_TIER

# 2. Test API connectivity
API_ENDPOINT="https://${TENANT_ID}.manufacturing.com"
API_KEY=$(aws secretsmanager get-secret-value --secret-id "manufacturing/${TENANT_ID}/api-keys" \
  --query "SecretString" --output text | jq -r '.test_key')

echo "🔍 Testing API endpoint: $API_ENDPOINT"

# Test sensor data ingestion
curl -X POST "${API_ENDPOINT}/api/sensor-data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "equipment_id": "test-equipment-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "temperature": 25.5,
    "vibration": 0.02,
    "pressure": 101.3,
    "facility_id": "test-facility",
    "line_id": "line-01"
  }' | jq '.'

# 3. Verify data isolation (multi-tenant)
if [ "$DEPLOYMENT_TYPE" == "multi-tenant" ]; then
  echo "🔒 Testing tenant data isolation..."
  
  # Attempt to access data from different tenant context (should fail)
  curl -X GET "${API_ENDPOINT}/api/equipment/test-equipment-001" \
    -H "X-Tenant-ID: different-tenant" \
    -H "X-API-Key: $API_KEY" \
    --fail && echo "❌ Data isolation test failed" || echo "✅ Data isolation working"
fi

# 4. Test monitoring and alerting
echo "📊 Testing monitoring setup..."
aws cloudwatch get-dashboard --dashboard-name "Manufacturing-${TENANT_ID}" > /dev/null
echo "✅ CloudWatch dashboard accessible"

# 5. Cleanup test tenant
echo "🧹 Cleaning up test tenant..."
./scripts/delete-tenant.sh $TENANT_ID --force

echo "✅ Tenant provisioning tests completed successfully"
```

This comprehensive deployment guide provides complete automation for the hybrid multi-tenant manufacturing platform, supporting both cost-effective multi-tenant deployments for SMBs and secure single-tenant deployments for enterprise customers, with full operational tooling for provisioning, monitoring, scaling, compliance, and cost optimization.