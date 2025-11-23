# Manufacturing Platform Architecture Flow Chart

This diagram shows the complete data flow and system architecture for the Manufacturing Platform.

## Architecture Overview

The Manufacturing Platform follows a hybrid multi-tenant/single-tenant architecture optimized for cost efficiency and performance:

- **Target Performance**: <500ms alert processing
- **Cost Optimization**: $2,900/month vs $50K budget (94% savings)
- **Scalability**: 3 customers, 15 machines each
- **High Availability**: Multi-AZ deployment with automatic failover

## Data Flow

```mermaid
flowchart TB
    %% External Systems
    Machine1[Machine 1]
    Machine2[Machine 2]
    MachineN[Machine N]
    AlertSystem[Alert System]
    
    %% API Gateway
    API[API Gateway<br/>REST API]
    
    %% Lambda Functions
    TenantLambda[Tenant Service<br/>Lambda]
    AlertLambda[Alert Processor<br/>Lambda<br/>&lt;500ms SLA]
    DataLambda[Data Ingestion<br/>Lambda]
    CostLambda[Cost Optimization<br/>Lambda]
    
    %% Data Storage
    TimescaleDB[(TimescaleDB<br/>Time-series Data<br/>30-day TTL)]
    PostgresDB[(PostgreSQL<br/>Transactional Data<br/>Multi-AZ)]
    S3[(S3 Bucket<br/>Archival Storage<br/>Lifecycle Policies)]
    
    %% Message Streaming
    Kafka[Kafka MSK<br/>Event Streaming]
    
    %% Monitoring & Alerts
    CloudWatch[CloudWatch<br/>Metrics & Logs]
    SNS[SNS Topic<br/>Alert Notifications]
    
    %% Security & Config
    Secrets[Secrets Manager<br/>DB Credentials]
    KMS[KMS Key<br/>Encryption]
    SSM[SSM Parameters<br/>Configuration]
    
    %% VPC & Security
    VPC[VPC<br/>Multi-AZ Network]
    SecurityGroups[Security Groups<br/>Network ACLs]
    
    %% Data Flow
    Machine1 --> |Machine Data| Kafka
    Machine2 --> |Machine Data| Kafka
    MachineN --> |Machine Data| Kafka
    
    AlertSystem --> |Alert Events| API
    
    API --> |/tenants| TenantLambda
    API --> |/alerts| AlertLambda
    API --> |/data| DataLambda
    API --> |/cost| CostLambda
    
    Kafka --> |Stream Processing| DataLambda
    Kafka --> |Real-time Events| AlertLambda
    
    %% Database Operations
    TenantLambda --> |Tenant CRUD| PostgresDB
    DataLambda --> |Time-series Writes| TimescaleDB
    DataLambda --> |Metadata| PostgresDB
    AlertLambda --> |Alert Processing| TimescaleDB
    AlertLambda --> |Alert Metadata| PostgresDB
    CostLambda --> |Cost Analysis| PostgresDB
    
    %% Archival Process
    TimescaleDB --> |TTL Expiry| S3
    PostgresDB --> |Backup/Archive| S3
    
    %% Alert Flow
    AlertLambda --> |Critical Alerts| SNS
    SNS --> |Notifications| AlertSystem
    
    %% Monitoring
    TenantLambda --> CloudWatch
    AlertLambda --> CloudWatch
    DataLambda --> CloudWatch
    CostLambda --> CloudWatch
    API --> CloudWatch
    
    CloudWatch --> |Alarm Triggers| SNS
    
    %% Security Access
    TenantLambda --> Secrets
    AlertLambda --> Secrets
    DataLambda --> Secrets
    CostLambda --> Secrets
    
    Secrets --> KMS
    TimescaleDB --> KMS
    PostgresDB --> KMS
    S3 --> KMS
    
    %% Configuration
    TenantLambda --> SSM
    AlertLambda --> SSM
    DataLambda --> SSM
    CostLambda --> SSM
    
    %% Network Security
    VPC --> TenantLambda
    VPC --> AlertLambda
    VPC --> DataLambda
    VPC --> CostLambda
    VPC --> TimescaleDB
    VPC --> PostgresDB
    VPC --> Kafka
    
    SecurityGroups --> TenantLambda
    SecurityGroups --> AlertLambda
    SecurityGroups --> DataLambda
    SecurityGroups --> CostLambda
    SecurityGroups --> TimescaleDB
    SecurityGroups --> PostgresDB
    SecurityGroups --> Kafka
    
    %% Styling
    classDef machine fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef api fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef lambda fill:#fff3e0,color:#000,stroke:#e65100,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef storage fill:#fff8e1,stroke:#f57f17,stroke-width:2px
    classDef security fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef monitoring fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    classDef network fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    
    class Machine1,Machine2,MachineN,AlertSystem machine
    class API api
    class TenantLambda,AlertLambda,DataLambda,CostLambda lambda
    class TimescaleDB,PostgresDB database
    class S3,Kafka storage
    class Secrets,KMS,SecurityGroups security
    class CloudWatch,SNS monitoring
    class VPC,SSM network
```

