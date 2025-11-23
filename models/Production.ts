export interface BillOfMaterials {
  bom_id: string;
  product_id: string;
  version: string;
  components: BOMComponent[];
  created_at: string;
  updated_at: string;
}

export interface BOMComponent {
  component_id: string;
  name: string;
  quantity: number;
  unit: string;
  supplier?: string;
  lead_time_days?: number;
  cost_per_unit?: number;
}

export interface ProductionSchedule {
  schedule_id: string;
  facility_id: string;
  line_id: string;
  product_id: string;
  bom_id: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string;
  actual_end?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  quantity_planned: number;
  quantity_produced?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionMetrics {
  equipment_id: string;
  facility_id: string;
  line_id: string;
  date: string;
  uptime_percentage: number;
  total_production: number;
  defect_rate: number;
  efficiency_score: number;
  maintenance_events: number;
  alert_count: number;
  avg_temperature: number;
  max_temperature: number;
  avg_vibration: number;
  max_vibration: number;
  avg_pressure: number;
  max_pressure: number;
}