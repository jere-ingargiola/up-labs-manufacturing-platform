// Anomaly detection service for real-time sensor data analysis

import { SensorData, Anomaly, AnomalyType } from '../models';

// Configurable thresholds for anomaly detection
const THRESHOLDS = {
  temperature: { min: 0, max: 150, criticalMax: 180 },
  vibration: { min: 0, max: 2.0, criticalMax: 5.0 },
  pressure: { min: 50, max: 500, criticalMax: 800 }
};

export async function detectAnomalies(sensorData: SensorData): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const { equipment_id, temperature, vibration, pressure, timestamp } = sensorData;

  // OPTIMIZED: Run all detections in parallel for minimum latency
  const detectionPromises: Promise<Anomaly[]>[] = [];

  if (temperature !== undefined) {
    detectionPromises.push(Promise.resolve(detectTemperatureAnomalies(equipment_id, temperature, timestamp)));
  }

  if (vibration !== undefined) {
    detectionPromises.push(Promise.resolve(detectVibrationAnomalies(equipment_id, vibration, timestamp)));
  }

  if (pressure !== undefined) {
    detectionPromises.push(Promise.resolve(detectPressureAnomalies(equipment_id, pressure, timestamp)));
  }

  // Execute all detections concurrently
  const results = await Promise.all(detectionPromises);
  results.forEach(result => anomalies.push(...result));

  // Minimal logging - only log critical anomalies to reduce latency
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  if (criticalAnomalies.length > 0) {
    console.log(`CRITICAL: ${criticalAnomalies.length} critical anomalies for equipment ${equipment_id}`);
  }

  return anomalies;
}

function detectTemperatureAnomalies(equipmentId: string, temperature: number, timestamp: string): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (temperature > THRESHOLDS.temperature.criticalMax) {
    anomalies.push({
      type: AnomalyType.CRITICAL_TEMPERATURE,
      equipment_id: equipmentId,
      timestamp,
      value: temperature,
      threshold: THRESHOLDS.temperature.criticalMax,
      severity: 'critical',
      message: `Critical temperature detected: ${temperature}°C (threshold: ${THRESHOLDS.temperature.criticalMax}°C)`
    });
  } else if (temperature > THRESHOLDS.temperature.max) {
    anomalies.push({
      type: AnomalyType.HIGH_TEMPERATURE,
      equipment_id: equipmentId,
      timestamp,
      value: temperature,
      threshold: THRESHOLDS.temperature.max,
      severity: 'high',
      message: `High temperature detected: ${temperature}°C (normal max: ${THRESHOLDS.temperature.max}°C)`
    });
  } else if (temperature < THRESHOLDS.temperature.min) {
    anomalies.push({
      type: AnomalyType.HIGH_TEMPERATURE, // Using existing enum, would add LOW_TEMPERATURE
      equipment_id: equipmentId,
      timestamp,
      value: temperature,
      threshold: THRESHOLDS.temperature.min,
      severity: 'medium',
      message: `Low temperature detected: ${temperature}°C (normal min: ${THRESHOLDS.temperature.min}°C)`
    });
  }

  return anomalies;
}

function detectVibrationAnomalies(equipmentId: string, vibration: number, timestamp: string): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (vibration > THRESHOLDS.vibration.criticalMax) {
    anomalies.push({
      type: AnomalyType.CRITICAL_VIBRATION,
      equipment_id: equipmentId,
      timestamp,
      value: vibration,
      threshold: THRESHOLDS.vibration.criticalMax,
      severity: 'critical',
      message: `Critical vibration detected: ${vibration} (threshold: ${THRESHOLDS.vibration.criticalMax})`
    });
  } else if (vibration > THRESHOLDS.vibration.max) {
    anomalies.push({
      type: AnomalyType.HIGH_VIBRATION,
      equipment_id: equipmentId,
      timestamp,
      value: vibration,
      threshold: THRESHOLDS.vibration.max,
      severity: 'high',
      message: `High vibration detected: ${vibration} (normal max: ${THRESHOLDS.vibration.max})`
    });
  }

  return anomalies;
}

