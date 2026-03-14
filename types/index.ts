export type MaintenanceType =
  | 'oil_change'
  | 'tire_rotation'
  | 'tire_replacement'
  | 'brake_fluid'
  | 'coolant'
  | 'transmission_fluid'
  | 'power_steering_fluid'
  | 'windshield_washer_fluid'
  | 'brake_pads'
  | 'brake_rotors'
  | 'air_filter'
  | 'cabin_filter'
  | 'battery'
  | 'spark_plugs'
  | 'timing_belt'
  | 'wiper_blades'
  | 'custom';

export const MAINTENANCE_LABELS: Record<MaintenanceType, string> = {
  oil_change: 'Oil Change',
  tire_rotation: 'Tire Rotation',
  tire_replacement: 'Tire Replacement',
  brake_fluid: 'Brake Fluid',
  coolant: 'Coolant / Antifreeze',
  transmission_fluid: 'Transmission Fluid',
  power_steering_fluid: 'Power Steering Fluid',
  windshield_washer_fluid: 'Washer Fluid',
  brake_pads: 'Brake Pads',
  brake_rotors: 'Brake Rotors',
  air_filter: 'Air Filter',
  cabin_filter: 'Cabin Air Filter',
  battery: 'Battery',
  spark_plugs: 'Spark Plugs',
  timing_belt: 'Timing Belt',
  wiper_blades: 'Wiper Blades',
  custom: 'Custom',
};

export const MAINTENANCE_ICONS: Record<MaintenanceType, string> = {
  oil_change: '🛢️',
  tire_rotation: '🔄',
  tire_replacement: '🏎️',
  brake_fluid: '🔴',
  coolant: '🌡️',
  transmission_fluid: '⚙️',
  power_steering_fluid: '🔧',
  windshield_washer_fluid: '💧',
  brake_pads: '🛑',
  brake_rotors: '⭕',
  air_filter: '💨',
  cabin_filter: '🌬️',
  battery: '🔋',
  spark_plugs: '⚡',
  timing_belt: '⏱️',
  wiper_blades: '🌧️',
  custom: '🔩',
};

// Default intervals (miles / months)
export const DEFAULT_INTERVALS: Partial<Record<MaintenanceType, { miles?: number; months?: number }>> = {
  oil_change: { miles: 5000, months: 6 },
  tire_rotation: { miles: 7500, months: 6 },
  brake_fluid: { months: 24 },
  coolant: { miles: 30000, months: 24 },
  transmission_fluid: { miles: 30000, months: 24 },
  air_filter: { miles: 15000, months: 12 },
  cabin_filter: { miles: 15000, months: 12 },
  battery: { months: 36 },
  spark_plugs: { miles: 30000 },
  timing_belt: { miles: 60000, months: 60 },
  wiper_blades: { months: 12 },
  brake_pads: { miles: 25000 },
};

export interface Car {
  id: string;
  user_id: string;
  nickname?: string;
  make: string;
  model: string;
  year: number;
  current_mileage: number;
  color?: string;
  vin?: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  car_id: string;
  type: MaintenanceType;
  custom_label?: string;
  date: string;
  mileage_at_service: number;
  cost?: number;
  notes?: string;
  created_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  car_id: string;
  type: MaintenanceType;
  custom_label?: string;
  interval_miles?: number;
  interval_months?: number;
  next_due_date?: string;
  next_due_mileage?: number;
  is_active: boolean;
  created_at: string;
}

export interface MaintenanceAlert {
  schedule: MaintenanceSchedule;
  car: Car;
  overdue: boolean;
  daysUntilDue?: number;
  milesUntilDue?: number;
}
