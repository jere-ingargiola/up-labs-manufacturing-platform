// Tenant Resolution and Context Management Service
import { 
  APIGatewayProxyEvent,
  TenantContext, TenantConfig, EscalationRule
} from '../models';

// Tenant configuration cache (in production, use Redis/ElastiCache)
const tenantCache = new Map<string, TenantContext>();

export class TenantResolver {
  
  async resolveTenant(event: APIGatewayProxyEvent): Promise<TenantContext> {
    const tenantId = this.extractTenantId(event);
    
    if (!tenantId) {
      throw new Error('Tenant ID not found in request');
    }
    
    // Check cache first
    if (tenantCache.has(tenantId)) {
      return tenantCache.get(tenantId)!;
    }
    
    // Load from database
    const tenant = await this.loadTenantConfig(tenantId);
    
    // Validate tenant is active and within limits
    await this.validateTenantAccess(tenant, event);
    
    // Cache for future requests (5-minute TTL)
    tenantCache.set(tenantId, tenant);
    setTimeout(() => tenantCache.delete(tenantId), 5 * 60 * 1000);
    
    return tenant;
  }
  
  private extractTenantId(event: APIGatewayProxyEvent): string | null {
    // Priority order for tenant resolution:
    
    // 1. Custom header (X-Tenant-ID) - Most explicit
    if (event.headers?.['X-Tenant-ID'] || event.headers?.['x-tenant-id']) {
      return event.headers?.['X-Tenant-ID'] || event.headers?.['x-tenant-id'];
    }
    
    // 2. JWT token claim - For authenticated requests
    if (event.headers?.Authorization) {
      const tenantFromJWT = this.extractFromJWT(event.headers.Authorization);
      if (tenantFromJWT) return tenantFromJWT;
    }
    
    // 3. Subdomain (tenant.manufacturing.com) - For web apps
    if (event.headers?.Host) {
      const tenantFromSubdomain = this.extractFromSubdomain(event.headers.Host);
      if (tenantFromSubdomain) return tenantFromSubdomain;
    }
    
    // 4. Query parameter - For testing/debugging
    if (event.queryStringParameters?.tenant_id) {
      return event.queryStringParameters.tenant_id;
    }
    
    // 5. API key prefix - For IoT devices
    if (event.headers?.['X-API-Key'] || event.headers?.['x-api-key']) {
      const apiKey = event.headers?.['X-API-Key'] || event.headers?.['x-api-key'];
      return this.extractFromApiKey(apiKey);
    }
    
    return null;
  }
  
  private extractFromJWT(authHeader: string): string | null {
    try {
      const token = authHeader.replace('Bearer ', '');
      // In production, verify JWT signature and extract tenant_id claim
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.tenant_id || null;
    } catch {
      return null;
    }
  }
  
  private extractFromSubdomain(host: string): string | null {
    // Extract tenant from subdomain: tenant.manufacturing.com -> tenant
    const parts = host.split('.');
    if (parts.length >= 3 && parts[1] === 'manufacturing') {
      return parts[0];
    }
    return null;
  }
  
  private extractFromApiKey(apiKey: string): string | null {
    // API key format: tenant_uuid_randomstring
    const parts = apiKey.split('_');
    if (parts.length >= 2) {
      return parts[0];
    }
    return null;
  }
  
