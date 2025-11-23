# Hybrid Multi-Tenant/Single-Tenant Architecture

## Overview
This manufacturing platform implements a hybrid tenancy model that supports both multi-tenant SaaS deployments and dedicated single-tenant installations, optimized for different customer segments and compliance requirements.

## 🏗️ **Tenancy Architecture Strategy**

### **Hybrid Model Benefits**
- **Multi-Tenant**: Cost-effective for SMB customers, shared infrastructure
- **Single-Tenant**: Enterprise security/compliance, dedicated resources  
- **Hybrid**: Flexible deployment based on customer requirements and scale

### **Tenancy Decision Matrix**
| Customer Segment | Deployment Model | Rationale |
|------------------|------------------|-----------|
| SMB (< 100 assets) | Multi-Tenant | Cost optimization, shared resources |
| Mid-Market (100-1K assets) | Hybrid Choice | Business requirements driven |
| Enterprise (> 1K assets) | Single-Tenant | Security, compliance, performance |
| Regulated Industries | Single-Tenant | Data sovereignty, audit requirements |

## 🎯 **Implementation Strategy**

### **1. Tenant-Aware Data Model**
```sql
-- All tables include tenant_id for multi-tenant isolation
CREATE TABLE sensor_data_raw (
  time TIMESTAMPTZ NOT NULL,
  tenant_id UUID NOT NULL,           -- Tenant isolation
  equipment_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,         -- Sub-tenant organization
  temperature REAL,
  vibration REAL,
  pressure REAL,
  -- Composite primary key includes tenant_id
  PRIMARY KEY (time, tenant_id, equipment_id)
);

-- Tenant configuration table
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY,
  tenant_name TEXT NOT NULL,
  deployment_type TEXT CHECK (deployment_type IN ('multi-tenant', 'single-tenant', 'hybrid')),
  data_region TEXT NOT NULL,         -- Geographic data residency
  retention_policy_days INTEGER DEFAULT 30,
  max_equipment INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_tier TEXT,            -- basic, professional, enterprise
  compliance_requirements JSONB      -- GDPR, HIPAA, SOC2, etc.
);

-- Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE sensor_data_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sensor_data_raw
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### **2. Tenant-Aware Infrastructure**
```yaml
# Multi-Tenant Shared Infrastructure
shared_resources:
  timescale_cluster:
    - Shared TimescaleDB cluster with RLS
    - Tenant-partitioned hypertables
    - Shared connection pools with tenant context
  
  kafka_topics:
    - sensor-data-{tenant_id}      # Isolated data streams
    - alerts-{tenant_id}           # Tenant-specific alerts
    - manufacturing-shared         # Cross-tenant analytics (opt-in)
  
  s3_structure:
    - s3://manufacturing-data/{tenant_id}/sensor-data/
    - s3://manufacturing-data/{tenant_id}/alerts/
    - s3://manufacturing-shared/analytics/   # Anonymized cross-tenant

# Single-Tenant Dedicated Infrastructure  
dedicated_resources:
  per_tenant_vpc:
    - Dedicated VPC per enterprise tenant
    - Private subnets with NAT gateways
    - Dedicated RDS instances
    
  dedicated_compute:
    - Reserved Lambda concurrency
    - Dedicated ECS clusters for large workloads
    - Private API Gateway endpoints
    
  compliance_features:
    - Customer-managed KMS keys
    - Private S3 buckets with encryption
    - VPC endpoints for all AWS services
```

### **3. Tenant Resolution & Context**
```typescript
// Tenant resolution middleware
interface TenantContext {
  tenant_id: string;
  deployment_type: 'multi-tenant' | 'single-tenant' | 'hybrid';
  data_region: string;
  subscription_tier: string;
  compliance_requirements: string[];
  max_equipment: number;
  retention_days: number;
}

class TenantResolver {
  async resolveTenant(request: APIGatewayProxyEvent): Promise<TenantContext> {
    // Extract tenant from multiple sources
    const tenantId = this.extractTenantId(request);
    
    // Load tenant configuration (cached)
    const tenant = await this.getTenantConfig(tenantId);
    
    // Validate tenant access and limits
    await this.validateTenantAccess(tenant, request);
    
    return tenant;
  }
  
  private extractTenantId(request: APIGatewayProxyEvent): string {
    // Priority order for tenant resolution:
    // 1. Custom header (X-Tenant-ID)
    // 2. JWT token claim
    // 3. Subdomain (tenant.manufacturing.com)
    // 4. Query parameter
    // 5. API key prefix
    
    return request.headers['X-Tenant-ID'] || 
           this.extractFromJWT(request.headers.Authorization) ||
           this.extractFromSubdomain(request.headers.Host) ||
           request.queryStringParameters?.tenant_id ||
           this.extractFromApiKey(request.headers['X-API-Key']);
  }
}
```

## 🔧 **Multi-Tenant Optimizations**

### **Database Connection Management**
```typescript
// Tenant-aware connection pooling
class TenantAwareDataService {
  private connectionPools: Map<string, Pool> = new Map();
  
