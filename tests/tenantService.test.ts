import { TenantResolver, withTenantContext, TenantConfigService, TenantMetricsService } from '../services/tenantService';
import { APIGatewayProxyEvent, TenantContext } from '../models';

describe('TenantResolver', () => {
  let tenantResolver: TenantResolver;

  beforeEach(() => {
    tenantResolver = new TenantResolver();
  });

  describe('resolveTenant', () => {
    it('should resolve tenant from X-Tenant-ID header', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'X-Tenant-ID': 'acme-corp' }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('acme-corp');
      expect(tenant.tenant_name).toBe('ACME Corporation');
      expect(tenant.deployment_type).toBe('single-tenant');
    });

    it('should resolve tenant from lowercase header', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'x-tenant-id': 'shared-tenant' }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('shared-tenant');
      expect(tenant.deployment_type).toBe('multi-tenant');
    });

    it('should resolve tenant from JWT token', async () => {
      const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
        Buffer.from(JSON.stringify({ tenant_id: 'acme-corp' })).toString('base64') + 
        '.signature';

      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'Authorization': `Bearer ${mockJWT}` }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('acme-corp');
    });

    it('should resolve tenant from subdomain', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'Host': 'acme-corp.manufacturing.com' }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('acme-corp');
    });

    it('should resolve tenant from query parameter', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: {}, // Clear headers
        queryStringParameters: { tenant_id: 'acme-corp' }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('acme-corp');
    });

    it('should resolve tenant from API key', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'X-API-Key': 'acme-corp_uuid_randomstring' }
      });

      const tenant = await tenantResolver.resolveTenant(event);
      expect(tenant.tenant_id).toBe('acme-corp');
    });

    it('should handle missing headers gracefully', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: undefined
      });

      await expect(tenantResolver.resolveTenant(event)).rejects.toThrow('Tenant ID not found in request');
    });

    it('should throw error for unknown tenant', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'X-Tenant-ID': 'unknown-tenant' }
      });

      await expect(tenantResolver.resolveTenant(event)).rejects.toThrow('Tenant not found: unknown-tenant');
    });

    it('should cache tenant configuration', async () => {
      const event = (global as any).testUtils.createMockAPIGatewayEvent({
        headers: { 'X-Tenant-ID': 'acme-corp' }
      });

      // First call
      const tenant1 = await tenantResolver.resolveTenant(event);
      // Second call should use cache
      const tenant2 = await tenantResolver.resolveTenant(event);

      expect(tenant1).toEqual(tenant2);
      expect(tenant1.tenant_id).toBe('acme-corp');
    });
  });
});

describe('withTenantContext', () => {
  it('should provide tenant context to handler', async () => {
    const event = (global as any).testUtils.createMockAPIGatewayEvent({
      headers: { 'X-Tenant-ID': 'acme-corp' }
    });

    const mockHandler = jest.fn().mockResolvedValue('success');

    const result = await withTenantContext(event, mockHandler);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'acme-corp' }),
      event
    );
    expect(result).toBe('success');
    expect(process.env.CURRENT_TENANT_ID).toBe('acme-corp');
    expect(process.env.CURRENT_DEPLOYMENT_TYPE).toBe('single-tenant');
  });

  it('should handle handler errors gracefully', async () => {
    const event = (global as any).testUtils.createMockAPIGatewayEvent({
      headers: { 'X-Tenant-ID': 'acme-corp' }
    });

    const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

    await expect(withTenantContext(event, mockHandler)).rejects.toThrow('Handler error');
  });
});

