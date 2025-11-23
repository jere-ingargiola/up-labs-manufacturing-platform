// Cost Optimization Service for Manufacturing Platform
// Target: 3 customers, 15 machines each, <$50,000/month total ($16,667 per customer)

import { 
  TenantContext,
  CostMetrics, CostOptimization, UsageMetrics
} from '../models';

export class CostOptimizationService {
  
  // Calculate current monthly costs for a tenant
  static async calculateTenantCosts(tenantId: string, tenantContext: TenantContext): Promise<CostMetrics> {
    const usage = await this.getTenantUsage(tenantId);
    
    // Base cost calculation for multi-tenant shared resources
    const baseCosts = {
      // Shared infrastructure costs (allocated per tenant)
      shared_timescale: 1000 / 3,        // $1000 shared among 3 customers = $333
      shared_postgres: 500 / 3,          // $500 shared among 3 customers = $167  
      shared_s3: 50 / 3,                 // $50 shared among 3 customers = $17
      shared_kafka: 800 / 3,             // $800 shared among 3 customers = $267
      
      // Dedicated costs per tenant
      dedicated_vpc: 150,                 // $150 per customer for dedicated API VPC
      api_gateway: 50,                   // $50 per customer for API Gateway
      lambda_functions: 200 / 3,         // $200 shared compute = $67
      cloudwatch_monitoring: 100,        // $100 per customer for isolated dashboards
    };
    
    // Calculate actual costs based on deployment type
    let computeCost = baseCosts.shared_timescale + baseCosts.shared_postgres + baseCosts.lambda_functions;
    let storageCost = baseCosts.shared_s3;
    let networkingCost = baseCosts.dedicated_vpc + baseCosts.api_gateway + baseCosts.shared_kafka;
    let monitoringCost = baseCosts.cloudwatch_monitoring;
    
    // Adjust for dedicated resources if high usage
    if (this.shouldUseDedicatedTimescale(usage)) {
      computeCost = computeCost - baseCosts.shared_timescale + 500; // Dedicated TimescaleDB
    }
    
    // Calculate optimizations
    const optimizations = await this.identifyOptimizations(tenantId, usage, tenantContext);
    
    const totalCost = computeCost + storageCost + networkingCost + monitoringCost;
    
    return {
      monthly_cost_usd: totalCost,
      cost_per_machine_usd: totalCost / 15, // 15 machines per customer
      cost_breakdown: {
        compute: computeCost,
        storage: storageCost,
        networking: networkingCost,
        monitoring: monitoringCost
      },
      optimization_opportunities: optimizations
    };
  }
  
  // Get comprehensive tenant usage metrics
  static async getTenantUsage(tenantId: string): Promise<UsageMetrics> {
    // In production, this would query CloudWatch, RDS Performance Insights, etc.
    // Mock data based on typical manufacturing platform usage
    
    const mockUsagePatterns: Record<string, UsageMetrics> = {
      'acme-corp': {
        timescale: {
          avgCpuUtilization: 75,
          avgMemoryUtilization: 68,
          dailyDataVolumeGB: 120,
          avgQueriesPerSecond: 65
        },
        postgres: {
          avgCpuUtilization: 45,
          avgConnectionCount: 25,
          transactionsPerSecond: 150
        },
        s3: {
          storageGB: 2500,
          requestsPerDay: 50000,
          accessPatterns: {
            hotDataAccess: 0.8,
            oldDataAccess: 0.2
          }
        },
        lambda: {
          avgInvocationsPerDay: 100000,
          avgDurationMs: 250,
          avgConcurrency: 15,
          memoryUtilizationMB: 180
        },
        kafka: {
          avgThroughputMBps: 25,
          partitionsUsed: 8,
          avgConsumerLag: 500
        }
      },
      'manufacturing-pro': {
        timescale: {
          avgCpuUtilization: 45,
          avgMemoryUtilization: 42,
          dailyDataVolumeGB: 65,
          avgQueriesPerSecond: 35
        },
        postgres: {
          avgCpuUtilization: 25,
          avgConnectionCount: 15,
          transactionsPerSecond: 80
        },
        s3: {
          storageGB: 1200,
          requestsPerDay: 25000,
          accessPatterns: {
            hotDataAccess: 0.7,
            oldDataAccess: 0.3
          }
        },
        lambda: {
          avgInvocationsPerDay: 50000,
          avgDurationMs: 200,
          avgConcurrency: 8,
          memoryUtilizationMB: 128
        },
        kafka: {
          avgThroughputMBps: 12,
          partitionsUsed: 4,
          avgConsumerLag: 200
        }
      },
      'basic-manufacturing': {
        timescale: {
          avgCpuUtilization: 25,
          avgMemoryUtilization: 28,
          dailyDataVolumeGB: 35,
          avgQueriesPerSecond: 15
        },
        postgres: {
          avgCpuUtilization: 15,
          avgConnectionCount: 8,
          transactionsPerSecond: 40
        },
        s3: {
          storageGB: 600,
          requestsPerDay: 12000,
          accessPatterns: {
            hotDataAccess: 0.6,
            oldDataAccess: 0.4
          }
        },
        lambda: {
          avgInvocationsPerDay: 25000,
          avgDurationMs: 180,
          avgConcurrency: 4,
          memoryUtilizationMB: 64
        },
        kafka: {
          avgThroughputMBps: 6,
          partitionsUsed: 2,
          avgConsumerLag: 100
        }
      }
    };
    
    return mockUsagePatterns[tenantId] || mockUsagePatterns['basic-manufacturing'];
  }
  
