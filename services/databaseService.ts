// Multi-tier database service: TimescaleDB (30d TTL) + PostgreSQL + S3 archival

import { Pool, PoolClient } from 'pg';
import { 
  Equipment, SensorData, Alert, ProductionMetrics, EquipmentStatus,
  StorageResult, DataRetentionPolicy
} from '../models';

// Multi-database connection pools
let timescalePool: Pool | null = null;
let postgresPool: Pool | null = null;

// TimescaleDB connection (for time-series sensor data with TTL)
function getTimescalePool(): Pool {
  if (!timescalePool) {
    timescalePool = new Pool({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      database: process.env.TIMESCALE_DB || 'manufacturing_timeseries',
      user: process.env.TIMESCALE_USER || 'postgres',
      password: process.env.TIMESCALE_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 30, // Higher for time-series workload
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 1000, // Faster for real-time data
    });
  }
  return timescalePool;
}

// PostgreSQL connection (for transactional data - equipment, users, etc.)
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

// Equipment queries
export async function getEquipmentById(equipmentId: string): Promise<Equipment | null> {
  const client = getPostgresPool();
  
  try {
    const result = await client.query(
      `SELECT equipment_id, name, type, facility_id, line_id, status, 
              manufacturer, model, installation_date, last_maintenance, 
              next_maintenance, created_at, updated_at
       FROM equipment 
       WHERE equipment_id = $1`,
      [equipmentId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching equipment:', error);
    throw error;
  }
}

export async function getEquipmentsByFacility(facilityId: string): Promise<Equipment[]> {
  const client = getPostgresPool();
  
  try {
    const result = await client.query(
      `SELECT equipment_id, name, type, facility_id, line_id, status, 
              manufacturer, model, installation_date, last_maintenance, 
              next_maintenance, created_at, updated_at
       FROM equipment 
       WHERE facility_id = $1 
       ORDER BY name`,
      [facilityId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching equipment by facility:', error);
    throw error;
  }
}

// Sensor data queries (TimescaleDB optimized)
export async function getRecentSensorReadings(equipmentId: string, limit: number = 10): Promise<SensorData[]> {
  const client = getTimescalePool();
  
  try {
    const result = await client.query(
      `SELECT equipment_id, timestamp, temperature, vibration, pressure, 
              power_consumption, facility_id, line_id
       FROM sensor_readings 
       WHERE equipment_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [equipmentId, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching recent sensor readings:', error);
    throw error;
  }
}

export async function getSensorReadingsInRange(
  equipmentId: string, 
  startTime: string, 
  endTime: string
): Promise<SensorData[]> {
  const client = getTimescalePool();
  
  try {
    const result = await client.query(
      `SELECT equipment_id, timestamp, temperature, vibration, pressure, 
              power_consumption, facility_id, line_id
       FROM sensor_readings 
       WHERE equipment_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3
       ORDER BY timestamp ASC`,
      [equipmentId, startTime, endTime]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching sensor readings in range:', error);
    throw error;
  }
}

// Metrics queries with TimescaleDB time_bucket
export async function getEquipmentMetrics(
  equipmentId: string, 
  startDate: string, 
  endDate: string
): Promise<ProductionMetrics[]> {
  const client = getTimescalePool();
  
  try {
    const result = await client.query(
      `SELECT 
         equipment_id,
         facility_id,
         line_id,
         time_bucket('1 day', timestamp) as date,
         AVG(temperature) as avg_temperature,
         MAX(temperature) as max_temperature,
         AVG(vibration) as avg_vibration,
         MAX(vibration) as max_vibration,
         AVG(pressure) as avg_pressure,
         MAX(pressure) as max_pressure,
         COUNT(*) as reading_count
       FROM sensor_readings 
       WHERE equipment_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3
       GROUP BY equipment_id, facility_id, line_id, time_bucket('1 day', timestamp)
       ORDER BY date DESC`,
      [equipmentId, startDate, endDate]
    );
    
    // Enhance with additional metrics
    const enhancedMetrics = await Promise.all(
      result.rows.map(async (row: any) => {
        const alertsResult = await client.query(
          `SELECT COUNT(*) as alert_count
           FROM alerts 
           WHERE equipment_id = $1 AND DATE(timestamp) = DATE($2)`,
          [equipmentId, row.date]
        );
        
        return {
          ...row,
          date: row.date.toISOString().split('T')[0],
          alert_count: parseInt(alertsResult.rows[0]?.alert_count || '0'),
          uptime_percentage: Math.min(100, (row.reading_count / 1440) * 100), // Assuming 1 reading per minute
          total_production: 0, // Would be calculated from production data
          defect_rate: 0, // Would be calculated from quality data
          efficiency_score: Math.min(100, (row.reading_count / 1440) * 80), // Simplified calculation
          maintenance_events: 0 // Would be queried from maintenance table
        };
      })
    );
    
    return enhancedMetrics;
  } catch (error) {
    console.error('Error fetching equipment metrics:', error);
    throw error;
  }
}

// Alert queries
export async function getAlertsByEquipment(
  equipmentId: string,
  limit: number = 50,
  severity?: string
): Promise<Alert[]> {
  const client = getPostgresPool();
  
  try {
    let query = `
      SELECT alert_id, equipment_id, type, severity, message, timestamp,
             acknowledged, acknowledged_by, resolved, resolved_at
      FROM alerts 
      WHERE equipment_id = $1
    `;
    const params: any[] = [equipmentId];
    
    if (severity) {
      query += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
}

// Insert/Update operations
export async function insertSensorReading(sensorData: SensorData): Promise<void> {
  const client = getTimescalePool();
  
  try {
    await client.query(
      `INSERT INTO sensor_readings 
       (equipment_id, timestamp, temperature, vibration, pressure, power_consumption, facility_id, line_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (equipment_id, timestamp) DO UPDATE SET
         temperature = EXCLUDED.temperature,
         vibration = EXCLUDED.vibration,
         pressure = EXCLUDED.pressure,
         power_consumption = EXCLUDED.power_consumption`,
      [
        sensorData.equipment_id,
        sensorData.timestamp,
        sensorData.temperature,
        sensorData.vibration,
        sensorData.pressure,
        sensorData.power_consumption,
        sensorData.facility_id,
        sensorData.line_id
      ]
    );
  } catch (error) {
    console.error('Error inserting sensor reading:', error);
    throw error;
  }
}

export async function insertAlert(alert: Alert): Promise<void> {
  const client = getPostgresPool();
  
  try {
    await client.query(
      `INSERT INTO alerts 
       (alert_id, equipment_id, type, severity, message, timestamp, acknowledged, resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        alert.alert_id,
        alert.equipment_id,
        alert.type,
        alert.severity,
        alert.message,
        alert.timestamp,
        alert.acknowledged,
        alert.resolved
      ]
    );
  } catch (error) {
    console.error('Error inserting alert:', error);
    throw error;
  }
}

export async function updateEquipmentStatus(
  equipmentId: string, 
  status: EquipmentStatus
): Promise<void> {
  const client = getPostgresPool();
  
  try {
    await client.query(
      `UPDATE equipment 
       SET status = $1, updated_at = NOW() 
       WHERE equipment_id = $2`,
      [status, equipmentId]
    );
  } catch (error) {
    console.error('Error updating equipment status:', error);
    throw error;
  }
}

// Cleanup function for Lambda
export async function closePool(): Promise<void> {
  if (timescalePool) {
    await timescalePool.end();
    timescalePool = null;
  }
  if (postgresPool) {
    await postgresPool.end();
    postgresPool = null;
  }
}