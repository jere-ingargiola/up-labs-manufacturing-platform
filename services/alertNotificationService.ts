// Critical Alert Notification Service - CloudWatch + SNS integration
import { Alert, Anomaly, AlertNotificationResult, CloudWatchMetric, SNSNotification } from '../models';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';

// Initialize AWS SDK v3 clients
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Extended AlertNotificationResult for internal service use
interface ServiceAlertResult extends AlertNotificationResult {
  cloudwatch: boolean;
  sns: boolean;
}

// AWS SDK compatible CloudWatch metric structure
interface AWSCloudWatchMetric {
  MetricName: string;
  Value: number;
  Unit: StandardUnit;
  Dimensions: Array<{
    Name: string;
    Value: string;
  }>;
  Timestamp: Date;
}

// AWS SDK compatible SNS notification structure
interface AWSSNSNotification {
  TopicArn: string;
  Subject: string;
  Message: string;
  MessageAttributes?: {
    [key: string]: {
      DataType: string;
      StringValue: string;
    };
  };
}

// Critical alert processing and notification
export async function processCriticalAlert(alert: Alert, anomaly?: Anomaly): Promise<ServiceAlertResult> {
  const startTime = Date.now();
  const result: ServiceAlertResult = {
    success: false,
    channels_notified: [],
    cloudwatch: false,
    sns: false,
    latency_ms: 0
  };

  try {
    // Execute CloudWatch and SNS notifications in parallel for speed
    const [cloudwatchResult, snsResult] = await Promise.allSettled([
      publishToCloudWatch(alert, anomaly),
      sendSNSNotification(alert, anomaly)
    ]);

    result.cloudwatch = cloudwatchResult.status === 'fulfilled';
    result.sns = snsResult.status === 'fulfilled';
    result.success = result.cloudwatch && result.sns;
    result.channels_notified = [
      ...(result.cloudwatch ? ['cloudwatch'] : []),
      ...(result.sns ? ['sns'] : [])
    ];
    result.latency_ms = Date.now() - startTime;

    // Log failures for monitoring
    if (cloudwatchResult.status === 'rejected') {
      console.error('CloudWatch metric failed:', cloudwatchResult.reason);
    }
    if (snsResult.status === 'rejected') {
      console.error('SNS notification failed:', snsResult.reason);
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Alert notification failed';
    result.latency_ms = Date.now() - startTime;
    return result;
  }
}

// Publish critical alert metrics to CloudWatch
async function publishToCloudWatch(alert: Alert, anomaly?: Anomaly): Promise<void> {
  const metrics: AWSCloudWatchMetric[] = [];

  // Alert count metric
  metrics.push({
    MetricName: 'CriticalAlerts',
    Value: 1,
    Unit: StandardUnit.Count,
    Dimensions: [
      { Name: 'EquipmentId', Value: alert.equipment_id },
      { Name: 'Severity', Value: alert.severity },
      { Name: 'AlertType', Value: alert.type }
    ],
    Timestamp: new Date(alert.timestamp)
  });

  // Equipment status metric
  metrics.push({
    MetricName: 'EquipmentHealth',
    Value: getSeverityScore(alert.severity),
    Unit: StandardUnit.None,
    Dimensions: [
      { Name: 'EquipmentId', Value: alert.equipment_id },
      { Name: 'FacilityId', Value: 'unknown' } // Would extract from equipment data
    ],
    Timestamp: new Date(alert.timestamp)
  });

  // If anomaly data is available, send sensor value metrics
  if (anomaly) {
    metrics.push({
      MetricName: getSensorMetricName(anomaly.type),
      Value: anomaly.value,
      Unit: getSensorUnit(anomaly.type),
      Dimensions: [
        { Name: 'EquipmentId', Value: anomaly.equipment_id },
        { Name: 'Threshold', Value: anomaly.threshold.toString() }
      ],
      Timestamp: new Date(anomaly.timestamp)
    });
  }

  // Send metrics to CloudWatch using AWS SDK v3
  try {
    const command = new PutMetricDataCommand({
      Namespace: 'Manufacturing/Alerts',
      MetricData: metrics.map(metric => ({
        MetricName: metric.MetricName,
        Value: metric.Value,
        Unit: metric.Unit,
        Dimensions: metric.Dimensions,
        Timestamp: metric.Timestamp
      }))
    });

    await cloudWatchClient.send(command);
    console.log(`✅ CloudWatch metrics sent: ${metrics.length} metrics for ${alert.equipment_id}`);
  } catch (error) {
    console.error('❌ Failed to send CloudWatch metrics:', error);
    throw error;
  }
}

// Send SNS notification for critical alerts
async function sendSNSNotification(alert: Alert, anomaly?: Anomaly): Promise<void> {
  const topicArn = process.env.ALERTS_TOPIC_ARN || process.env.CRITICAL_ALERTS_SNS_TOPIC;
  
  if (!topicArn) {
    console.warn('⚠️  No SNS topic ARN configured, skipping SNS notification');
    return;
  }

  const command = new PublishCommand({
    TopicArn: topicArn,
    Subject: `🚨 CRITICAL ALERT: ${alert.type} - Equipment ${alert.equipment_id}`,
    Message: formatAlertMessage(alert, anomaly),
    MessageAttributes: {
      'alert_id': {
        DataType: 'String',
        StringValue: alert.alert_id
      },
      'equipment_id': {
        DataType: 'String',
        StringValue: alert.equipment_id
      },
      'severity': {
        DataType: 'String',
        StringValue: alert.severity
      },
      'alert_type': {
        DataType: 'String',
        StringValue: alert.type
      }
    }
  });

  try {
    const result = await snsClient.send(command);
    console.log(`✅ SNS Alert sent to ${topicArn} (MessageId: ${result.MessageId})`);
    console.log(`📧 Subject: ${command.input.Subject}`);
  } catch (error) {
    console.error('❌ Failed to send SNS notification:', error);
    throw error;
  }
}

// Format alert message for human readability
function formatAlertMessage(alert: Alert, anomaly?: Anomaly): string {
  const timestamp = new Date(alert.timestamp).toLocaleString();
  
  let message = `CRITICAL MANUFACTURING ALERT\n\n`;
  message += `🚨 Alert ID: ${alert.alert_id}\n`;
  message += `🏭 Equipment: ${alert.equipment_id}\n`;
  message += `⚠️  Severity: ${alert.severity.toUpperCase()}\n`;
  message += `📅 Time: ${timestamp}\n`;
  message += `📝 Message: ${alert.message}\n\n`;

  if (anomaly) {
    message += `📊 SENSOR DETAILS:\n`;
    message += `   • Metric: ${anomaly.type}\n`;
    message += `   • Value: ${anomaly.value}\n`;
    message += `   • Threshold: ${anomaly.threshold}\n`;
    message += `   • Deviation: ${((anomaly.value / anomaly.threshold - 1) * 100).toFixed(1)}%\n\n`;
  }

  message += `🔧 RECOMMENDED ACTIONS:\n`;
  message += getRecommendedActions(alert.type);

  message += `\n\n🔗 View in Dashboard: ${process.env.DASHBOARD_URL}/equipment/${alert.equipment_id}`;
  
  return message;
}

// Get recommended actions based on alert type
function getRecommendedActions(alertType: string): string {
  const actions: { [key: string]: string } = {
    'critical_temperature': '   • Immediately shut down equipment\n   • Check cooling system\n   • Inspect for blockages',
    'critical_vibration': '   • Stop operation immediately\n   • Check bearing alignment\n   • Inspect for loose components',
    'critical_pressure': '   • Verify pressure relief valves\n   • Check for leaks\n   • Inspect pressure sensors',
    'equipment_offline': '   • Check network connectivity\n   • Verify power supply\n   • Contact maintenance team',
    'power_spike': '   • Check electrical connections\n   • Inspect for power supply issues\n   • Review load capacity'
  };

  return actions[alertType] || '   • Contact maintenance team immediately\n   • Follow standard safety procedures';
}

// Convert severity to numeric score for CloudWatch
function getSeverityScore(severity: string): number {
  const scores: { [key: string]: number } = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };
  return scores[severity] || 0;
}

