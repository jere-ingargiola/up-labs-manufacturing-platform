# Manufacturing Platform API Documentation

## Overview

The Manufacturing Platform provides real-time sensor data ingestion, anomaly detection, and alert management for industrial IoT environments. The platform supports multi-tenant architecture and provides sub-500ms processing SLAs.

## Base URL

```
https://8kzteo36k5.execute-api.us-east-1.amazonaws.com/development/
```

## Authentication

All API endpoints require API Key authentication:

```http
X-API-Key: pXEp91qpcp3vPAvoS0mF61wcZ0jR5l1M2F2gnC52
```

## Multi-Tenancy

All requests must include a tenant identifier:

```http
X-Tenant-ID: acme-corp
```

## Rate Limits

- **Daily Quota:** 100,000 requests per API key
- **Rate Limit:** 1,000 requests/second
- **Burst Limit:** 2,000 requests

## Endpoints

### 1. Sensor Data Ingestion

Ingest real-time sensor data from manufacturing equipment.

#### POST `/webhook/events`

**Headers:**
```http
Content-Type: application/json
X-API-Key: {api_key}
X-Tenant-ID: {tenant_id}
```

**Request Body:**
```json
{
  "equipment_id": "FURNACE_003",
  "timestamp": "2025-11-24T19:30:00.000Z",
  "temperature": 195.7,
  "vibration": 1.1,
  "pressure": 150,
  "power_consumption": 3200,
  "facility_id": "FAC_DETROIT_02",
  "line_id": "LINE_B"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Sensor data ingested successfully",
    "equipment_id": "FURNACE_003",
    "timestamp": "2025-11-24T19:30:00.000Z",
    "anomalies_detected": 1,
    "alerts_created": 1,
    "processing_latency_ms": 245,
    "sla_compliant": true
  },
  "timestamp": "2025-11-24T19:30:00.245Z"
}
```

**Validation Rules:**
- `equipment_id`: Required, alphanumeric string
- `timestamp`: Required, ISO 8601 format
- `temperature`: Optional, number (-273 to 1000)
- `vibration`: Optional, number (0 to 100)
- `pressure`: Optional, number (0 to 10000)
- `power_consumption`: Optional, positive number

#### POST `/data`

Alternative endpoint for sensor data ingestion (same format as `/webhook/events`).

### 2. Equipment Status

Get real-time status of manufacturing equipment.

#### GET `/equipment/status`

Get status of all equipment for the tenant.

#### GET `/equipment/{equipmentId}`

Get status of specific equipment.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "equipment_id": "FURNACE_003",
    "status": "operational",
    "last_reading": "2025-11-24T19:30:00.000Z",
    "alerts_count": 2,
    "facility_id": "FAC_DETROIT_02"
  }
}
```

### 3. Equipment Metrics

Get historical metrics and analytics.

#### GET `/equipment/metrics`

Get aggregated metrics for all equipment.

#### GET `/equipment/{equipmentId}/metrics`

Get historical metrics for specific equipment.

**Query Parameters:**
- `start_time`: ISO 8601 timestamp
- `end_time`: ISO 8601 timestamp
- `interval`: Aggregation interval (1m, 5m, 1h, 1d)

### 4. Alerts Management

#### GET `/alerts`

Get alert history for the tenant.

#### POST `/alerts`

Create or acknowledge alerts.

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid JSON format",
  "details": ["Malformed JSON payload"],
  "timestamp": "2025-11-24T19:30:00.000Z"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden",
  "details": ["Invalid API key"],
  "timestamp": "2025-11-24T19:30:00.000Z"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "details": ["Processing error"],
  "timestamp": "2025-11-24T19:30:00.000Z"
}
```

## Anomaly Detection

The platform automatically detects anomalies in sensor data:

### Critical Thresholds
- **Temperature:** > 180°C or < -50°C
- **Vibration:** > 5.0 units
- **Pressure:** > 500 PSI or < 10 PSI

### Alert Severity Levels
- **Critical:** Immediate safety risk, requires immediate action
- **High:** Performance degradation, requires attention within 1 hour
- **Medium:** Minor deviation, monitor closely
- **Low:** Information only

## Real-time Notifications

Critical and high severity alerts trigger:
- SNS email notifications
- CloudWatch metrics
- Kafka event publishing

## Data Architecture

### Storage Tiers
1. **TimescaleDB:** Real-time data (30-day TTL)
2. **PostgreSQL:** Persistent metadata and configurations
3. **S3:** Long-term archival with lifecycle management

### S3 Folder Structure
```
s3://bucket/{facility_id}/{equipment_id}/{year}/{month}/{day}/{hour}/
```

Example:
```
s3://manufacturing-platform-archival/FAC_DETROIT_02/FURNACE_003/2025/11/24/19/2025-11-24T19:30:00.000Z.json
```

## SLA Commitments

- **Processing Latency:** < 500ms for sensor data ingestion
- **Alert Delivery:** < 30 seconds for critical alerts
- **Uptime:** 99.9% availability
- **Data Durability:** 99.999999999% (11 9's) via S3

## SDK Examples

### cURL
```bash
curl -X POST https://8kzteo36k5.execute-api.us-east-1.amazonaws.com/development/webhook/events \
  -H "X-API-Key: pXEp91qpcp3vPAvoS0mF61wcZ0jR5l1M2F2gnC52" \
  -H "X-Tenant-ID: acme-corp" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "FURNACE_003",
    "timestamp": "2025-11-24T19:30:00.000Z",
    "temperature": 195.7,
    "facility_id": "FAC_DETROIT_02"
  }'
```

### Python
```python
import requests

headers = {
    'X-API-Key': 'pXEp91qpcp3vPAvoS0mF61wcZ0jR5l1M2F2gnC52',
    'X-Tenant-ID': 'acme-corp',
    'Content-Type': 'application/json'
}

data = {
    'equipment_id': 'FURNACE_003',
    'timestamp': '2025-11-24T19:30:00.000Z',
    'temperature': 195.7,
    'facility_id': 'FAC_DETROIT_02'
}

response = requests.post(
    'https://8kzteo36k5.execute-api.us-east-1.amazonaws.com/development/webhook/events',
    headers=headers,
    json=data
)
```

### Node.js
```javascript
const axios = require('axios');

const response = await axios.post(
  'https://8kzteo36k5.execute-api.us-east-1.amazonaws.com/development/webhook/events',
  {
    equipment_id: 'FURNACE_003',
    timestamp: '2025-11-24T19:30:00.000Z',
    temperature: 195.7,
    facility_id: 'FAC_DETROIT_02'
  },
  {
    headers: {
      'X-API-Key': 'pXEp91qpcp3vPAvoS0mF61wcZ0jR5l1M2F2gnC52',
      'X-Tenant-ID': 'acme-corp',
      'Content-Type': 'application/json'
    }
  }
);
```

## Support

For technical support and API questions, contact the platform team.