// Alert and Notification Related Interfaces

export interface UltraFastAlert {
  alert_id: string;
  equipment_id: string;
  type: string;
  severity: 'critical' | 'high';
  message: string;
  timestamp: string;
  processing_latency_ms: number;
}

export interface AlertNotificationResult {
  success: boolean;
  channels_notified: string[];
  latency_ms: number;
  error?: string;
}

export interface CloudWatchMetric {
  namespace: string;
  metric_name: string;
  value: number;
  unit: string;
  dimensions?: Record<string, string>;
  timestamp?: string;
}

export interface SNSNotification {
  topic_arn: string;
  message: string;
  subject?: string;
  attributes?: Record<string, string>;
}

export interface FastAlertEvent {
  body?: string;
  Records?: Array<{
    kinesis?: {
      data: string;
    };
    eventSource?: string;
  }>;
}

export interface FastAlertResult {
  statusCode: number;
  body: string;
}