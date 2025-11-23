import { 
  SensorData, Anomaly,
  UltraFastAlert, FastAlertEvent, FastAlertResult
} from '../../models';

// Ultra-fast direct alert processor for Kinesis/EventBridge
export const handler = async (event: FastAlertEvent): Promise<FastAlertResult> => {
  const startTime = Date.now();
  
  try {
    let sensorData: SensorData;
    
    // Handle different event sources with minimal overhead
    if (event.Records && event.Records[0]?.kinesis) {
      // Kinesis stream event (fastest path)
      const record = event.Records[0];
      const data = Buffer.from(record.kinesis!.data, 'base64').toString();
      sensorData = JSON.parse(data);
    } else if (event.body) {
      // Direct invocation
      sensorData = JSON.parse(event.body);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid event format' })
      };
    }

    // ULTRA-FAST anomaly detection (inline for minimum latency)
    const alerts = detectCriticalAnomaliesInline(sensorData, startTime);
    
    // Immediately dispatch to multiple alert channels
    const alertPromises = alerts.map(alert => dispatchAlert(alert));
    
    // Fire and forget - don't wait for all alerts
    Promise.all(alertPromises).catch(error => {
      console.error('Alert dispatch error (non-blocking):', error);
    });
    
    const totalLatency = Date.now() - startTime;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        alerts_processed: alerts.length,
        processing_latency_ms: totalLatency,
        sla_compliant: totalLatency < 500,
        timestamp: Date.now()
      })
    };
    
  } catch (error) {
    console.error('Fast alert handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Processing failed',
        latency_ms: Date.now() - startTime 
      })
    };
  }
};

// Inline critical anomaly detection (no function calls for speed)
function detectCriticalAnomaliesInline(data: SensorData, startTime: number): UltraFastAlert[] {
  const alerts: UltraFastAlert[] = [];
  const { equipment_id, temperature, vibration, pressure, timestamp } = data;
  
  // Critical temperature (>180°C)
  if (temperature !== undefined && temperature > 180) {
    alerts.push({
      alert_id: generateFastUUID(),
      equipment_id,
      type: 'critical_temperature',
      severity: 'critical',
      message: `CRITICAL: Temperature ${temperature}°C exceeds limit`,
      timestamp,
      processing_latency_ms: Date.now() - startTime
    });
  }
  
  // Critical vibration (>5.0)
  if (vibration !== undefined && vibration > 5.0) {
    alerts.push({
      alert_id: generateFastUUID(),
      equipment_id,
      type: 'critical_vibration',
      severity: 'critical',
      message: `CRITICAL: Vibration ${vibration} exceeds limit`,
      timestamp,
      processing_latency_ms: Date.now() - startTime
    });
  }
  
  // Critical pressure (>800 PSI)
  if (pressure !== undefined && pressure > 800) {
    alerts.push({
      alert_id: generateFastUUID(),
      equipment_id,
      type: 'critical_pressure',
      severity: 'critical',
      message: `CRITICAL: Pressure ${pressure} PSI exceeds limit`,
      timestamp,
      processing_latency_ms: Date.now() - startTime
    });
  }
  
  return alerts;
}

// Ultra-fast alert dispatch to multiple channels
async function dispatchAlert(alert: UltraFastAlert): Promise<void> {
  const alertPayload = JSON.stringify(alert);
  
  // Dispatch to multiple channels in parallel (fire-and-forget)
  const dispatches = [
    // SNS for immediate notifications
    publishToSNS(alertPayload),
    // EventBridge for workflow automation
    publishToEventBridge(alert),
    // WebSocket for real-time UI updates
    publishToWebSocket(alert)
  ];
  
  // Don't wait - fire and forget for maximum speed
  Promise.allSettled(dispatches).catch(() => {
    // Silently handle errors to maintain speed
  });
}

// Fast UUID generation (simpler than crypto)
function generateFastUUID(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Placeholder functions for alert dispatch
async function publishToSNS(payload: string): Promise<void> {
  // Implementation would use AWS SDK SNS
  console.log('SNS dispatch:', payload.length, 'bytes');
}

async function publishToEventBridge(alert: UltraFastAlert): Promise<void> {
  // Implementation would use AWS SDK EventBridge
  console.log('EventBridge dispatch:', alert.alert_id);
}

async function publishToWebSocket(alert: UltraFastAlert): Promise<void> {
  // Implementation would use API Gateway WebSocket
  console.log('WebSocket dispatch:', alert.equipment_id);
}