  // Identify cost optimization opportunities
  static async identifyOptimizations(
    tenantId: string, 
    usage: UsageMetrics, 
    tenantContext: TenantContext
  ): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];
    
    // TimescaleDB optimization
    if (usage.timescale.avgCpuUtilization < 30) {
      optimizations.push({
        service: 'TimescaleDB',
        current_cost: 333,  // Shared cost
        optimized_cost: 250, // Smaller shared instance
        savings: 83,
        action: 'downsize_shared_instance',
        description: 'Low CPU utilization across all tenants, downsize shared TimescaleDB cluster',
        risk_level: 'medium',
        auto_apply: false
      });
    }
    
    // Lambda memory optimization
    if (usage.lambda.memoryUtilizationMB < 128) {
      const currentCost = 67;
      const optimizedCost = currentCost * 0.7; // 30% reduction
      optimizations.push({
        service: 'Lambda Functions',
        current_cost: currentCost,
        optimized_cost: optimizedCost,
        savings: currentCost - optimizedCost,
        action: 'reduce_memory_allocation',
        description: 'Reduce Lambda memory allocation from 256MB to 128MB',
        risk_level: 'low',
        auto_apply: true
      });
    }
    
    // S3 storage class optimization
    if (usage.s3.accessPatterns.oldDataAccess > 0.3) {
      optimizations.push({
        service: 'S3 Storage',
        current_cost: 17,
        optimized_cost: 12,
        savings: 5,
        action: 'aggressive_lifecycle_policy',
        description: 'Move data to Glacier after 60 days instead of 90 days',
        risk_level: 'low',
        auto_apply: true
      });
    }
    
    // Kafka partition optimization
    if (usage.kafka.partitionsUsed < 4 && tenantContext.subscription_tier === 'basic') {
      optimizations.push({
        service: 'Kafka MSK',
        current_cost: 267,
        optimized_cost: 200,
        savings: 67,
        action: 'reduce_broker_count',
        description: 'Use smaller MSK cluster for low-throughput tenants',
        risk_level: 'medium',
        auto_apply: false
      });
    }
    
    // PostgreSQL connection optimization
    if (usage.postgres.avgConnectionCount < 10) {
      optimizations.push({
        service: 'PostgreSQL',
        current_cost: 167,
        optimized_cost: 125,
        savings: 42,
        action: 'connection_pooling',
        description: 'Implement aggressive connection pooling for low-usage patterns',
        risk_level: 'low',
        auto_apply: true
      });
    }
    
    return optimizations;
  }
  
  // Auto-apply low-risk optimizations
  static async autoOptimize(tenantId: string): Promise<CostOptimization[]> {
    const tenantContext = await this.getTenantContext(tenantId);
    const usage = await this.getTenantUsage(tenantId);
    const optimizations = await this.identifyOptimizations(tenantId, usage, tenantContext);
    
    const appliedOptimizations: CostOptimization[] = [];
    
    for (const optimization of optimizations) {
      if (optimization.auto_apply && optimization.risk_level === 'low') {
        try {
          await this.applyOptimization(tenantId, optimization);
          appliedOptimizations.push(optimization);
          
          console.log(`Applied optimization for ${tenantId}: ${optimization.action} - saved $${optimization.savings}/month`);
        } catch (error) {
          console.error(`Failed to apply optimization ${optimization.action} for ${tenantId}:`, error);
        }
      }
    }
    
    return appliedOptimizations;
  }
  
  // Apply specific optimization
  private static async applyOptimization(tenantId: string, optimization: CostOptimization): Promise<void> {
    switch (optimization.action) {
      case 'reduce_memory_allocation':
        // Update Lambda function memory allocation
        console.log(`Reducing Lambda memory allocation for ${tenantId}`);
        // AWS Lambda updateFunctionConfiguration call would go here
        break;
        
      case 'aggressive_lifecycle_policy':
        // Update S3 lifecycle policies
        console.log(`Updating S3 lifecycle policy for ${tenantId}`);
        // S3 putBucketLifecycleConfiguration call would go here
        break;
        
      case 'connection_pooling':
        // Implement connection pooling optimizations
        console.log(`Optimizing database connection pooling for ${tenantId}`);
        // RDS proxy configuration would go here
        break;
        
      default:
        console.log(`Unknown optimization action: ${optimization.action}`);
    }
  }
  
  // Calculate platform-wide costs for all tenants
  static async calculatePlatformCosts(): Promise<{
    total_monthly_cost: number;
    cost_per_tenant: number;
    cost_per_machine: number;
    tenant_breakdown: Record<string, number>;
    optimization_potential: number;
  }> {
    
    const tenants = ['acme-corp', 'manufacturing-pro', 'basic-manufacturing'];
    const tenantCosts: Record<string, number> = {};
    let totalCost = 0;
    let totalOptimizationSavings = 0;
    
    for (const tenantId of tenants) {
      const tenantContext = await this.getTenantContext(tenantId);
      const metrics = await this.calculateTenantCosts(tenantId, tenantContext);
      
      tenantCosts[tenantId] = metrics.monthly_cost_usd;
      totalCost += metrics.monthly_cost_usd;
      
      // Calculate total potential savings
      const totalSavings = metrics.optimization_opportunities.reduce(
        (sum, opt) => sum + opt.savings, 0
      );
      totalOptimizationSavings += totalSavings;
    }
    
    return {
      total_monthly_cost: totalCost,
      cost_per_tenant: totalCost / tenants.length,
      cost_per_machine: totalCost / (tenants.length * 15), // 15 machines per tenant
      tenant_breakdown: tenantCosts,
      optimization_potential: totalOptimizationSavings
    };
  }
  
  // Helper methods
  private static shouldUseDedicatedTimescale(usage: UsageMetrics): boolean {
    return usage.timescale.dailyDataVolumeGB > 100 || 
           usage.timescale.avgQueriesPerSecond > 50 ||
           usage.timescale.avgCpuUtilization > 80;
  }
  
  private static async getTenantContext(tenantId: string): Promise<TenantContext> {
    // Mock tenant context - in production, load from database
    const mockContexts: Record<string, TenantContext> = {
      'acme-corp': {
        tenant_id: 'acme-corp',
        tenant_name: 'ACME Corporation',
        deployment_type: 'single-tenant',
        subscription_tier: 'enterprise',
        data_region: 'us-east-1',
        compliance_requirements: ['SOC2', 'ISO27001'],
        max_equipment: 15,
        retention_days: 365,
        created_at: new Date().toISOString(),
        config: {
          database: {
            connection_string: 'postgresql://acme-dedicated.rds.amazonaws.com:5432/manufacturing',
            use_rls: false,
            max_connections: 100
          },
          storage: {
            s3_bucket: 'acme-manufacturing-data',
            encryption_key: 'arn:aws:kms:us-east-1:123456789012:key/acme-key',
            retention_policy: 'unlimited'
          },
          alerts: {
            sns_topics: ['arn:aws:sns:us-east-1:123456789012:acme-critical-alerts'],
            webhook_urls: ['https://acme.com/webhooks/manufacturing-alerts'],
            escalation_rules: [{
              severity: 'critical',
              delay_minutes: 0,
              channels: ['sns', 'webhook', 'pagerduty']
            }]
          },
          features: {
            advanced_analytics: true,
            custom_dashboards: true,
            api_rate_limit: 10000,
            concurrent_users: 100
          }
        }
      },
      'manufacturing-pro': {
        tenant_id: 'manufacturing-pro', 
        tenant_name: 'Manufacturing Pro',
        deployment_type: 'multi-tenant',
        subscription_tier: 'professional',
        data_region: 'us-east-1',
        compliance_requirements: ['SOC2'],
        max_equipment: 500,
        retention_days: 180,
        created_at: new Date().toISOString(),
        config: {
          database: {
            use_rls: true,
            max_connections: 50
          },
          storage: {
            retention_policy: '180-days'
          },
          alerts: {
            sns_topics: ['arn:aws:sns:us-east-1:123456789012:mfgpro-alerts'],
            webhook_urls: [],
            escalation_rules: [{
              severity: 'critical',
              delay_minutes: 5,
              channels: ['sns']
            }]
          },
          features: {
            advanced_analytics: true,
            custom_dashboards: true,
            api_rate_limit: 5000,
            concurrent_users: 25
          }
        }
      },
      'basic-manufacturing': {
        tenant_id: 'basic-manufacturing',
        tenant_name: 'Basic Manufacturing',
        deployment_type: 'multi-tenant', 
        subscription_tier: 'basic',
        data_region: 'us-east-1',
        compliance_requirements: [],
        max_equipment: 100,
        retention_days: 90,
        created_at: new Date().toISOString(),
        config: {
          database: {
            use_rls: true,
            max_connections: 10
          },
          storage: {
            retention_policy: '90-days'
          },
          alerts: {
            sns_topics: ['arn:aws:sns:us-east-1:123456789012:basic-alerts'],
            webhook_urls: [],
            escalation_rules: [{
              severity: 'critical',
              delay_minutes: 15,
              channels: ['sns']
            }]
          },
          features: {
            advanced_analytics: false,
            custom_dashboards: false,
            api_rate_limit: 1000,
            concurrent_users: 5
          }
        }
      }
    };
    
    return mockContexts[tenantId] || mockContexts['basic-manufacturing'];
  }
}

