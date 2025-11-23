export enum EquipmentType {
  CONVEYOR = 'conveyor',
  PRESS = 'press',
  WELDER = 'welder',
  ROBOT = 'robot',
  SENSOR = 'sensor',
  ASSEMBLY_LINE = 'assembly_line'
}

export enum EquipmentStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  ERROR = 'error',
  IDLE = 'idle'
}

export interface Equipment {
  equipment_id: string;
  name: string;
  type: EquipmentType;
  facility_id: string;
  line_id: string;
  status: EquipmentStatus;
  manufacturer?: string;
  model?: string;
  installation_date?: string;
  last_maintenance?: string;
  next_maintenance?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentStatusQuery {
  equipment_id: string;
  current_temperature?: number;
  current_vibration?: number;
  current_pressure?: number;
  last_reading_time: string;
  status: EquipmentStatus;
}

export interface MetricsQuery {
  equipment_id: string;
  metric_date: string;
  avg_temperature: number;
  max_temperature: number;
  avg_vibration: number;
  max_vibration: number;
  avg_pressure: number;
  max_pressure: number;
  uptime_minutes: number;
  total_alerts: number;
}