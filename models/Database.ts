// Database and Storage Related Interfaces

export interface StorageResult {
  timescale: boolean;
  postgres: boolean;
  s3: boolean;
  latency_ms: number;
  error?: string;
}

export interface S3UploadResult {
  success: boolean;
  key?: string;
  bucket?: string;
  size?: number;
  error?: string;
}

export interface DataRetentionPolicy {
  table_name: string;
  retention_days: number;
  enabled: boolean;
  created_at: string;
}

export interface TenantUsageMetrics {
  dailyDataVolumeGB: number;
  avgQueriesPerSecond: number;
  avgCpuUtilization: number;
  slaViolations: number;
  monthlyDataTransferGB: number;
}