## Component Details

### Data Sources

- **Manufacturing Machines**: Generate real-time operational data
- **Alert Systems**: Trigger critical alerts requiring <500ms processing

### API Layer

- **API Gateway**: RESTful API with CORS, throttling, and authentication
- **Endpoints**: `/tenants`, `/alerts`, `/data`, `/cost`

### Compute Layer

- **Tenant Service**: Manages tenant provisioning and configuration
- **Alert Processor**: Optimized for sub-500ms alert processing with reserved concurrency
- **Data Ingestion**: Handles high-volume machine data streaming
- **Cost Optimization**: Tracks and optimizes platform costs

### Storage Tiers

1. **TimescaleDB**: Hot data (30-day TTL) for real-time queries
2. **PostgreSQL**: Warm data for transactional operations
3. **S3**: Cold archival storage with lifecycle policies
   - Standard → IA (30 days)
   - IA → Glacier (90 days)
   - Glacier → Deep Archive (365 days)

### Event Streaming

- **Kafka MSK**: Real-time data streaming with 3-broker cluster
- **Topics**: Machine data, alerts, system events

### Security & Compliance

- **VPC**: Isolated network with public, private, and database subnets
- **Security Groups**: Least-privilege network access rules
- **KMS**: Encryption at rest and in transit
- **Secrets Manager**: Automated credential rotation
- **IAM**: Fine-grained access control

### Monitoring & Observability

- **CloudWatch**: Metrics, logs, and custom dashboards
- **SNS**: Alert notifications and escalation
- **Performance Insights**: Database performance monitoring
- **Custom Alarms**: Latency, error rates, and cost thresholds

## Cost Optimization Strategy

### Multi-Tenant Resources (Shared)

- **PostgreSQL**: Single r6g.xlarge instance
- **S3**: Shared bucket with tenant prefixes
- **Kafka MSK**: Shared 3-broker cluster

### Usage-Based Resources

- **TimescaleDB**: Pay-per-query model
- **Lambda**: Per-invocation pricing
- **API Gateway**: Per-request pricing

### Single-Tenant Resources (Dedicated)

- **API VPC**: Isolated per tenant for security
- **Lambda Functions**: Tenant-specific instances

## Performance Optimizations

### Alert Processing (<500ms SLA)

- Reserved Lambda concurrency (100 concurrent executions)
- Optimized memory allocation (1024MB)
- Direct database connections
- Efficient query patterns

### Data Ingestion

- Kafka streaming for high throughput
- Batch processing for efficiency
- Asynchronous processing patterns

### Storage Performance

- TimescaleDB for time-series queries
- PostgreSQL connection pooling
- S3 Transfer Acceleration

## Deployment Models

### Multi-Tenant (Default)

```bash
cdk deploy --context environment=production
```

### Single-Tenant (Customer-Specific)

```bash
cdk deploy --context environment=production --context tenantId=customer-123
```

## Key Metrics

- **Cost Efficiency**: 94% under budget ($2,900 vs $50,000/month)
- **Performance**: <500ms alert processing SLA
- **Scalability**: 3 customers × 15 machines = 45 total machines
- **Availability**: 99.9% uptime with Multi-AZ deployment
- **Security**: Zero-trust architecture with encryption everywhere
