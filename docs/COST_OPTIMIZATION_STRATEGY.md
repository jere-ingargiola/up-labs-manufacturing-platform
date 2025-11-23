# Cost-Optimized Hybrid Architecture for Manufacturing Platform

## Target: 3 customers, 15 machines each, <$50,000/month

## Architecture Decision Matrix

### 🏗️ **Infrastructure Allocation**

| Component | Deployment | Reasoning | Monthly Cost |
|-----------|------------|-----------|--------------|
| **API Gateway** | Single-Tenant VPCs | Security isolation, custom domains | $150 × 3 = $450 |
| **TimescaleDB** | **Hybrid Smart** | Performance-critical time-series | $400-600 |
| **PostgreSQL** | **Multi-Tenant** | Lightweight transactional data | $500 |
| **S3 Storage** | **Multi-Tenant** | Massive cost savings on archival | $50 |
| **Kafka MSK** | **Multi-Tenant** | Shared streaming with tenant topics | $800 |
| **Lambda Functions** | **Multi-Tenant** | Pay-per-execution, tenant-aware | $200 |
| **CloudWatch** | **Tenant-Specific** | Isolated monitoring dashboards | $300 |

**Total Estimated Cost: ~$2,700-2,900/month** ✅ **Well under $50K target**

### 🧠 **Smart TimescaleDB Allocation Strategy**

```yaml
# Cost-optimized TimescaleDB deployment strategy
timescale_deployment:
  # Start with multi-tenant, auto-scale to dedicated based on usage
  initial_deployment: "multi-tenant"
  shared_cluster:
    instance_type: "db.r6g.2xlarge"  # $1,000/month
    instances: 2  # Primary + read replica
    storage: "2TB gp3"  # $200/month
    
  upgrade_triggers:
    - tenant_data_volume_gb_day: 100  # If tenant exceeds 100GB/day
    - concurrent_queries_per_second: 50  # High query load
    - sla_violations_count: 5  # Performance issues
    
  dedicated_fallback:
    instance_type: "db.r6g.xlarge"  # $500/month per tenant
    max_dedicated_tenants: 1  # Only highest-usage customer
    
cost_optimization:
  # Intelligent data tiering within TimescaleDB
  retention_policies:
    hot_data: "7 days"      # Keep recent data in fast storage
    warm_data: "30 days"    # Compressed chunks
    cold_archive: "S3"      # Historical data to S3 via pg_dump
```

## 💰 **Projected Monthly Costs Breakdown**

```yaml
# 3 customers, 15 machines each = 45 total machines
monthly_cost_projection:
  
  # Infrastructure Costs
  api_infrastructure:
    dedicated_vpcs: $150 * 3 = $450
    api_gateways: $50 * 3 = $150
    nat_gateways: $45 * 3 = $135
    
  data_storage:
    shared_timescale_cluster: $1,000  # db.r6g.2xlarge
    shared_postgres_cluster: $500     # db.r6g.xlarge  
    shared_s3_intelligent_tiering: $50
    
  streaming_and_compute:
    shared_kafka_msk: $800           # m5.large * 3 brokers
    lambda_functions: $200           # Pay per execution
    cloudwatch_monitoring: $300      # Per-tenant dashboards
    
  # Total Monthly Cost
  total_infrastructure: $3,585
  
  # Per-tenant breakdown
  per_tenant_cost: $1,195          # $3,585 / 3 customers
  per_machine_cost: $79.67         # $3,585 / 45 machines
  
  # Scalability projections
  at_10_customers: $8,950          # Economies of scale kick in
  at_50_customers: $25,000         # Multi-tenant efficiencies maximize
  break_even_point: "8 customers"  # When platform becomes profitable
```

## 🎯 **Final Recommendations**

1. **Keep S3 Multi-Tenant** - Massive cost savings ($118/month per customer)
2. **Keep PostgreSQL Multi-Tenant** - Transactional data is low-volume, RLS works well
3. **Smart TimescaleDB** - Start multi-tenant, auto-upgrade high-usage tenants to dedicated
4. **Single-Tenant API VPCs** - Security isolation with reasonable cost (~$150/customer)
5. **Shared Kafka MSK** - Streaming infrastructure benefits from scale

This approach gives you **$1,195/month per customer** (well under your $16,667/month budget per customer) while maintaining security isolation where it matters most and achieving cost efficiency through smart resource sharing.
