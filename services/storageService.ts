// Multi-tier storage service: TimescaleDB + PostgreSQL + S3 archival
// Enhanced with multi-tenant support and tenant-aware storage
import { Pool } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { 
  SensorData, Alert, Equipment, ProductionMetrics,
  StorageResult, S3UploadResult, TenantUsageMetrics,
  TenantContext
} from '../models';
import { TenantConfigService } from './tenantService';

// Connection pools
let timescalePool: Pool | null = null;
let postgresPool: Pool | null = null;
const tenantPools: Map<string, { timescale: Pool; postgres: Pool }> = new Map();

// S3 client for archival
const s3Client = new S3Client({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

// Get tenant usage metrics (mock implementation - replace with CloudWatch in production)
function getTenantUsageMetrics(tenantId: string): TenantUsageMetrics {
  // In production, query CloudWatch metrics
  const mockMetrics: Record<string, TenantUsageMetrics> = {
    'acme-corp': { dailyDataVolumeGB: 150, avgQueriesPerSecond: 75, avgCpuUtilization: 85, slaViolations: 3, monthlyDataTransferGB: 4500 },
    'shared-tenant': { dailyDataVolumeGB: 25, avgQueriesPerSecond: 15, avgCpuUtilization: 35, slaViolations: 0, monthlyDataTransferGB: 750 },
    default: { dailyDataVolumeGB: 45, avgQueriesPerSecond: 25, avgCpuUtilization: 45, slaViolations: 1, monthlyDataTransferGB: 1350 }
  };
  
  return mockMetrics[tenantId] || mockMetrics.default;
}

// Smart decision engine for TimescaleDB allocation
function shouldUseDedicatedTimescale(tenantContext: TenantContext, usage: TenantUsageMetrics): boolean {
  // Cost optimization thresholds for dedicated TimescaleDB
  const DEDICATED_THRESHOLDS = {
    dailyDataGB: 100,        // >100GB/day needs dedicated performance
    queriesPerSecond: 50,    // >50 QPS benefits from dedicated resources
    slaViolations: 5,        // Too many violations = need dedicated
    enterpriseTier: tenantContext.subscription_tier === 'enterprise'
  };
  
  return usage.dailyDataVolumeGB > DEDICATED_THRESHOLDS.dailyDataGB ||
         usage.avgQueriesPerSecond > DEDICATED_THRESHOLDS.queriesPerSecond ||
         usage.slaViolations > DEDICATED_THRESHOLDS.slaViolations ||
         DEDICATED_THRESHOLDS.enterpriseTier;
}

function getTimescalePool(): Pool {
  if (!timescalePool) {
    timescalePool = new Pool({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      database: process.env.TIMESCALE_DB || 'manufacturing_timeseries',
      user: process.env.TIMESCALE_USER || 'postgres',
      password: process.env.TIMESCALE_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 30,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 1000,
    });
    
    // Initialize TimescaleDB with retention policy
    initializeTimescaleDB().catch(error => {
      console.error('TimescaleDB initialization failed:', error);
    });
  }
  return timescalePool;
}

function getPostgresPool(): Pool {
  if (!postgresPool) {
    postgresPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'manufacturing_app',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return postgresPool;
}

// Cost-optimized connection pools with smart routing
function getTenantAwareTimescalePool(tenantContext?: TenantContext): Pool {
  if (!tenantContext) {
    return getTimescalePool(); // Fallback to shared pool
  }
  
  const tenantId = tenantContext.tenant_id;
  
  // Smart routing: Check if tenant needs dedicated TimescaleDB based on usage
  const usage = getTenantUsageMetrics(tenantId);
  const needsDedicated = shouldUseDedicatedTimescale(tenantContext, usage);
  
  // High-usage tenants get dedicated TimescaleDB for performance
  if (needsDedicated && tenantContext.deployment_type === 'single-tenant') {
    if (!tenantPools.has(tenantId)) {
      const connectionConfig = TenantConfigService.getConnectionConfig(tenantContext);
      const pool = new Pool({
        connectionString: connectionConfig.connectionString,
        max: connectionConfig.maxConnections,
        ssl: connectionConfig.ssl,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 1000,
      });
      
      tenantPools.set(tenantId, { 
        timescale: pool, 
        postgres: pool // Same pool for single-tenant 
      });
    }
    return tenantPools.get(tenantId)!.timescale;
  }
  
  // Multi-tenant: use shared pool with RLS context
  const sharedPool = getTimescalePool();
  
  // Set tenant context for Row Level Security
  sharedPool.query(`SET app.current_tenant_id = '${tenantId}'`).catch(err => {
    console.error('Failed to set tenant context:', err);
  });
  
  return sharedPool;
}

function getTenantAwarePostgresPool(tenantContext?: TenantContext): Pool {
  if (!tenantContext) {
    return getPostgresPool(); // Fallback to shared pool
  }
  
  const tenantId = tenantContext.tenant_id;
  
  // COST OPTIMIZATION: Always use shared PostgreSQL with RLS for transactional data
  // Transactional data volume is low, multi-tenant approach saves ~$400/month per customer
  
  // Multi-tenant: use shared pool with RLS context (ALWAYS for cost optimization)
  const sharedPool = getPostgresPool();
  
  // Set tenant context for Row Level Security
  sharedPool.query(`SET app.current_tenant_id = '${tenantId}'`).catch((err: any) => {
    console.error('Failed to set tenant context:', err);
  });
  
  return sharedPool;
}

// Initialize TimescaleDB with automatic 30-day retention policy
async function initializeTimescaleDB(): Promise<void> {
  const client = getTimescalePool();
  
  try {
    // Create sensor_data hypertable if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_data_raw (
        time TIMESTAMPTZ NOT NULL,
        equipment_id TEXT NOT NULL,
        temperature REAL,
        vibration REAL,
        pressure REAL,
        power_consumption REAL,
        custom_metrics JSONB,
        facility_id TEXT,
        line_id TEXT,
        ingestion_timestamp TIMESTAMPTZ,
        source TEXT,
        has_anomalies BOOLEAN DEFAULT FALSE,
        data_hash TEXT, -- For deduplication
        PRIMARY KEY (time, equipment_id)
      );
    `);

    // Convert to hypertable
    await client.query(`
      SELECT create_hypertable('sensor_data_raw', 'time', 
        chunk_time_interval => INTERVAL '1 hour',
        if_not_exists => TRUE);
    `);

    // Add 30-day retention policy
    await client.query(`
      SELECT add_retention_policy('sensor_data_raw', INTERVAL '30 days', if_not_exists => TRUE);
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_equipment_time 
      ON sensor_data_raw (equipment_id, time DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_anomalies 
      ON sensor_data_raw (has_anomalies, time DESC) WHERE has_anomalies = TRUE;
    `);

    console.log('TimescaleDB initialized with 30-day retention policy');
  } catch (error) {
    console.error('TimescaleDB initialization error:', error);
    throw error;
  }
}

// Multi-tier sensor data storage with tenant awareness
export async function storeSensorDataMultiTier(sensorData: SensorData, tenantContext?: TenantContext): Promise<StorageResult> {
  const startTime = Date.now();
  const result: StorageResult = {
    timescale: false,
    postgres: false,
    s3: false,
    latency_ms: 0
  };

  try {
    // 1. PRIORITY: Store in TimescaleDB (real-time access, 30-day TTL)
    const timescalePromise = storeToTimescale(sensorData, tenantContext);
    
    // 2. Store critical metadata in PostgreSQL (transactional)
    const postgresPromise = storeToPostgres(sensorData, tenantContext);
    
    // 3. Archive raw data to S3 (long-term historical analysis)
    const s3Promise = archiveToS3(sensorData, tenantContext);

    // Execute storage operations
    const [timescaleResult, postgresResult, s3Result] = await Promise.allSettled([
      timescalePromise,
      postgresPromise,
      s3Promise
    ]);

    result.timescale = timescaleResult.status === 'fulfilled';
    result.postgres = postgresResult.status === 'fulfilled';
    result.s3 = s3Result.status === 'fulfilled';
    result.latency_ms = Date.now() - startTime;

    // Log any failures and archive errors
    const failures: string[] = [];
    if (timescaleResult.status === 'rejected') {
      console.error('TimescaleDB storage failed:', timescaleResult.reason);
      failures.push(`TimescaleDB: ${timescaleResult.reason}`);
    }
    if (postgresResult.status === 'rejected') {
      console.error('PostgreSQL storage failed:', postgresResult.reason);
      failures.push(`PostgreSQL: ${postgresResult.reason}`);
    }
    if (s3Result.status === 'rejected') {
      console.error('S3 storage failed:', s3Result.reason);
      failures.push(`S3: ${s3Result.reason}`);
    }

    // Archive raw sensor data to errors folder if any storage failed
    if (failures.length > 0) {
      // Archive the original sensor data for reprocessing
      archiveErrorToS3(sensorData, tenantContext).catch(archiveError => {
        console.error('❌ Failed to archive sensor data to errors folder:', archiveError);
      });
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown storage error';
    result.latency_ms = Date.now() - startTime;
    return result;
  }
}

// Store to TimescaleDB (real-time time-series data with 30-day TTL)
async function storeToTimescale(sensorData: SensorData, tenantContext?: TenantContext): Promise<void> {
  const client = getTenantAwareTimescalePool(tenantContext);
  
  // For multi-tenant: use Row Level Security with tenant_id
  // For single-tenant: dedicated database connection
  const tableName = tenantContext?.deployment_type === 'multi-tenant' ? 'sensor_data_raw' : 'sensor_data_raw';
  
  const query = tenantContext?.deployment_type === 'multi-tenant' ? `
    INSERT INTO ${tableName} (
      time, equipment_id, temperature, vibration, pressure, 
      power_consumption, custom_metrics, facility_id, line_id,
      ingestion_timestamp, source, has_anomalies, data_hash, tenant_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (time, equipment_id, tenant_id) DO UPDATE SET
      temperature = EXCLUDED.temperature,
      vibration = EXCLUDED.vibration,
      pressure = EXCLUDED.pressure,
      power_consumption = EXCLUDED.power_consumption,
      custom_metrics = EXCLUDED.custom_metrics,
      ingestion_timestamp = EXCLUDED.ingestion_timestamp
  ` : `
    INSERT INTO ${tableName} (
      time, equipment_id, temperature, vibration, pressure, 
      power_consumption, custom_metrics, facility_id, line_id,
      ingestion_timestamp, source, has_anomalies, data_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (time, equipment_id) DO UPDATE SET
      temperature = EXCLUDED.temperature,
      vibration = EXCLUDED.vibration,
      pressure = EXCLUDED.pressure,
      power_consumption = EXCLUDED.power_consumption,
      custom_metrics = EXCLUDED.custom_metrics,
      ingestion_timestamp = EXCLUDED.ingestion_timestamp
  `;

  const dataHash = generateDataHash(sensorData);
  
  await client.query(query, [
    sensorData.timestamp,
    sensorData.equipment_id,
    sensorData.temperature,
    sensorData.vibration,
    sensorData.pressure,
    sensorData.power_consumption,
    JSON.stringify(sensorData.custom_metrics || {}),
    sensorData.facility_id,
    sensorData.line_id,
    sensorData.ingestionTimestamp,
    sensorData.source,
    sensorData.hasAnomalies || false,
    dataHash
  ]);
}

// Store metadata in PostgreSQL (transactional data)
async function storeToPostgres(sensorData: SensorData, tenantContext?: TenantContext): Promise<void> {
  const client = getTenantAwarePostgresPool(tenantContext);
  
  // Store equipment last seen and basic metrics
  const query = `
    INSERT INTO equipment_status (
      equipment_id, last_seen, current_temperature, current_vibration,
      current_pressure, status, facility_id, line_id, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (equipment_id) DO UPDATE SET
      last_seen = EXCLUDED.last_seen,
      current_temperature = EXCLUDED.current_temperature,
      current_vibration = EXCLUDED.current_vibration,
      current_pressure = EXCLUDED.current_pressure,
      updated_at = EXCLUDED.updated_at
  `;

  await client.query(query, [
    sensorData.equipment_id,
    sensorData.timestamp,
    sensorData.temperature,
    sensorData.vibration,
    sensorData.pressure,
    'online', // Equipment is sending data, so it's online
    sensorData.facility_id,
    sensorData.line_id,
    new Date().toISOString()
  ]);
}

// Archive raw sensor data to S3 errors/date folder structure when processing fails
async function archiveErrorToS3(rawSensorData: SensorData, tenantContext?: TenantContext): Promise<S3UploadResult> {
  try {
    const date = new Date();
    const storageConfig = tenantContext ? TenantConfigService.getStorageConfig(tenantContext) : null;
    
    let s3Key: string;
    if (tenantContext?.deployment_type === 'single-tenant') {
      // Single-tenant: errors organized by date
      s3Key = `errors/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getHours()).padStart(2, '0')}/${rawSensorData.equipment_id || 'unknown'}-${Date.now()}.json`;
    } else {
      // Multi-tenant: include tenant prefix in errors
      const tenantPrefix = storageConfig?.prefix || `tenants/${tenantContext?.tenant_id}/`;
      s3Key = `${tenantPrefix}errors/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getHours()).padStart(2, '0')}/${rawSensorData.equipment_id || 'unknown'}-${Date.now()}.json`;
    }
    
    // Store raw sensor data with minimal error metadata
    const errorS3Data = {
      ...rawSensorData,
      error_archived_at: date.toISOString(),
      error_key: s3Key,
      processing_failed: true
    };
    
    // Get S3 bucket
    let bucketName: string;
    if (tenantContext?.deployment_type === 'single-tenant' && storageConfig?.bucket) {
      bucketName = storageConfig.bucket;
    } else {
      bucketName = process.env.SHARED_S3_BUCKET || process.env.S3_BUCKET_NAME || 'up-labs-manufacturing-data';
    }
    
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: JSON.stringify(errorS3Data, null, 2),
      ContentType: 'application/json',
      Metadata: {
        errorType: 'processing-failed',
        equipmentId: rawSensorData.equipment_id || 'unknown',
        tenantId: tenantContext?.tenant_id || 'shared',
        archivedAt: date.toISOString()
      }
    });
    
    await s3Client.send(putCommand);
    
    console.log(`🚨 Failed Data Archived: ${s3Key} -> s3://${bucketName}/${s3Key}`);
    
    return {
      success: true,
      key: s3Key,
      bucket: bucketName,
      size: JSON.stringify(errorS3Data).length
    };
  } catch (error) {
    console.error('❌ Failed data archival error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed data archival error'
    };
  }
}

// Archive to S3 for long-term storage
async function archiveToS3(sensorData: SensorData, tenantContext?: TenantContext): Promise<S3UploadResult> {
  try {
    // S3 key structure with tenant awareness
    const date = new Date(sensorData.timestamp);
    const storageConfig = tenantContext ? TenantConfigService.getStorageConfig(tenantContext) : null;
    
    let s3Key: string;
    if (tenantContext?.deployment_type === 'single-tenant') {
      // Single-tenant: organize by facility ID, equipment ID, then date
      const facilityId = sensorData.facility_id || 'unknown-facility';
      s3Key = `${facilityId}/${sensorData.equipment_id}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getHours()).padStart(2, '0')}/${sensorData.timestamp}.json`;
    } else {
      // Multi-tenant: include tenant prefix, facility ID, and equipment ID organization
      const tenantPrefix = storageConfig?.prefix || `tenants/${tenantContext?.tenant_id}/`;
      const facilityId = sensorData.facility_id || 'unknown-facility';
      s3Key = `${tenantPrefix}${facilityId}/${sensorData.equipment_id}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getHours()).padStart(2, '0')}/${sensorData.timestamp}.json`;
    }
    
    // Enhanced data with archival metadata
    const s3Data = {
      ...sensorData,
      archived_at: new Date().toISOString(),
      archive_key: s3Key
    };
    
    // Get S3 bucket based on tenant configuration
    let bucketName: string;
    if (tenantContext?.deployment_type === 'single-tenant' && storageConfig?.bucket) {
      // Single-tenant with dedicated bucket
      bucketName = storageConfig.bucket;
    } else {
      // Multi-tenant shared bucket or fallback
      bucketName = process.env.SHARED_S3_BUCKET || process.env.S3_BUCKET_NAME || 'up-labs-manufacturing-data';
    }
    
    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: JSON.stringify(s3Data, null, 2),
      ContentType: 'application/json',
      Metadata: {
        equipmentId: sensorData.equipment_id,
        tenantId: tenantContext?.tenant_id || 'shared',
        sensorType: 'manufacturing',
        archivedAt: new Date().toISOString()
      }
    });
    
    await s3Client.send(putCommand);
    
    console.log(`✅ S3 Archive: ${s3Key} (${JSON.stringify(s3Data).length} bytes) -> s3://${bucketName}/${s3Key}`);
    
    return {
      success: true,
      key: s3Key,
      bucket: bucketName,
      size: JSON.stringify(s3Data).length
    };
  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    
    // Archive the raw sensor data to errors folder for reprocessing
    archiveErrorToS3(sensorData, tenantContext).catch(archiveError => {
      console.error('❌ Failed to archive sensor data to errors folder:', archiveError);
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'S3 upload failed'
    };
  }
}

// Generate hash for deduplication
function generateDataHash(sensorData: SensorData): string {
  const hashInput = `${sensorData.equipment_id}-${sensorData.timestamp}-${sensorData.temperature}-${sensorData.vibration}-${sensorData.pressure}`;
  // Simple hash implementation - use crypto in production
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Query functions for multi-tier data access
export async function getRecentSensorData(equipmentId: string, hours: number = 24, tenantContext?: TenantContext): Promise<SensorData[]> {
  const client = getTenantAwareTimescalePool(tenantContext);
  
  const query = `
    SELECT * FROM sensor_data_raw
    WHERE equipment_id = $1 
    AND time >= NOW() - INTERVAL '${hours} hours'
    ORDER BY time DESC
    LIMIT 1000
  `;
  
  const result = await client.query(query, [equipmentId]);
  return result.rows;
}

export async function getEquipmentCurrentStatus(equipmentId: string, tenantContext?: TenantContext): Promise<any> {
  const client = getTenantAwarePostgresPool(tenantContext);
  
  const query = `
    SELECT * FROM equipment_status
    WHERE equipment_id = $1
  `;
  
  const result = await client.query(query, [equipmentId]);
  return result.rows[0] || null;
}

// Historical data retrieval from S3 (for analytics)
export async function getHistoricalDataKeys(equipmentId: string, startDate: string, endDate: string): Promise<string[]> {
  // This would query S3 to get available data keys for the date range
  // Implementation would use AWS SDK S3 listObjects
  const keys: string[] = [];
  
  console.log(`Historical data query: ${equipmentId} from ${startDate} to ${endDate}`);
  
  return keys;
}