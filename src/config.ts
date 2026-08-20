import type { Config, Coordinates } from './types/navigation';

export const NAV_CONFIG: Config = {
  ACCURACY_THRESHOLD: 15,      // Initial hypothesis: > 15m is unreliable
  STATIONARY_SPEED_THRESHOLD: 0.5, // Initial hypothesis: < 0.5 m/s is stationary
  OFF_ROUTE_DISTANCE_THRESHOLD: 20, // Initial hypothesis: > 20m from line is off-route
  BEARING_DELTA_THRESHOLD: 45,  // Initial hypothesis: > 45 deg deviation is significant
  WRONG_DIRECTION_THRESHOLD: 135 // Initial hypothesis: > 135 deg is wrong direction
};

// Hardcoded 200m polyline for testing (example: a walk around a block)
export const TEST_POLYLINE: Coordinates[] = [
  { lat: 25.0330, lng: 121.5654 }, // Taipei 101 area start
  { lat: 25.0340, lng: 121.5654 }, // North 110m
  { lat: 25.0340, lng: 121.5663 }  // East 90m (Turn)
];
