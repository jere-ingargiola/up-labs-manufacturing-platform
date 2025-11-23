import { SensorData, ValidationResult, ApiResponse, APIGatewayProxyEvent, APIGatewayProxyResult } from '../../models';
import { publishSensorData, publishAlert } from '../../services/kafkaService';
import { detectAnomalies } from '../../services/anomalyService';
import { storeSensorDataMultiTier } from '../../services/storageService';
import { processCriticalAlert } from '../../services/alertNotificationService';
import { withTenantContext, TenantMetricsService } from '../../services/tenantService';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return withTenantContext(event, async (tenantContext, event) => {
    const startTime = Date.now();
    
    try {
      // Track tenant usage
      await TenantMetricsService.trackUsage(tenantContext, 'sensor-data-ingestion');

      // Parse the incoming payload
      const sensorData: SensorData = JSON.parse(event.body || '{}');

    // Fast validation - only check critical fields
    if (!sensorData.equipment_id || !sensorData.timestamp) {
      return createErrorResponse(400, 'Missing required fields: equipment_id, timestamp');
    }

    // Enrich with metadata
    const enrichedData: SensorData = {
      ...sensorData,
      ingestionTimestamp: new Date().toISOString(),
      source: 'iot-webhook'
    };

    // CRITICAL PATH: Detect anomalies first (synchronous, <50ms)
    const anomalies = await detectAnomalies(enrichedData);
    
    // ULTRA-HIGH PRIORITY: Process critical alerts immediately
    const criticalAlerts: Promise<void>[] = [];
    const processingLatency = Date.now() - startTime;
    
    if (anomalies.length > 0) {
      enrichedData.anomalies = anomalies;
      enrichedData.hasAnomalies = true;

      // Process critical/high alerts with maximum priority
      for (const anomaly of anomalies.filter(a => a.severity === 'critical' || a.severity === 'high')) {
        const alert = {
          alert_id: generateUUID(),
          equipment_id: anomaly.equipment_id,
          type: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message,
          timestamp: anomaly.timestamp,
          acknowledged: false,
          resolved: false,
          processing_latency_ms: processingLatency
        };

        // CRITICAL: Multi-channel alert processing (Kafka + CloudWatch + SNS)
        criticalAlerts.push(
          Promise.all([
            publishAlert('manufacturing-alerts-priority', alert),
            processCriticalAlert(alert, anomaly)
          ]).then(() => {}) // Void return for consistency
        );
      }
    }

    // Execute critical alert publishing immediately
    if (criticalAlerts.length > 0) {
      await Promise.all(criticalAlerts);
    }

    // BACKGROUND TASKS: Multi-tier storage and regular data publishing (non-blocking)
    // These operations are important but don't affect alert latency
    Promise.all([
      // Multi-tier storage: TimescaleDB (30d TTL) + PostgreSQL + S3 archival
      storeSensorDataMultiTier(enrichedData, tenantContext),
      // Kafka publishing for downstream consumers
      publishSensorData('sensor-data', enrichedData)
    ]).then(([storageResult]) => {
      // Log storage success/failure for monitoring
      console.log(`Storage result: TS=${storageResult.timescale}, PG=${storageResult.postgres}, S3=${storageResult.s3}, latency=${storageResult.latency_ms}ms`);
    }).catch(error => {
      console.error('Background storage error (non-critical):', error);
    });

    const totalLatency = Date.now() - startTime;
    console.log(`Processed sensor data for equipment: ${sensorData.equipment_id} in ${totalLatency}ms`);

    return createSuccessResponse({
      message: 'Sensor data ingested successfully',
      equipment_id: sensorData.equipment_id,
      timestamp: enrichedData.ingestionTimestamp,
      anomalies_detected: anomalies.length,
      alerts_created: anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length,
      processing_latency_ms: totalLatency,
      sla_compliant: totalLatency < 500
    });

  } catch (error) {
    console.error('Error processing sensor data:', error);
    return createErrorResponse(500, 'Internal server error', [
      error instanceof Error ? error.message : 'Unknown error'
    ]);
  }
  });
};

function validateSensorData(data: any): ValidationResult {
  const errors: string[] = [];
  
  if (!data.equipment_id) errors.push('equipment_id is required');
  if (!data.timestamp) errors.push('timestamp is required');
  
  // Validate timestamp format
  if (data.timestamp && isNaN(Date.parse(data.timestamp))) {
    errors.push('timestamp must be a valid ISO string');
  }

  // Validate numeric fields
  if (data.temperature !== undefined && typeof data.temperature !== 'number') {
    errors.push('temperature must be a number');
  }
  if (data.vibration !== undefined && typeof data.vibration !== 'number') {
    errors.push('vibration must be a number');
  }
  if (data.pressure !== undefined && typeof data.pressure !== 'number') {
    errors.push('pressure must be a number');
  }
  if (data.power_consumption !== undefined && typeof data.power_consumption !== 'number') {
    errors.push('power_consumption must be a number');
  }

  // Range validation
  if (data.temperature !== undefined && (data.temperature < -273 || data.temperature > 1000)) {
    errors.push('temperature out of valid range (-273 to 1000)');
  }
  
  if (data.vibration !== undefined && (data.vibration < 0 || data.vibration > 100)) {
    errors.push('vibration out of valid range (0 to 100)');
  }

  if (data.pressure !== undefined && (data.pressure < 0 || data.pressure > 10000)) {
    errors.push('pressure out of valid range (0 to 10000)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function createSuccessResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    } as ApiResponse<typeof data>)
  };
}

function createErrorResponse(statusCode: number, error: string, details?: string[]): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: false,
      error,
      details,
      timestamp: new Date().toISOString()
    } as ApiResponse<null>)
  };
}