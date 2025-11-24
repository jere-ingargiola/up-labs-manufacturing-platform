# 🧪 Sensor Data Handler Test Suite

## Overview

Comprehensive test events for the `ingestSensorData` Lambda handler covering all KPI tolerance scenarios.

## 📋 Test Scenarios Created

### ✅ **Normal Operations**

- **Normal Data**: All KPIs within tolerance ranges
- **Minimal Valid**: Only required fields (equipment_id, timestamp)  
- **Full Payload**: All fields including custom metrics

### 🔥 **Temperature Scenarios**

- **Critical Temperature**: >180°C → Critical alerts
- **High Temperature**: 150-180°C → High priority alerts
- **Low Temperature**: <0°C → Medium severity anomalies

### 🌀 **Vibration Scenarios**  

- **Critical Vibration**: >5.0 → Critical alerts
- **High Vibration**: 2.0-5.0 → High priority alerts

### 💨 **Pressure Scenarios**

- **Critical Pressure**: >800 PSI → Critical alerts (but anomaly service marks as medium)
- **High Pressure**: >500 PSI → Medium anomalies
- **Low Pressure**: <50 PSI → Medium anomalies

### 💥 **Edge Cases**

- **Multiple Critical**: All KPIs out of tolerance simultaneously
- **Invalid Data**: Missing required fields
- **Malformed JSON**: Syntax errors in payload

---

## 🚀 **Usage Options**

### 1. **Quick Test Runner**

```bash
cd /home/jere/up-labs-manufacturing-platform/lambdas/ingestSensorData

# Test specific scenarios
./testRunner.js normal          # Normal operations
./testRunner.js temp           # Critical temperature
./testRunner.js vibration      # Critical vibration  
./testRunner.js pressure       # Critical pressure
./testRunner.js multi          # Multiple critical alerts

# Run all scenarios
./testRunner.js all
./testRunner.js               # (no args = run all)
```

### 2. **Jest Test Suite**

```bash
cd /home/jere/up-labs-manufacturing-platform

# Run the comprehensive test suite
npm test -- lambdas/ingestSensorData/handler.test.ts

# Run with coverage
npm test -- --coverage lambdas/ingestSensorData/handler.test.ts
```

### 3. **Import in Code**

```typescript
import { 
  normalSensorDataEvent,
  criticalTemperatureEvent,
  multipleCriticalEvent,
  executeTestScenario,
  runAllTests
} from './sampleEvents';

// Test individual event
const result = await handler(criticalTemperatureEvent);

// Run scenario with logging
await executeTestScenario('Critical Temperature', criticalTemperatureEvent);

// Batch test execution
const results = await runAllTests();
```

---

## 📊 **KPI Tolerance Reference**

| **Metric** | **Normal Range** | **High Alert** | **Critical Alert** |
|------------|------------------|----------------|-------------------|
| **Temperature** | 0°C - 150°C | 150°C - 180°C | >180°C |
| **Vibration** | 0 - 2.0 | 2.0 - 5.0 | >5.0 |
| **Pressure** | 50 - 500 PSI | >500 PSI (medium) | >800 PSI |
| **Power** | No thresholds defined | - | - |

---

## 🎯 **Sample Event Structure**

```typescript
// Normal operation example
const normalEvent: APIGatewayProxyEvent = {
  body: JSON.stringify({
    equipment_id: 'PUMP_001',
    timestamp: '2024-11-23T10:30:00.000Z',
    temperature: 75.5,     // ✅ Normal: 0-150°C
    vibration: 1.2,        // ✅ Normal: 0-2.0
    pressure: 250.8,       // ✅ Normal: 50-500 PSI
    power_consumption: 1250.5,
    facility_id: 'FAC_CHICAGO_01',
    line_id: 'LINE_A'
  }),
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': 'acme-corp'
  },
  // ... standard API Gateway structure
};

// Critical scenario example  
const criticalEvent: APIGatewayProxyEvent = {
  body: JSON.stringify({
    equipment_id: 'REACTOR_001', 
    timestamp: '2024-11-23T10:39:00.000Z',
    temperature: 205.9,    // 🔥 CRITICAL: >180°C
    vibration: 8.2,        // 🔥 CRITICAL: >5.0
    pressure: 1150.0,      // 🔥 CRITICAL: >800 PSI
    power_consumption: 7800.0
  }),
  // ... same headers and structure
};
```

---

## 📈 **Expected Responses**

### ✅ **Success Response** (200)

```json
{
  "success": true,
  "data": {
    "message": "Sensor data ingested successfully",
    "equipment_id": "PUMP_001",
    "timestamp": "2024-11-23T10:30:00.123Z",
    "anomalies_detected": 0,
    "alerts_created": 0,
    "processing_latency_ms": 45,
    "sla_compliant": true
  },
  "timestamp": "2024-11-23T10:30:00.123Z"
}
```

### 🚨 **Critical Alert Response** (200)

```json
{
  "success": true, 
  "data": {
    "message": "Sensor data ingested successfully",
    "equipment_id": "REACTOR_001",
    "timestamp": "2024-11-23T10:39:00.456Z", 
    "anomalies_detected": 3,
    "alerts_created": 3,
    "processing_latency_ms": 125,
    "sla_compliant": true
  },
  "timestamp": "2024-11-23T10:39:00.456Z"
}
```

### ❌ **Error Response** (400/500)

```json
{
  "success": false,
  "error": "Missing required fields: equipment_id, timestamp",
  "details": ["equipment_id is required", "timestamp is required"],
  "timestamp": "2024-11-23T10:30:00.789Z"
}
```

---

## 🎛️ **Testing Features**

- **✅ Performance Testing**: Validates <500ms SLA compliance
- **🔒 Error Handling**: Tests malformed JSON, missing fields
- **📊 Multi-Tenant**: Includes tenant context headers
- **⚡ Async Operations**: Tests critical alert processing
- **🧪 Mocked Services**: Safe testing without AWS calls
- **📈 Comprehensive Coverage**: 17+ test scenarios
- **🎯 Real-World Data**: Production-like sensor readings

---

## 🔍 **Debugging Tips**

1. **Check Handler Logs**: Look for console.log output during tests
2. **Validate Thresholds**: Ensure anomaly detection thresholds match expectations
3. **Monitor Performance**: Watch processing_latency_ms in responses
4. **Test Edge Cases**: Use invalid/malformed event samples
5. **Verify Alerts**: Check that critical/high severity anomalies trigger alerts

---

*Generated: ${new Date().toISOString()}*  
*Test Coverage: 17 scenarios across all KPI tolerance ranges*  
*Performance Target: <500ms processing latency*
