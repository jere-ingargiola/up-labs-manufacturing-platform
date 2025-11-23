export enum AnomalyType {
  HIGH_TEMPERATURE = 'high_temperature',
  CRITICAL_TEMPERATURE = 'critical_temperature',
  HIGH_VIBRATION = 'high_vibration',
  CRITICAL_VIBRATION = 'critical_vibration',
  ABNORMAL_PRESSURE = 'abnormal_pressure',
  CRITICAL_PRESSURE = 'critical_pressure',
  POWER_SPIKE = 'power_spike',
  EQUIPMENT_OFFLINE = 'equipment_offline'
}

export interface Anomaly {
  type: AnomalyType;
  equipment_id: string;
  timestamp: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  resolved?: boolean;
  resolved_at?: string;
}

export interface Alert {
  alert_id: string;
  equipment_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  resolved: boolean;
  resolved_at?: string;
}