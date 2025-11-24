/**
 * Sample APIGatewayProxyEvent objects for testing the ingestSensorData handler
 * 
 * Thresholds from anomalyService.ts:
 * - Temperature: Normal (0-150°C), High (>150°C), Critical (>180°C)
 * - Vibration: Normal (0-2.0), High (>2.0), Critical (>5.0)  
 * - Pressure: Normal (50-500 PSI), Medium anomaly (<50 or >500), Critical (>800 PSI)
 * - Power: No thresholds defined in anomaly service
 */

import { APIGatewayProxyEvent } from '../../models';

// Base event template for consistency
const createBaseEvent = (body: string): APIGatewayProxyEvent => ({
  body,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sample-token',
    'x-tenant-id': 'acme-corp'
  },
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/v1/sensor-data',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: {},
  stageVariables: null,
  requestContext: {
    requestId: 'test-request-' + Date.now(),
    identity: {
      sourceIp: '192.168.1.100',
      userAgent: 'IoT-Device/1.0'
    },
    httpMethod: 'POST',
    resourcePath: '/v1/sensor-data',
    stage: 'prod'
  },
  resource: '/v1/sensor-data'
});

// 1. ✅ NORMAL - All KPIs within tolerance
export const normalSensorDataEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'PUMP_001',
  timestamp: '2025-11-23T10:30:00.000Z',
  temperature: 75.5,          // ✅ Normal: 0-150°C
  vibration: 1.2,             // ✅ Normal: 0-2.0
  pressure: 250.8,            // ✅ Normal: 50-500 PSI
  power_consumption: 1250.5,   // ✅ No threshold defined
  facility_id: 'FAC_CHICAGO_01',
  line_id: 'LINE_A'
}));

// 2. 🔥 CRITICAL TEMPERATURE - Temperature > 180°C
export const criticalTemperatureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'FURNACE_003',
  timestamp: '2025-11-23T10:31:00.000Z',
  temperature: 195.7,          // 🔥 CRITICAL: >180°C
  vibration: 1.1,             // ✅ Normal
  pressure: 150.0,            // ✅ Normal
  power_consumption: 3200.0,   
  facility_id: 'FAC_DETROIT_02',
  line_id: 'LINE_B'
}));

// 3. ⚠️ HIGH TEMPERATURE - Temperature 150-180°C
export const highTemperatureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'BOILER_007',
  timestamp: '2025-11-23T10:32:00.000Z',
  temperature: 165.3,          // ⚠️ HIGH: 150-180°C
  vibration: 0.8,             // ✅ Normal
  pressure: 420.5,            // ✅ Normal
  power_consumption: 2100.0,
  facility_id: 'FAC_HOUSTON_03',
  line_id: 'LINE_C'
}));

// 4. 🧊 LOW TEMPERATURE - Temperature < 0°C
export const lowTemperatureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'FREEZER_002',
  timestamp: '2025-11-23T10:33:00.000Z',
  temperature: -15.2,          // 🧊 LOW: <0°C (medium severity)
  vibration: 0.3,             // ✅ Normal
  pressure: 120.0,            // ✅ Normal
  power_consumption: 890.0,
  facility_id: 'FAC_SEATTLE_04',
  line_id: 'LINE_D'
}));

// 5. 🔥 CRITICAL VIBRATION - Vibration > 5.0
export const criticalVibrationEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'TURBINE_005',
  timestamp: '2025-11-23T10:34:00.000Z',
  temperature: 85.0,          // ✅ Normal
  vibration: 7.8,             // 🔥 CRITICAL: >5.0
  pressure: 380.2,            // ✅ Normal
  power_consumption: 4500.0,
  facility_id: 'FAC_PHOENIX_05',
  line_id: 'LINE_E'
}));

// 6. ⚠️ HIGH VIBRATION - Vibration 2.0-5.0
export const highVibrationEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'MOTOR_012',
  timestamp: '2025-11-23T10:35:00.000Z',
  temperature: 45.8,          // ✅ Normal
  vibration: 3.4,             // ⚠️ HIGH: 2.0-5.0
  pressure: 290.0,            // ✅ Normal
  power_consumption: 1850.0,
  facility_id: 'FAC_ATLANTA_06',
  line_id: 'LINE_F'
}));

// 7. 🔥 CRITICAL PRESSURE - Pressure > 800 PSI
export const criticalPressureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'COMPRESSOR_009',
  timestamp: '2025-11-23T10:36:00.000Z',
  temperature: 120.5,         // ✅ Normal
  vibration: 1.8,             // ✅ Normal
  pressure: 925.7,            // 🔥 CRITICAL: >800 PSI
  power_consumption: 5200.0,
  facility_id: 'FAC_DALLAS_07',
  line_id: 'LINE_G'
}));

// 8. ⚠️ HIGH PRESSURE - Pressure > 500 PSI (but < 800 PSI)
export const highPressureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'HYDRAULIC_004',
  timestamp: '2025-11-23T10:37:00.000Z',
  temperature: 65.2,          // ✅ Normal
  vibration: 0.9,             // ✅ Normal
  pressure: 675.3,            // ⚠️ MEDIUM: >500 PSI
  power_consumption: 1950.0,
  facility_id: 'FAC_MIAMI_08',
  line_id: 'LINE_H'
}));