  async getConnection(tenantContext: TenantContext): Promise<PoolClient> {
    const poolKey = this.getPoolKey(tenantContext);
    
    if (!this.connectionPools.has(poolKey)) {
      const pool = new Pool({
        ...this.getBaseConfig(),
        ...this.getTenantSpecificConfig(tenantContext),
        // Set tenant context for RLS
        options: `-c app.current_tenant_id=${tenantContext.tenant_id}`
      });
      
      this.connectionPools.set(poolKey, pool);
    }
    
    return this.connectionPools.get(poolKey)!.connect();
  }
  
  private getPoolKey(tenant: TenantContext): string {
    // Multi-tenant: shared pool with tenant context
    // Single-tenant: dedicated pool per tenant
    return tenant.deployment_type === 'single-tenant' 
      ? `dedicated-${tenant.tenant_id}`
      : 'shared-multi-tenant';
  }
}
```

### **Tenant-Aware Storage Service**
```typescript
export async function storeSensorDataMultiTenant(
  sensorData: SensorData, 
  tenantContext: TenantContext
): Promise<StorageResult> {
  
  // Add tenant context to all data
  const enrichedData = {
    ...sensorData,
    tenant_id: tenantContext.tenant_id,
    compliance_metadata: this.getComplianceMetadata(tenantContext)
  };
  
  // Choose storage strategy based on deployment type
  if (tenantContext.deployment_type === 'single-tenant') {
    return this.storeSingleTenant(enrichedData, tenantContext);
  } else {
    return this.storeMultiTenant(enrichedData, tenantContext);
  }
}

private async storeMultiTenant(
  data: SensorData, 
  tenant: TenantContext
): Promise<StorageResult> {
  return Promise.all([
    // Shared TimescaleDB with RLS
    this.storeToSharedTimescale(data, tenant),
    // Shared PostgreSQL with tenant partitioning
    this.storeToSharedPostgres(data, tenant),
    // Tenant-partitioned S3 bucket
    this.storeToTenantS3(data, tenant)
  ]);
}

private async storeSingleTenant(
  data: SensorData, 
  tenant: TenantContext
): Promise<StorageResult> {
  return Promise.all([
    // Dedicated TimescaleDB instance
    this.storeToDedicatedTimescale(data, tenant),
    // Dedicated PostgreSQL instance  
    this.storeToDedicatedPostgres(data, tenant),
    // Customer-managed S3 bucket with KMS
    this.storeToCustomerS3(data, tenant)
  ]);
}
```

### **Tenant-Aware Alert Processing**
```typescript
export async function processTenantAlert(
  alert: Alert,
  tenantContext: TenantContext
): Promise<AlertNotificationResult> {
  
  // Tenant-specific alert routing
  const alertConfig = await this.getTenantAlertConfig(tenantContext.tenant_id);
  
  // Multi-channel notification with tenant customization
  const notifications = [
    // Tenant-specific Kafka topics
    this.publishToTenantTopic(`alerts-${tenantContext.tenant_id}`, alert),
    
    // Tenant-scoped CloudWatch metrics
    this.publishTenantCloudWatchMetrics(alert, tenantContext),
    
    // Tenant-configured SNS topics
    this.sendTenantSNSNotification(alert, alertConfig),
    
    // Tenant webhook endpoints (if configured)
    this.callTenantWebhooks(alert, alertConfig)
  ];
  
  return Promise.allSettled(notifications);
}

private async publishTenantCloudWatchMetrics(
  alert: Alert, 
  tenant: TenantContext
): Promise<void> {
  
  const metrics: CloudWatchMetric[] = [{
    MetricName: 'CriticalAlerts',
    Value: 1,
    Unit: 'Count',
    Dimensions: [
      { Name: 'TenantId', Value: tenant.tenant_id },
      { Name: 'EquipmentId', Value: alert.equipment_id },
      { Name: 'SubscriptionTier', Value: tenant.subscription_tier },
      { Name: 'DeploymentType', Value: tenant.deployment_type }
    ],
    Timestamp: new Date(alert.timestamp)
  }];
  
  // Publish to tenant-namespaced metrics
  await this.cloudWatch.putMetricData({
    Namespace: `Manufacturing/${tenant.tenant_id}`,
    MetricData: metrics
  });
}
```

## 🚀 **Deployment Patterns**

### **Multi-Tenant SaaS Deployment**
```yaml
# Shared Infrastructure (Cost Optimized)
shared_services:
  api_gateway:
    - Single API Gateway with tenant routing
    - Rate limiting per tenant
    - Usage tracking and billing
    
  lambda_functions:
    - Shared Lambda functions with tenant context
    - Reserved concurrency for premium tiers
    - Tenant-aware error handling
    
  databases:
    - Shared RDS clusters with RLS
    - Tenant partitioning for performance
    - Cross-tenant analytics (anonymized)
    
  monitoring:
    - Shared CloudWatch with tenant dimensions
    - Tenant-scoped dashboards
    - Aggregated cost allocation
