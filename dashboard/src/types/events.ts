export type Location = {
  lat: number;
  lng: number;
  accuracy_meters?: number;
  altitude_meters?: number;
};

export type Movement = {
  speed_kmh?: number;
  heading_degrees?: number;
  moving?: boolean;
};

export type DeviceInfo = {
  battery_level?: number;
  charging?: boolean;
};

export type FleetEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  vehicle_id: string;
  trip_id: string;
  device_id?: string;
  location?: Location;
  movement?: Movement;
  planned_distance_km?: number;
  estimated_duration_hours?: number;
  distance_travelled_km?: number;
  total_distance_km?: number;
  duration_minutes?: number;
  fuel_consumed_percent?: number;
  cancellation_reason?: string;
  distance_completed_km?: number;
  elapsed_time_minutes?: number;
  signal_quality?: string;
  device?: DeviceInfo;
  overspeed?: boolean;
  [key: string]: unknown;
};
