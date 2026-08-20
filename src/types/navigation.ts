export type NavState = 
  | 'UNCERTAIN_GPS' 
  | 'STATIONARY' 
  | 'ON_ROUTE' 
  | 'WRONG_DIRECTION' 
  | 'OFF_ROUTE';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NavData {
  currentCoords: Coordinates;
  accuracy: number;
  speed: number | null;
  bearing: number | null;
  expectedBearing: number | null;
  bearingDelta: number | null;
  crossTrackDistance: number;
  distanceToWaypoint: number;
  state: NavState;
  timestamp: number;
}

export interface Config {
  ACCURACY_THRESHOLD: number; // meters
  STATIONARY_SPEED_THRESHOLD: number; // m/s
  OFF_ROUTE_DISTANCE_THRESHOLD: number; // meters
  BEARING_DELTA_THRESHOLD: number; // degrees
  WRONG_DIRECTION_THRESHOLD: number; // degrees
}