describe('TenantConfigService', () => {
  let mockTenant: TenantContext;

  beforeEach(() => {
    mockTenant = (global as any).testUtils.createMockTenantContext();
  });

  describe('getConnectionConfig', () => {
    it('should return dedicated connection for single-tenant', () => {
      const singleTenantConfig = {
        ...mockTenant,
        deployment_type: 'single-tenant' as const,
        config: {
          ...mockTenant.config,
          database: {
            connection_string: 'postgresql://manufacturingplatform-developme-postgresdb113281d2-tsgocyznjzyn.cnqweieki09q.us-east-1.rds.amazonaws.com:5432/manufacturing',
            use_rls: false,
            max_connections: 100
          }
        }
      };

      const config = TenantConfigService.getConnectionConfig(singleTenantConfig);

      expect(config.connectionString).toBe('postgresql://manufacturingplatform-development-postgresdb113281d2-tsgocyznjzyn.cnqweieki09q.us-east-1.rds.amazonaws.com:5432/manufacturing');
      expect(config.maxConnections).toBe(100);
      expect(config.ssl).toBe(true);
      expect(config.options).toBeUndefined();
    });

    it('should return shared connection with RLS for multi-tenant', () => {
      const config = TenantConfigService.getConnectionConfig(mockTenant);

      expect(config.connectionString).toBe(process.env.SHARED_DB_CONNECTION_STRING);
      expect(config.maxConnections).toBe(10);
      expect(config.ssl).toBe(true);
      expect(config.options).toBe('-c app.current_tenant_id=test-tenant');
    });
  });

  describe('getStorageConfig', () => {
    it('should return dedicated storage for single-tenant', () => {
      const singleTenantConfig = {
        ...mockTenant,
        deployment_type: 'single-tenant' as const,
        config: {
          ...mockTenant.config,
          storage: {
            s3_bucket: 'acme-manufacturing-data',
            encryption_key: 'arn:aws:kms:us-east-1:123456789012:key/acme-key',
            retention_policy: 'unlimited'
          }
        }
      };

      const config = TenantConfigService.getStorageConfig(singleTenantConfig);

      expect(config.bucket).toBe('acme-manufacturing-data');
      expect(config.kmsKey).toBe('arn:aws:kms:us-east-1:123456789012:key/acme-key');
      expect(config.prefix).toBe('');
    });

    it('should return shared storage with prefix for multi-tenant', () => {
      const config = TenantConfigService.getStorageConfig(mockTenant);

      expect(config.bucket).toBe(process.env.SHARED_S3_BUCKET);
      expect(config.prefix).toBe('tenants/test-tenant/');
      expect(config.kmsKey).toBe(process.env.SHARED_KMS_KEY);
    });
  });

  describe('getKafkaConfig', () => {
    it('should return tenant-specific Kafka configuration', () => {
      const config = TenantConfigService.getKafkaConfig(mockTenant);

      expect(config.topics.sensorData).toBe('sensor-data-test-tenant');
      expect(config.topics.alerts).toBe('alerts-test-tenant');
      expect(config.topics.shared).toBe('manufacturing-shared');
      expect(config.partitions).toBe(3);
      expect(config.replicationFactor).toBe(2);
    });

    it('should return enterprise configuration for enterprise tenant', () => {
      const enterpriseTenant = {
        ...mockTenant,
        subscription_tier: 'enterprise' as const,
        deployment_type: 'single-tenant' as const
      };

      const config = TenantConfigService.getKafkaConfig(enterpriseTenant);

      expect(config.partitions).toBe(10);
      expect(config.replicationFactor).toBe(3);
      expect(config.topics.shared).toBeUndefined();
    });
  });

  describe('getAlertConfig', () => {
    it('should return alert configuration', () => {
      const config = TenantConfigService.getAlertConfig(mockTenant);

      expect(config.snsTopics).toEqual(['arn:aws:sns:us-east-1:123456789012:test-alerts']);
      expect(config.webhookUrls).toEqual([]);
      expect(config.escalationRules).toHaveLength(1);
      expect(config.cloudWatchNamespace).toBe('Manufacturing/test-tenant');
    });
  });
});

describe('TenantMetricsService', () => {
  let mockTenant: TenantContext;

  beforeEach(() => {
    mockTenant = (global as any).testUtils.createMockTenantContext();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trackUsage', () => {
    it('should track usage metrics', async () => {
      await TenantMetricsService.trackUsage(mockTenant, 'api-request', 1);

      expect(console.log).toHaveBeenCalledWith(
        'Tenant usage:',
        expect.stringContaining('"tenantId":"test-tenant"')
      );
    });

    it('should include subscription and deployment type in metrics', async () => {
      await TenantMetricsService.trackUsage(mockTenant, 'equipment-added', 5);

      expect(console.log).toHaveBeenCalledWith(
        'Tenant usage:',
        expect.stringContaining('"subscriptionTier":"professional"')
      );
      expect(console.log).toHaveBeenCalledWith(
        'Tenant usage:',
        expect.stringContaining('"deploymentType":"multi-tenant"')
      );
    });
  });

  describe('checkLimits', () => {
    it('should allow usage within limits', async () => {
      const result = await TenantMetricsService.checkLimits(mockTenant, 'equipment-count', 50);

      expect(result).toBe(true);
    });

    it('should deny usage exceeding limits', async () => {
      const result = await TenantMetricsService.checkLimits(mockTenant, 'equipment-count', 150);

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('exceeded limit for equipment-count: 150/100')
      );
    });

    it('should check API rate limits', async () => {
      const result = await TenantMetricsService.checkLimits(mockTenant, 'api-requests-per-hour', 1500);

      expect(result).toBe(false);
    });

    it('should check concurrent user limits', async () => {
      const result = await TenantMetricsService.checkLimits(mockTenant, 'concurrent-users', 15);

      expect(result).toBe(false);
    });

    it('should allow unknown operations', async () => {
      const result = await TenantMetricsService.checkLimits(mockTenant, 'unknown-operation', 999);

      expect(result).toBe(true);
    });
  });
});