// Cost monitoring and alerting
export class CostMonitoringService {
  
  // Set up cost alerts for budget overruns
  static async setupCostAlerts(tenantId: string, monthlyBudget: number): Promise<void> {
    // Create CloudWatch billing alerts
    console.log(`Setting up cost alerts for ${tenantId} with budget $${monthlyBudget}/month`);
    
    const alertThresholds = [
      { threshold: 0.5, description: '50% of budget used' },
      { threshold: 0.8, description: '80% of budget used - WARNING' },
      { threshold: 0.95, description: '95% of budget used - CRITICAL' },
      { threshold: 1.1, description: 'Budget exceeded by 10% - EMERGENCY' }
    ];
    
    // In production, create CloudWatch alarms for each threshold
    alertThresholds.forEach(alert => {
      console.log(`Alert: ${tenantId} - ${alert.description} at $${monthlyBudget * alert.threshold}`);
    });
  }
  
  // Generate cost optimization report
  static async generateCostReport(): Promise<string> {
    const platformCosts = await CostOptimizationService.calculatePlatformCosts();
    
    const report = `
# Manufacturing Platform Cost Report
Generated: ${new Date().toISOString()}

## Summary
- **Total Monthly Cost**: $${platformCosts.total_monthly_cost.toFixed(2)}
- **Cost Per Tenant**: $${platformCosts.cost_per_tenant.toFixed(2)}
- **Cost Per Machine**: $${platformCosts.cost_per_machine.toFixed(2)}
- **Optimization Potential**: $${platformCosts.optimization_potential.toFixed(2)}/month

## Budget Status
- **Target Budget**: $50,000/month
- **Current Usage**: $${platformCosts.total_monthly_cost.toFixed(2)}/month
- **Budget Utilization**: ${((platformCosts.total_monthly_cost / 50000) * 100).toFixed(1)}%
- **Remaining Budget**: $${(50000 - platformCosts.total_monthly_cost).toFixed(2)}/month

## Tenant Breakdown
${Object.entries(platformCosts.tenant_breakdown)
  .map(([tenant, cost]) => `- **${tenant}**: $${cost.toFixed(2)}/month`)
  .join('\n')}

## Recommendations
${platformCosts.total_monthly_cost > 40000 ? 
  '⚠️ Approaching budget limit - implement aggressive cost optimizations' :
  '✅ Well within budget - continue monitoring and optimizing'
}
`;
    
    return report;
  }
}