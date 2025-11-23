// Cost Optimization and Usage Tracking Interfaces

export interface CostMetrics {
  monthly_cost_usd: number;
  cost_per_machine_usd: number;
  cost_breakdown: {
    compute: number;
    storage: number;
    networking: number;
    monitoring: number;
  };
  optimization_opportunities: CostOptimization[];
}

export interface CostOptimization {
  service: string;
  current_cost: number;
  optimized_cost: number;
  savings: number;
  action: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  auto_apply: boolean;
}

export interface UsageMetrics {
  timescale: {
    avgCpuUtilization: number;
    avgMemoryUtilization: number;
    dailyDataVolumeGB: number;
    avgQueriesPerSecond: number;
  };
  postgres: {
    avgCpuUtilization: number;
    avgConnectionCount: number;
    transactionsPerSecond: number;
  };
  s3: {
    storageGB: number;
    requestsPerDay: number;
    accessPatterns: {
      hotDataAccess: number;
      oldDataAccess: number;
    };
  };
  lambda: {
    avgInvocationsPerDay: number;
    avgDurationMs: number;
    avgConcurrency: number;
    memoryUtilizationMB: number;
  };
  kafka: {
    avgThroughputMBps: number;
    partitionsUsed: number;
    avgConsumerLag: number;
  };
}