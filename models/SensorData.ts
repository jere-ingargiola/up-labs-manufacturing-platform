export interface SensorData {
  equipment_id: string;
  timestamp: string;
  temperature?: number;
  vibration?: number;
  pressure?: number;
  power_consumption?: number;
  custom_metrics?: Record<string, any>;
  facility_id?: string;
  line_id?: string;
  
  // Enrichment fields added during processing
  ingestionTimestamp?: string;
  source?: string;
  hasAnomalies?: boolean;
  anomalies?: import('./Anomaly').Anomaly[];
}