```

### **Single-Tenant Enterprise Deployment**
```yaml
# Dedicated Infrastructure (Security/Compliance Optimized)
dedicated_per_tenant:
  vpc_isolation:
    - Dedicated VPC per enterprise customer
    - Private subnets and security groups
    - Customer-managed networking
    
  compute_isolation:
    - Dedicated ECS clusters or EC2 instances  
    - Reserved Lambda concurrency
    - Customer-specific deployment pipelines
    
  data_isolation:
    - Dedicated RDS instances with encryption
    - Customer-managed KMS keys
    - Private S3 buckets with access logging
    
  compliance_features:
    - Audit logging to customer SIEM
    - Data residency controls
    - Customer-managed backup policies
```

### **Hybrid Deployment Benefits**

#### **Cost Optimization**
```yaml
Multi-Tenant Benefits:
  - Shared infrastructure costs (60-80% cost reduction)
  - Economies of scale for R&D and operations
  - Faster time-to-market for new features
  - Simplified maintenance and updates

Single-Tenant Benefits:  
  - Predictable performance (no noisy neighbors)
  - Enhanced security isolation
  - Compliance with strict regulatory requirements
  - Custom SLAs and dedicated support
```

#### **Feature Differentiation**
```yaml
Tier-Based Features:
  Basic (Multi-Tenant):
    - Standard dashboards and alerts
    - 30-day data retention  
    - Community support
    - Shared resources
    
  Professional (Hybrid Choice):
    - Custom dashboards and reports
    - 90-day data retention
    - Priority support
    - Some dedicated resources
    
  Enterprise (Single-Tenant):
    - Unlimited customization
    - Unlimited data retention
    - Dedicated success manager
    - Fully isolated infrastructure
    - SLA guarantees
```

## 📊 **Tenant Management & Operations**

### **Tenant Onboarding Automation**
```typescript
class TenantProvisioningService {
  async provisionTenant(request: TenantProvisioningRequest): Promise<TenantContext> {
    // 1. Create tenant record and generate tenant_id
    const tenant = await this.createTenantRecord(request);
    
    // 2. Provision infrastructure based on deployment type
    if (request.deployment_type === 'single-tenant') {
      await this.provisionDedicatedInfrastructure(tenant);
    } else {
      await this.configureMulitTenantAccess(tenant);
    }
    
    // 3. Set up tenant-specific configurations
    await Promise.all([
      this.createTenantDatabase(tenant),
      this.configureTenantKafkaTopics(tenant),
      this.setupTenantS3Structure(tenant),
      this.createTenantCloudWatchDashboard(tenant)
    ]);
    
    // 4. Generate API keys and access credentials
    await this.generateTenantCredentials(tenant);
    
    return tenant;
  }
}
```

### **Tenant Monitoring & Analytics**
```yaml
Per-Tenant Metrics:
  usage_metrics:
    - Equipment count and data volume
    - API requests and processing time
    - Storage consumption by tier
    - Alert volume and resolution time
    
  performance_metrics:
    - Query response times
    - Alert processing latency
    - Data ingestion rate
    - System availability
    
  business_metrics:
    - Feature adoption rates
    - User engagement scores  
    - Support ticket volume
    - Revenue attribution
```

## 🔒 **Security & Compliance**

### **Multi-Tenant Security**
- **Data Isolation**: Row-level security (RLS) and tenant partitioning
- **Access Control**: Tenant-scoped JWT tokens and API keys
- **Network Security**: Shared infrastructure with logical isolation
- **Audit Logging**: Tenant-attributed access logs

### **Single-Tenant Security**  
- **Infrastructure Isolation**: Dedicated VPCs and security groups
- **Data Encryption**: Customer-managed KMS keys
- **Network Isolation**: Private endpoints and customer networking
- **Compliance**: GDPR, HIPAA, SOC2, FedRAMP ready

This hybrid architecture provides maximum flexibility to serve customers across different segments while optimizing for both cost efficiency (multi-tenant) and security/compliance requirements (single-tenant).