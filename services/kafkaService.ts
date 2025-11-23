// Kafka producer service for publishing sensor data to MSK

import { Kafka, Producer } from 'kafkajs';

let producer: Producer | null = null;

// Initialize Kafka producer with AWS MSK configuration
async function getKafkaProducer(): Promise<Producer> {
  if (producer) {
    return producer;
  }

  const kafka = new Kafka({
    clientId: 'manufacturing-platform',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    ssl: process.env.NODE_ENV === 'production',
    sasl: process.env.NODE_ENV === 'production' ? {
      mechanism: 'aws',
      authorizationIdentity: process.env.AWS_ACCESS_KEY_ID!,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined,
    // Ultra-low latency optimizations
    connectionTimeout: 1000,
    requestTimeout: 5000,
    retry: {
      retries: 2,
      initialRetryTime: 100,
      maxRetryTime: 1000
    }
  });

  producer = kafka.producer({
    // Optimized for minimum latency
    maxInFlightRequests: 10, // Increased for better throughput
    idempotent: false, // Disable for speed (alerts are time-sensitive)
    transactionTimeout: 5000, // Reduced timeout
    // Critical latency optimizations
    allowAutoTopicCreation: false
  });

  await producer.connect();
  console.log('Kafka producer connected successfully');
  
  return producer;
}

export async function publishSensorData(topic: string, data: any): Promise<void> {
  try {
    const producer = await getKafkaProducer();

    const message = {
      topic,
      messages: [{
        key: data.equipment_id || 'unknown',
        value: JSON.stringify(data),
        timestamp: Date.now().toString()
      }],
      acks: 1, // Only wait for leader acknowledgment
      compression: 0 // No compression for speed
    };

    await producer.send(message);
  } catch (error) {
    console.error('Error publishing to Kafka:', error);
    throw error;
  }
}

export async function publishAlert(topic: string, alert: any): Promise<void> {
  try {
    const producer = await getKafkaProducer();
    
    // ULTRA-FAST PATH: Minimal message structure for maximum speed
    const message = {
      topic,
      messages: [{
        key: alert.equipment_id,
        value: JSON.stringify({
          alert_id: alert.alert_id,
          equipment_id: alert.equipment_id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          processing_latency_ms: alert.processing_latency_ms,
          published_at: Date.now() // Use number for speed, not ISO string
        }),
        timestamp: Date.now().toString(),
        headers: {
          'severity': alert.severity,
          'equipment_id': alert.equipment_id
        }
      }],
      acks: 1, // Only wait for leader acknowledgment
      compression: 0 // No compression for speed
    };

    // Fire-and-forget for critical alerts (don't wait for confirmation)
    if (alert.severity === 'critical') {
      producer.send(message).catch(error => {
        console.error('Critical alert publish failed (async):', error);
      });
      return; // Return immediately for critical alerts
    }

    // For high/medium alerts, still wait for confirmation but with timeout
    await Promise.race([
      producer.send(message),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Kafka timeout')), 100))
    ]);
    
  } catch (error) {
    console.error('Failed to publish alert:', error);
    // Don't throw for alerts - alerting should be resilient
  }
}

// Graceful shutdown
export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log('Kafka producer disconnected');
  }
}

// Handle Lambda cold start cleanup
process.on('beforeExit', async () => {
  await disconnectKafka();
});