  private async loadTenantConfig(tenantId: string): Promise<TenantContext> {
    // In production, this would query the tenant database
    // For now, return a mock configuration
    
    // Use mock database endpoints for testing
    const isMockMode = process.env.MOCK_SERVICES === 'true' || process.env.SKIP_DB_CONNECTIONS === 'true';
    const dbHost = isMockMode ? 'localhost' : 'manufacturingplatform-development-postgresdb113281d2-tsgocyznjzyn.cnqweieki09q.us-east-1.rds.amazonaws.com';
    
    const mockTenants: Record<string, TenantContext> = {
      'acme-corp': {
        tenant_id: 'acme-corp',
        tenant_name: 'ACME Corporation',
        deployment_type: 'single-tenant',
        data_region: 'us-east-1',
        subscription_tier: 'enterprise',
        compliance_requirements: ['SOC2', 'GDPR'],
        max_equipment: 10000,
        retention_days: 365,
        created_at: '2025-01-01T00:00:00Z',
        config: {
          database: {
            connection_string: `postgresql://${dbHost}:5432/manufacturing`,
            use_rls: false,
            max_connections: 100
          },
          storage: {
            s3_bucket: 'manufacturing-platform-archival-development-535002890929',
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
      'shared-tenant': {
        tenant_id: 'shared-tenant',
        tenant_name: 'Shared SMB Customer',
        deployment_type: 'multi-tenant',
        data_region: 'us-east-1',
        subscription_tier: 'professional',
        compliance_requirements: [],
        max_equipment: 100,
        retention_days: 90,
        created_at: '2025-06-01T00:00:00Z',
        config: {
          database: {
            use_rls: true,
            max_connections: 10
          },
          storage: {
            retention_policy: '90-days'
          },
          alerts: {
            sns_topics: ['arn:aws:sns:us-east-1:123456789012:shared-alerts'],
            webhook_urls: [],
            escalation_rules: [{
              severity: 'critical',
              delay_minutes: 5,
              channels: ['sns']
            }]
          },
          features: {
            advanced_analytics: false,
            custom_dashboards: false,
            api_rate_limit: 1000,
            concurrent_users: 10
          }
        }
      }
    };
    
    const tenant = mockTenants[tenantId];
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    return tenant;
  }
  
  private async validateTenantAccess(tenant: TenantContext, event: APIGatewayProxyEvent): Promise<void> {
    // Validate tenant is active
    if (!tenant) {
      throw new Error('Invalid tenant configuration');
    }
    
    // Check rate limiting (simplified)
    const currentHour = new Date().getHours();
    const rateLimitKey = `${tenant.tenant_id}-${currentHour}`;
    
    // In production, use Redis for distributed rate limiting
    // For now, just log the rate limit check
    console.log(`Rate limit check for ${tenant.tenant_id}: ${tenant.config.features.api_rate_limit} requests/hour`);
    
    // Validate request is from allowed region (for compliance)
    if (tenant.compliance_requirements.includes('GDPR')) {
      // Check if request originates from EU region
      const sourceIP = event.requestContext?.identity?.sourceIp;
      // In production, use IP geolocation service
      console.log(`GDPR compliance check for request from IP: ${sourceIP}`);
    }
  }
}

// Tenant context middleware for Lambda functions
export async function withTenantContext<T>(
  event: APIGatewayProxyEvent,
  handler: (tenantContext: TenantContext, event: APIGatewayProxyEvent) => Promise<T>
): Promise<T> {
  const resolver = new TenantResolver();
  const tenantContext = await resolver.resolveTenant(event);
  
  // Set tenant context for downstream services
  process.env.CURRENT_TENANT_ID = tenantContext.tenant_id;
  process.env.CURRENT_DEPLOYMENT_TYPE = tenantContext.deployment_type;
  
  return handler(tenantContext, event);
}

// Tenant configuration utilities
export class TenantConfigService {
  
  static getConnectionConfig(tenant: TenantContext) {
    // Mock mode for testing - return localhost connections
    if (process.env.MOCK_SERVICES === 'true' || process.env.SKIP_DB_CONNECTIONS === 'true') {
      return {
        connectionString: 'postgresql://localhost:5432/test_manufacturing',
        maxConnections: 5,
        ssl: false,
        mock: true
      };
    }
    
    if (tenant.deployment_type === 'single-tenant') {
      return {
        connectionString: tenant.config.database.connection_string,
        maxConnections: tenant.config.database.max_connections,
        ssl: true
      };
    } else {
      return {
        connectionString: process.env.SHARED_DB_CONNECTION_STRING,
        maxConnections: tenant.config.database.max_connections,
        ssl: true,
        // Set tenant context for Row Level Security
        options: `-c app.current_tenant_id=${tenant.tenant_id}`
      };
    }
  }
  
  static getStorageConfig(tenant: TenantContext) {
    if (tenant.deployment_type === 'single-tenant') {
      return {
        bucket: tenant.config.storage.s3_bucket,
        kmsKey: tenant.config.storage.encryption_key,
        prefix: ''
      };
    } else {
      return {
        bucket: process.env.SHARED_S3_BUCKET,
        prefix: `tenants/${tenant.tenant_id}/`,
        kmsKey: process.env.SHARED_KMS_KEY
      };
    }
  }
  
  static getKafkaConfig(tenant: TenantContext) {
    return {
      topics: {
        sensorData: `sensor-data-${tenant.tenant_id}`,
        alerts: `alerts-${tenant.tenant_id}`,
        shared: tenant.deployment_type === 'multi-tenant' ? 'manufacturing-shared' : undefined
      },
      partitions: tenant.subscription_tier === 'enterprise' ? 10 : 3,
      replicationFactor: tenant.deployment_type === 'single-tenant' ? 3 : 2
    };
  }
  
  static getAlertConfig(tenant: TenantContext) {
    return {
      snsTopics: tenant.config.alerts.sns_topics,
      webhookUrls: tenant.config.alerts.webhook_urls,
      escalationRules: tenant.config.alerts.escalation_rules,
      cloudWatchNamespace: `Manufacturing/${tenant.tenant_id}`
    };
  }
}

// Tenant metrics and usage tracking
export class TenantMetricsService {
  
  static async trackUsage(tenant: TenantContext, operation: string, value: number = 1) {
    // Track tenant-specific usage metrics
    const metrics = {
      tenantId: tenant.tenant_id,
      subscriptionTier: tenant.subscription_tier,
      deploymentType: tenant.deployment_type,
      operation,
      value,
      timestamp: new Date().toISOString()
    };
    
    // In production, publish to CloudWatch or analytics service
    console.log('Tenant usage:', JSON.stringify(metrics));
  }
  
  static async checkLimits(tenant: TenantContext, operation: string, currentValue: number): Promise<boolean> {
    const limits = {
      'equipment-count': tenant.max_equipment,
      'api-requests-per-hour': tenant.config.features.api_rate_limit,
      'concurrent-users': tenant.config.features.concurrent_users
    };
    
    const limit = limits[operation as keyof typeof limits];
    if (limit && currentValue >= limit) {
      console.log(`Tenant ${tenant.tenant_id} exceeded limit for ${operation}: ${currentValue}/${limit}`);
      return false;
    }
    
    return true;
  }
}