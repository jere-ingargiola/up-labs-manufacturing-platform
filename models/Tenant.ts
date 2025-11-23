// Tenant Management and Multi-Tenancy Interfaces

export interface TenantContext {
  tenant_id: string;
  tenant_name: string;
  deployment_type: 'multi-tenant' | 'single-tenant' | 'hybrid';
  data_region: string;
  subscription_tier: 'basic' | 'professional' | 'enterprise';
  compliance_requirements: string[];
  max_equipment: number;
  retention_days: number;
  created_at: string;
  config: TenantConfig;
}

export interface TenantConfig {
  database: {
    connection_string?: string;
    use_rls: boolean;
    max_connections: number;
  };
  storage: {
    s3_bucket?: string;
    encryption_key?: string;
    retention_policy: string;
  };
  alerts: {
    sns_topics: string[];
    webhook_urls: string[];
    escalation_rules: EscalationRule[];
  };
  features: {
    advanced_analytics: boolean;
    custom_dashboards: boolean;
    api_rate_limit: number;
    concurrent_users: number;
  };
}

export interface EscalationRule {
  severity: 'critical' | 'high' | 'medium' | 'low';
  delay_minutes: number;
  channels: string[];
}

export interface TenantProvisioningRequest {
  tenant_id: string;
  tenant_name: string;
  contact_email: string;
  deployment_type: 'multi-tenant' | 'single-tenant' | 'hybrid';
  subscription_tier: 'basic' | 'professional' | 'enterprise';
  data_region: string;
  compliance_requirements: string[];
  estimated_equipment_count: number;
  expected_data_volume_mb_per_day: number;
  custom_requirements?: {
    dedicated_database?: boolean;
    dedicated_s3_bucket?: boolean;
    custom_domain?: string;
    vpn_access?: boolean;
    sso_integration?: string;
  };
}

export interface ProvisioningResult {
  success: boolean;
  tenant_id: string;
  provisioning_status: 'pending' | 'in-progress' | 'completed' | 'failed';
  resources_created: string[];
  connection_details?: {
    api_endpoint: string;
    database_endpoint?: string;
    s3_bucket?: string;
    kafka_topics: string[];
  };
  credentials?: {
    api_keys: string[];
    database_credentials?: {
      username: string;
      password: string;
    };
  };
  estimated_cost_per_month?: number;
  setup_instructions?: string[];
  error_details?: string[];
}