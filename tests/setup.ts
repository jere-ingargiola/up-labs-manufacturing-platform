// Test setup configuration
// Global test utilities and mocks

/// <reference types="jest" />

// Mock AWS SDK v2 (legacy)
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({ Location: 'https://s3.amazonaws.com/test-bucket/test-file' })
    }),
    getObject: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({ Body: Buffer.from('test data') })
    })
  })),
  TimestreamWrite: jest.fn(() => ({
    writeRecords: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({})
    })
  })),
  TimestreamQuery: jest.fn(() => ({
    query: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({ Rows: [] })
    })
  })),
  CloudWatch: jest.fn(() => ({
    putMetricData: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({})
    })
  })),
  SNS: jest.fn(() => ({
    publish: jest.fn().mockReturnValue({
      promise: () => Promise.resolve({ MessageId: 'test-message-id' })
    })
  }))
}));

// Mock AWS SDK v3 modules
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ Location: 'https://s3.amazonaws.com/test-bucket/test-file' })
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutMetricDataCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
  })),
  PublishCommand: jest.fn()
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SHARED_DB_CONNECTION_STRING = 'postgresql://test:test@localhost:5432/test_db';
process.env.SHARED_S3_BUCKET = 'test-shared-bucket';
process.env.SHARED_KMS_KEY = 'arn:aws:kms:us-east-1:123456789012:key/test-key';

// Global test utilities
(global as any).testUtils = {
  createMockAPIGatewayEvent: (overrides = {}) => ({
    body: null,
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'test-tenant'
    },
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      },
      httpMethod: 'GET',
      resourcePath: '/test',
      stage: 'test'
    },
    multiValueHeaders: {},
    multiValueQueryStringParameters: {},
    stageVariables: null,
    resource: '/test',
    httpMethod: 'GET',
    path: '/test',
    isBase64Encoded: false,
    ...overrides
  }),
  
  createMockTenantContext: (overrides = {}) => ({
    tenant_id: 'test-tenant',
    tenant_name: 'Test Tenant',
    deployment_type: 'multi-tenant',
    subscription_tier: 'professional',
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
        sns_topics: ['arn:aws:sns:us-east-1:123456789012:test-alerts'],
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
    },
    ...overrides
  })
};

// Setup and teardown
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test state
  delete process.env.CURRENT_TENANT_ID;
  delete process.env.CURRENT_DEPLOYMENT_TYPE;
  
  // Clear any timers that might be left hanging
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  // Clear any remaining intervals/timeouts
  jest.clearAllTimers();
});