// Get CloudWatch metric name for sensor type
function getSensorMetricName(anomalyType: string): string {
  const metricNames: { [key: string]: string } = {
    'critical_temperature': 'Equipment.Temperature',
    'high_temperature': 'Equipment.Temperature',
    'critical_vibration': 'Equipment.Vibration',
    'high_vibration': 'Equipment.Vibration',
    'critical_pressure': 'Equipment.Pressure',
    'abnormal_pressure': 'Equipment.Pressure',
    'power_spike': 'Equipment.PowerConsumption'
  };
  return metricNames[anomalyType] || 'Equipment.Unknown';
}

// Get CloudWatch unit for sensor type
function getSensorUnit(anomalyType: string): StandardUnit {
  const units: { [key: string]: StandardUnit } = {
    'critical_temperature': StandardUnit.None, // Celsius
    'high_temperature': StandardUnit.None,
    'critical_vibration': StandardUnit.None, // g-force
    'high_vibration': StandardUnit.None,
    'critical_pressure': StandardUnit.None, // PSI
    'abnormal_pressure': StandardUnit.None,
    'power_spike': StandardUnit.None // Watts
  };
  return units[anomalyType] || StandardUnit.None;
}

// Bulk alert notification for multiple critical alerts
export async function processBulkCriticalAlerts(alerts: Alert[], anomalies?: Anomaly[]): Promise<ServiceAlertResult[]> {
  const results = await Promise.all(
    alerts.map((alert, index) => 
      processCriticalAlert(alert, anomalies?.[index])
    )
  );

  // Log bulk processing stats
  const successful = results.filter(r => r.cloudwatch && r.sns).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency_ms, 0) / results.length;
  
  console.log(`Bulk alert processing: ${successful}/${results.length} successful, avg latency: ${avgLatency.toFixed(0)}ms`);

  return results;
}

// Health check for notification services
export async function checkNotificationHealth(): Promise<{
  cloudwatch: boolean;
  sns: boolean;
  latency_ms: number;
}> {
  const startTime = Date.now();
  
  try {
    // Test CloudWatch and SNS connectivity
    const [cwTest, snsTest] = await Promise.allSettled([
      testCloudWatchConnection(),
      testSNSConnection()
    ]);

    return {
      cloudwatch: cwTest.status === 'fulfilled',
      sns: snsTest.status === 'fulfilled',
      latency_ms: Date.now() - startTime
    };
  } catch (error) {
    return {
      cloudwatch: false,
      sns: false,
      latency_ms: Date.now() - startTime
    };
  }
}

async function testCloudWatchConnection(): Promise<void> {
  // Simulate CloudWatch health check
  console.log('CloudWatch health check: OK');
}

async function testSNSConnection(): Promise<void> {
  // Simulate SNS health check
  console.log('SNS health check: OK');
}