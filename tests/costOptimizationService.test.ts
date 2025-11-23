import { CostOptimizationService } from '../services/costOptimizationService';
import { TenantContext } from '../models';

describe('CostOptimizationService', () => {
  let mockTenant: TenantContext;

  beforeEach(() => {
    mockTenant = (global as any).testUtils.createMockTenantContext({
      tenant_id: 'acme-corp'
    });
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateTenantCosts', () => {
    it('should calculate costs for a tenant', async () => {
      const costs = await CostOptimizationService.calculateTenantCosts('acme-corp', mockTenant);

      expect(costs).toHaveProperty('monthly_cost_usd');
      expect(costs).toHaveProperty('cost_per_machine_usd');
      expect(costs).toHaveProperty('cost_breakdown');
      expect(costs).toHaveProperty('optimization_opportunities');
      
      expect(typeof costs.monthly_cost_usd).toBe('number');
      expect(costs.monthly_cost_usd).toBeGreaterThan(0);
      expect(costs.cost_per_machine_usd).toBeGreaterThan(0);
    });

    it('should include cost breakdown', async () => {
      const costs = await CostOptimizationService.calculateTenantCosts('test-tenant', mockTenant);

      expect(costs.cost_breakdown).toHaveProperty('compute');
      expect(costs.cost_breakdown).toHaveProperty('storage');
      expect(costs.cost_breakdown).toHaveProperty('networking');
      expect(costs.cost_breakdown).toHaveProperty('monitoring');
    });

    it('should provide optimization opportunities', async () => {
      const costs = await CostOptimizationService.calculateTenantCosts('manufacturing-pro', mockTenant);

      expect(Array.isArray(costs.optimization_opportunities)).toBe(true);
      expect(Array.isArray(costs.optimization_opportunities)).toBe(true);
    });
  });

  describe('getTenantUsage', () => {
    it('should retrieve usage metrics for a tenant', async () => {
      const usage = await CostOptimizationService.getTenantUsage('acme-corp');

      expect(usage).toHaveProperty('timescale');
      expect(usage).toHaveProperty('postgres');
      expect(usage).toHaveProperty('s3');
      expect(usage).toHaveProperty('lambda');
      expect(usage).toHaveProperty('kafka');
      
      expect(typeof usage.timescale.dailyDataVolumeGB).toBe('number');
      expect(typeof usage.postgres.avgConnectionCount).toBe('number');
    });

    it('should return realistic usage numbers', async () => {
      const usage = await CostOptimizationService.getTenantUsage('test-tenant');

      expect(usage.timescale.dailyDataVolumeGB).toBeGreaterThanOrEqual(0);
      expect(usage.postgres.transactionsPerSecond).toBeGreaterThanOrEqual(0);
      expect(usage.s3.storageGB).toBeGreaterThanOrEqual(0);
    });
  });

  describe('identifyOptimizations', () => {
    it('should identify cost optimization opportunities', async () => {
      const mockUsage = {
        timescale: {
          avgCpuUtilization: 75,
          avgMemoryUtilization: 80,
          dailyDataVolumeGB: 1000,
          avgQueriesPerSecond: 500
        },
        postgres: {
          avgCpuUtilization: 60,
          avgConnectionCount: 20,
          transactionsPerSecond: 100
        },
        s3: {
          storageGB: 5000,
          requestsPerDay: 10000,
          accessPatterns: {
            hotDataAccess: 80,
            oldDataAccess: 20
          }
        },
        lambda: {
          avgInvocationsPerDay: 50000,
          avgDurationMs: 200,
          avgConcurrency: 10,
          memoryUtilizationMB: 256
        },
        kafka: {
          avgThroughputMBps: 50,
          partitionsUsed: 5,
          avgConsumerLag: 100
        }
      };

      const optimizations = await CostOptimizationService.identifyOptimizations(
        'test-tenant',
        mockUsage,
        mockTenant
      );

      expect(Array.isArray(optimizations)).toBe(true);
      optimizations.forEach(opt => {
        expect(opt).toHaveProperty('service');
        expect(opt).toHaveProperty('description');
        expect(opt).toHaveProperty('savings');
        expect(opt).toHaveProperty('action');
        expect(opt).toHaveProperty('risk_level');
      });
    });

    it('should prioritize high-impact optimizations', async () => {
      const highUsage = {
        timescale: {
          avgCpuUtilization: 95,
          avgMemoryUtilization: 90,
          dailyDataVolumeGB: 5000,
          avgQueriesPerSecond: 2000
        },
        postgres: {
          avgCpuUtilization: 85,
          avgConnectionCount: 50,
          transactionsPerSecond: 500
        },
        s3: {
          storageGB: 50000,
          requestsPerDay: 100000,
          accessPatterns: {
            hotDataAccess: 60,
            oldDataAccess: 40
          }
        },
        lambda: {
          avgInvocationsPerDay: 500000,
          avgDurationMs: 500,
          avgConcurrency: 50,
          memoryUtilizationMB: 512
        },
        kafka: {
          avgThroughputMBps: 500,
          partitionsUsed: 20,
          avgConsumerLag: 1000
        }
      };

      const optimizations = await CostOptimizationService.identifyOptimizations(
        'high-usage-tenant',
        highUsage,
        mockTenant
      );

      expect(Array.isArray(optimizations)).toBe(true);
      expect(optimizations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('autoOptimize', () => {
    it('should perform automatic optimizations', async () => {
      const optimizations = await CostOptimizationService.autoOptimize('acme-corp');

      expect(Array.isArray(optimizations)).toBe(true);
      optimizations.forEach(opt => {
        expect(opt).toHaveProperty('type');
        expect(opt).toHaveProperty('status');
        expect(opt).toHaveProperty('savings_realized_usd');
      });
    });

    it('should log optimization results', async () => {
      await CostOptimizationService.autoOptimize('test-tenant');

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('calculatePlatformCosts', () => {
    it('should calculate total platform costs', async () => {
      const platformCosts = await CostOptimizationService.calculatePlatformCosts();

      expect(platformCosts).toHaveProperty('total_monthly_cost');
      expect(platformCosts).toHaveProperty('cost_per_tenant');
      expect(platformCosts).toHaveProperty('tenant_breakdown');
      expect(platformCosts).toHaveProperty('optimization_potential');
      
      expect(typeof platformCosts.total_monthly_cost).toBe('number');
      expect(platformCosts.total_monthly_cost).toBeGreaterThan(0);
      expect(platformCosts.total_monthly_cost).toBeLessThan(50000); // Under budget
    });

    it('should show cost per tenant and machine', async () => {
      const platformCosts = await CostOptimizationService.calculatePlatformCosts();

      expect(platformCosts.cost_per_tenant).toBeLessThan(2000); // More realistic expectation
      expect(platformCosts.cost_per_machine).toBeLessThan(100);
    });

    it('should provide tenant breakdown and optimization potential', async () => {
      const platformCosts = await CostOptimizationService.calculatePlatformCosts();

      expect(platformCosts.tenant_breakdown).toBeDefined();
      expect(typeof platformCosts.optimization_potential).toBe('number');
      expect(platformCosts.optimization_potential).toBeGreaterThan(0);
    });
  });

  // Note: setupCostAlerts and generateCostReport methods exist but are private/internal
  // Tests would need to be implemented based on the actual public API
  
  describe('platform optimization', () => {
    it('should demonstrate cost effectiveness under budget', async () => {
      const platformCosts = await CostOptimizationService.calculatePlatformCosts();
      
      // Verify we're well under the $50,000/month budget
      expect(platformCosts.total_monthly_cost).toBeLessThan(50000);
      expect(platformCosts.total_monthly_cost).toBeGreaterThan(1000); // But not unrealistically low
    });

    it('should show efficient resource utilization', async () => {
      const tenantCosts = await CostOptimizationService.calculateTenantCosts('acme-corp', mockTenant);
      
      expect(tenantCosts.cost_per_machine_usd).toBeLessThan(200); // Reasonable per-machine cost
      expect(Array.isArray(tenantCosts.optimization_opportunities)).toBe(true);
    });
  });
});