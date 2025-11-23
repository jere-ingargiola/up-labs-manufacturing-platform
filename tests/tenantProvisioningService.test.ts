import { TenantProvisioningService } from '../services/tenantProvisioningService';
import { TenantContext, TenantProvisioningRequest } from '../models';

describe('TenantProvisioningService', () => {
  let mockTenant: TenantContext;

  beforeEach(() => {
    mockTenant = (global as any).testUtils.createMockTenantContext();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('provisionNewTenant', () => {
    it('should provision a new multi-tenant customer', async () => {
      const tenantRequest: TenantProvisioningRequest = {
        tenant_id: 'test-manufacturing',
        tenant_name: 'Test Manufacturing Co',
        contact_email: 'admin@testmfg.com',
        subscription_tier: 'professional',
        deployment_type: 'multi-tenant',
        data_region: 'us-east-1',
        compliance_requirements: ['SOC2'],
        estimated_equipment_count: 50,
        expected_data_volume_mb_per_day: 1000
      };

      const result = await TenantProvisioningService.provisionNewTenant(tenantRequest);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('tenant_id');
      expect(result).toHaveProperty('provisioning_status');
      expect(result).toHaveProperty('resources_created');
      
      expect(result.success).toBe(true);
      expect(result.tenant_id).toBe('test-manufacturing');
      expect(['pending', 'in-progress', 'completed']).toContain(result.provisioning_status);
    });

    it('should provision a single-tenant enterprise customer', async () => {
      const enterpriseRequest: TenantProvisioningRequest = {
        tenant_id: 'enterprise-corp',
        tenant_name: 'Enterprise Corp',
        contact_email: 'admin@enterprise.com',
        subscription_tier: 'enterprise',
        deployment_type: 'single-tenant',
        data_region: 'us-east-1',
        compliance_requirements: ['SOC2', 'GDPR', 'ISO27001'],
        estimated_equipment_count: 1000,
        expected_data_volume_mb_per_day: 50000,
        custom_requirements: {
          dedicated_database: true,
          dedicated_s3_bucket: true,
          custom_domain: 'enterprise.manufacturing.com'
        }
      };

      const result = await TenantProvisioningService.provisionNewTenant(enterpriseRequest);

      expect(result.success).toBe(true);
      expect(result.provisioning_status).toBeDefined();
      expect(Array.isArray(result.resources_created)).toBe(true);
    });

    it('should validate tenant configuration', async () => {
      const invalidRequest = {
        tenant_id: '',
        tenant_name: '',
        contact_email: 'invalid-email',
        subscription_tier: 'invalid' as any,
        deployment_type: 'multi-tenant' as const,
        data_region: 'invalid-region' as any,
        compliance_requirements: [],
        estimated_equipment_count: -1,
        expected_data_volume_mb_per_day: -1
      };

      const result = await TenantProvisioningService.provisionNewTenant(invalidRequest);
      
      expect(result.success).toBe(false);
      expect(result.error_details).toBeDefined();
      expect(result.error_details!.length).toBeGreaterThan(0);
    });
  });
});