function detectPressureAnomalies(equipmentId: string, pressure: number, timestamp: string): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (pressure > THRESHOLDS.pressure.criticalMax) {
    anomalies.push({
      type: AnomalyType.CRITICAL_PRESSURE,
      equipment_id: equipmentId,
      timestamp,
      value: pressure,
      threshold: THRESHOLDS.pressure.criticalMax,
      severity: 'critical',
      message: `Critical pressure detected: ${pressure} PSI (threshold: ${THRESHOLDS.pressure.criticalMax} PSI)`
    });
  } else if (pressure > THRESHOLDS.pressure.max || pressure < THRESHOLDS.pressure.min) {
    anomalies.push({
      type: AnomalyType.ABNORMAL_PRESSURE,
      equipment_id: equipmentId,
      timestamp,
      value: pressure,
      threshold: pressure > THRESHOLDS.pressure.max ? THRESHOLDS.pressure.max : THRESHOLDS.pressure.min,
      severity: 'medium',
      message: `Pressure anomaly detected: ${pressure} PSI (normal range: ${THRESHOLDS.pressure.min}-${THRESHOLDS.pressure.max} PSI)`
    });
  }

  return anomalies;
}

// Advanced anomaly detection using statistical methods
export async function detectStatisticalAnomalies(
  sensorData: SensorData,
  historicalData: SensorData[]
): Promise<Anomaly[]> {
  // This would implement more sophisticated anomaly detection
  // using historical data, machine learning models, or statistical analysis
  
  const anomalies: Anomaly[] = [];
  
  if (historicalData.length < 10) {
    // Not enough historical data for statistical analysis
    return anomalies;
  }

  // Calculate z-score for temperature
  if (sensorData.temperature !== undefined) {
    const temps = historicalData.map(d => d.temperature).filter(t => t !== undefined) as number[];
    const tempAnomaly = detectZScoreAnomaly(
      sensorData.equipment_id,
      sensorData.temperature,
      temps,
      sensorData.timestamp,
      'temperature',
      AnomalyType.HIGH_TEMPERATURE
    );
    if (tempAnomaly) anomalies.push(tempAnomaly);
  }

  // Similar analysis for vibration and pressure...
  
  return anomalies;
}

function detectZScoreAnomaly(
  equipmentId: string,
  value: number,
  historicalValues: number[],
  timestamp: string,
  metric: string,
  anomalyType: AnomalyType
): Anomaly | null {
  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const variance = historicalValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historicalValues.length;
  const stdDev = Math.sqrt(variance);
  
  const zScore = Math.abs(value - mean) / stdDev;
  
  // Z-score thresholds: 2 = medium, 2.5 = high, 3 = critical
  if (zScore > 3) {
    return {
      type: anomalyType,
      equipment_id: equipmentId,
      timestamp,
      value,
      threshold: mean + (3 * stdDev),
      severity: 'critical',
      message: `Statistical anomaly detected in ${metric}: ${value} (z-score: ${zScore.toFixed(2)})`
    };
  } else if (zScore > 2.5) {
    return {
      type: anomalyType,
      equipment_id: equipmentId,
      timestamp,
      value,
      threshold: mean + (2.5 * stdDev),
      severity: 'high',
      message: `Statistical anomaly detected in ${metric}: ${value} (z-score: ${zScore.toFixed(2)})`
    };
  } else if (zScore > 2) {
    return {
      type: anomalyType,
      equipment_id: equipmentId,
      timestamp,
      value,
      threshold: mean + (2 * stdDev),
      severity: 'medium',
      message: `Statistical anomaly detected in ${metric}: ${value} (z-score: ${zScore.toFixed(2)})`
    };
  }
  
  return null;
}

// Anomaly severity assessment
export function assessOverallSeverity(anomalies: Anomaly[]): 'low' | 'medium' | 'high' | 'critical' {
  if (anomalies.some(a => a.severity === 'critical')) return 'critical';
  if (anomalies.some(a => a.severity === 'high')) return 'high';
  if (anomalies.some(a => a.severity === 'medium')) return 'medium';
  return 'low';
}

// Configuration for dynamic threshold updates
export function updateThresholds(newThresholds: Partial<typeof THRESHOLDS>): void {
  Object.assign(THRESHOLDS, newThresholds);
  console.log('Anomaly detection thresholds updated:', THRESHOLDS);
}