// 9. 🔻 LOW PRESSURE - Pressure < 50 PSI
export const lowPressureEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'VALVE_006',
  timestamp: '2025-11-23T10:38:00.000Z',
  temperature: 25.8,          // ✅ Normal
  vibration: 0.1,             // ✅ Normal
  pressure: 12.5,             // 🔻 MEDIUM: <50 PSI
  power_consumption: 45.0,
  facility_id: 'FAC_BOSTON_09',
  line_id: 'LINE_I'
}));

// 10. 💥 MULTIPLE CRITICAL - Multiple KPIs out of tolerance
export const multipleCriticalEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'REACTOR_001',
  timestamp: '2025-11-23T10:39:00.000Z',
  temperature: 205.9,         // 🔥 CRITICAL: >180°C
  vibration: 8.2,             // 🔥 CRITICAL: >5.0
  pressure: 1150.0,           // 🔥 CRITICAL: >800 PSI
  power_consumption: 7800.0,   // No threshold, but very high
  facility_id: 'FAC_NUCLEAR_10',
  line_id: 'LINE_CRITICAL'
}));

// 11. ❌ INVALID DATA - Missing required fields
export const invalidDataEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  // Missing equipment_id and timestamp (required fields)
  temperature: 85.0,
  vibration: 1.2,
  pressure: 250.0
}));

// 12. ❌ MALFORMED JSON - Invalid JSON payload
export const malformedJsonEvent: APIGatewayProxyEvent = createBaseEvent(
  '{ "equipment_id": "BROKEN_001", "timestamp": "2025-11-23T10:40:00.000Z", "temperature": 85.0, "invalid": }' // Missing value
);

// 13. 🎯 MINIMAL VALID - Only required fields
export const minimalValidEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'MINIMAL_001',
  timestamp: '2025-11-23T10:41:00.000Z'
  // No optional sensor readings
}));

// 14. 📊 FULL PAYLOAD - All possible fields
export const fullPayloadEvent: APIGatewayProxyEvent = createBaseEvent(JSON.stringify({
  equipment_id: 'FULL_SYSTEM_001',
  timestamp: '2025-11-23T10:42:00.000Z',
  temperature: 125.5,
  vibration: 1.8,
  pressure: 425.0,
  power_consumption: 2850.0,
  facility_id: 'FAC_COMPREHENSIVE_11',
  line_id: 'LINE_FULL_STACK',
  custom_metrics: {
    rpm: 1500,
    oil_level: 85.5,
    belt_tension: 95.2,
    efficiency_score: 0.94,
    maintenance_score: 'A+'
  }
}));

// Helper function to create test batch
export const createTestBatch = () => ([
  { name: 'Normal Operations', event: normalSensorDataEvent },
  { name: 'Critical Temperature', event: criticalTemperatureEvent },
  { name: 'High Temperature', event: highTemperatureEvent },
  { name: 'Low Temperature', event: lowTemperatureEvent },
  { name: 'Critical Vibration', event: criticalVibrationEvent },
  { name: 'High Vibration', event: highVibrationEvent },
  { name: 'Critical Pressure', event: criticalPressureEvent },
  { name: 'High Pressure', event: highPressureEvent },
  { name: 'Low Pressure', event: lowPressureEvent },
  { name: 'Multiple Critical Alerts', event: multipleCriticalEvent },
  { name: 'Invalid Data', event: invalidDataEvent },
  { name: 'Malformed JSON', event: malformedJsonEvent },
  { name: 'Minimal Valid', event: minimalValidEvent },
  { name: 'Full Payload', event: fullPayloadEvent }
]);

// Test execution helper
export const executeTestScenario = async (scenarioName: string, event: APIGatewayProxyEvent) => {
  console.log(`\n🧪 Testing: ${scenarioName}`);
  console.log('📥 Input:', JSON.parse(event.body || '{}'));
  
  try {
    // Import and execute handler
    const { handler } = await import('./handler');
    const result = await handler(event);
    
    console.log('📤 Response:', {
      statusCode: result.statusCode,
      body: JSON.parse(result.body)
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

// Batch test runner
export const runAllTests = async () => {
  const scenarios = createTestBatch();
  const results = [];
  
  for (const scenario of scenarios) {
    try {
      const result = await executeTestScenario(scenario.name, scenario.event);
      results.push({ scenario: scenario.name, success: true, result });
    } catch (error) {
      results.push({ scenario: scenario.name, success: false, error });
    }
  }
  
  console.log('\n📊 Test Summary:');
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.scenario}`);
  });
  
  return results;
};

/**
 * Usage Examples:
 * 
 * // Test individual scenario
 * import { executeTestScenario, criticalTemperatureEvent } from './sampleEvents';
 * await executeTestScenario('Critical Temperature Alert', criticalTemperatureEvent);
 * 
 * // Run all test scenarios
 * import { runAllTests } from './sampleEvents';
 * const results = await runAllTests();
 * 
 * // Use in Jest tests
 * import { normalSensorDataEvent, criticalVibrationEvent } from './sampleEvents';
 * describe('Sensor Data Handler', () => {
 *   test('processes normal data correctly', async () => {
 *     const result = await handler(normalSensorDataEvent);
 *     expect(result.statusCode).toBe(200);
 *   });
 * });
 */