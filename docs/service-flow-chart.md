# Service Flow Chart

This diagram shows the interactions between the TypeScript services in our Manufacturing Platform.

## Service Architecture

```mermaid
graph TD
    %% External Inputs
    API[API Gateway]
    Machines[Manufacturing Machines]
    
    %% Core Services
    TenantService[tenantService.ts<br/>Tenant Management]
    StorageService[storageService.ts<br/>Multi-Tier Storage]
    CostService[costOptimizationService.ts<br/>Cost Tracking]
    ProvisioningService[tenantProvisioningService.ts<br/>Automated Onboarding]
    
    %% Data Models
    TenantModel[models/Tenant.ts<br/>Tenant Config & Types]
    DatabaseModel[models/Database.ts<br/>DB Connections & Queries]
    AlertModel[models/Alerts.ts<br/>Alert Processing]
    CostModel[models/Cost.ts<br/>Cost Optimization]
    ApiModel[models/ApiGateway.ts<br/>API Types]
    
    %% Lambda Handlers
    TenantLambda[lambdas/tenantService/index.ts<br/>Tenant API Handler]
    AlertLambda[lambdas/alertProcessor/index.ts<br/>Alert Handler &lt;500ms]
    DataLambda[lambdas/dataIngestion/index.ts<br/>Data Ingestion Handler]
    CostLambda[lambdas/costOptimization/index.ts<br/>Cost Analysis Handler]
    
    %% Storage Systems
    TimescaleDB[(TimescaleDB<br/>30-day TTL)]
    PostgresDB[(PostgreSQL<br/>Transactional)]
    S3Bucket[(S3 Archival<br/>Lifecycle Rules)]
    
    %% API Flows
    API --> TenantLambda
    API --> AlertLambda
    API --> DataLambda
    API --> CostLambda
    
    %% Lambda to Service Connections
    TenantLambda --> TenantService
    AlertLambda --> StorageService
    DataLambda --> StorageService
    CostLambda --> CostService
    
    %% Service Dependencies
    TenantService --> ProvisioningService
    TenantService --> CostService
    StorageService --> CostService
    
    %% Model Usage
    TenantService --> TenantModel
    TenantService --> DatabaseModel
    StorageService --> DatabaseModel
    StorageService --> AlertModel
    CostService --> CostModel
    TenantLambda --> ApiModel
    AlertLambda --> ApiModel
    DataLambda --> ApiModel
    CostLambda --> ApiModel
    
    %% Data Flow
    Machines --> DataLambda
    StorageService --> TimescaleDB
    StorageService --> PostgresDB
    StorageService --> S3Bucket
    
    %% Service to Storage
    TenantService --> PostgresDB
    CostService --> PostgresDB
    
    %% Alert Processing Flow
    AlertLambda --> AlertModel
    AlertModel --> StorageService
    
    %% Tenant Provisioning Flow
    ProvisioningService --> TenantModel
    ProvisioningService --> DatabaseModel
    
    %% Styling
    classDef service fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef model fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef lambda fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef storage fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef api fill:#ffebee,stroke:#c62828,stroke-width:2px
    
    class TenantService,StorageService,CostService,ProvisioningService service
    class TenantModel,DatabaseModel,AlertModel,CostModel,ApiModel model
    class TenantLambda,AlertLambda,DataLambda,CostLambda lambda
    class TimescaleDB,PostgresDB,S3Bucket storage
    class API,Machines api
```

## Service Interactions

### 1. Tenant Management Flow

```text
API → TenantLambda → TenantService → ProvisioningService → PostgresDB
```

### 2. Alert Processing Flow (<500ms SLA)

```text
API → AlertLambda → StorageService → TimescaleDB/PostgresDB
```

### 3. Data Ingestion Flow

```text
Machines → DataLambda → StorageService → TimescaleDB → (TTL) → S3Bucket
```

### 4. Cost Optimization Flow

```text
API → CostLambda → CostService → PostgresDB
```

## Key Features

### Cost Optimization (94% Under Budget)

- **Target**: $50,000/month for 3 customers, 15 machines each
- **Actual**: $2,900/month
- **Hybrid Architecture**: Multi-tenant shared resources + single-tenant API isolation

### Performance Optimization

- **Alert SLA**: <500ms processing time
- **Reserved Concurrency**: 100 Lambda executions for alert processing
- **Storage Tiers**: Hot (TimescaleDB) → Warm (PostgreSQL) → Cold (S3)

### Architecture Benefits

- **Centralized Models**: All interfaces in `models/` folder eliminate code duplication
- **Service Separation**: Clear boundaries between tenant, storage, cost, and provisioning logic
- **Type Safety**: Comprehensive TypeScript interfaces across all services
- **Test Coverage**: 87.56% coverage with 53 passing tests

## Development Workflow

1. **Models First**: Define interfaces in `models/` folder
2. **Service Implementation**: Business logic in `services/` folder  
3. **Lambda Handlers**: API endpoints in `lambdas/` folder
4. **Testing**: Comprehensive Jest test suite
5. **Deployment**: AWS CDK infrastructure as code

## File Structure

```text
├── models/
│   ├── Tenant.ts          # Tenant configuration types
│   ├── Database.ts        # Database connection interfaces
│   ├── Alerts.ts          # Alert processing types
│   ├── Cost.ts            # Cost optimization interfaces
│   └── ApiGateway.ts      # API Gateway types
├── services/
│   ├── tenantService.ts           # Tenant management (94.73% coverage)
│   ├── storageService.ts          # Multi-tier storage (83.78% coverage) 
│   ├── costOptimizationService.ts # Cost tracking (86.3% coverage)
│   └── tenantProvisioningService.ts # Auto-provisioning (83.92% coverage)
├── lambdas/
│   ├── tenantService/index.ts     # Tenant API handler
│   ├── alertProcessor/index.ts    # Alert processing handler
│   ├── dataIngestion/index.ts     # Data ingestion handler
│   └── costOptimization/index.ts  # Cost optimization handler
└── cdk/
    └── lib/manufacturing-platform-stack.ts # AWS infrastructure
```
