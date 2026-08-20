import type { NavState, NavData, Coordinates, Config } from '../types/navigation';
import { getDistance, getBearing, getCrossTrackDistance, getBearingDelta } from './math';

export function determineState(
  accuracy: number,
  speed: number | null,
  currentBearing: number | null,
  expectedBearing: number,
  crossTrackDistance: number,
  config: Config
): NavState {
  if (accuracy > config.ACCURACY_THRESHOLD) {
    return 'UNCERTAIN_GPS';
  }

  if (speed !== null && speed < config.STATIONARY_SPEED_THRESHOLD) {
    return 'STATIONARY';
  }

  if (crossTrackDistance > config.OFF_ROUTE_DISTANCE_THRESHOLD) {
    return 'OFF_ROUTE';
  }

  if (currentBearing !== null) {
    const delta = getBearingDelta(currentBearing, expectedBearing);
    if (delta > config.WRONG_DIRECTION_THRESHOLD) {
      return 'WRONG_DIRECTION';
    }
    // We can also have a middle ground for 'UNCERTAIN_DIRECTION' but v0.1 wants 5 states.
  }

  return 'ON_ROUTE';
}

export function processNavigation(
  position: GeolocationPosition,
  polyline: Coordinates[],
  config: Config
): NavData {
  const { latitude, longitude, accuracy, speed, heading } = position.coords;
  const currentCoords = { lat: latitude, lng: longitude };

  // For v0.1, we just find the closest segment or use a simple logic:
  // Find the segment the user is currently on (or supposed to be on).
  // Simple heuristic for v0.1: find the index where cross-track distance is minimized.
  let minXt = Infinity;
  let segmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const xt = getCrossTrackDistance(currentCoords, polyline[i], polyline[i+1]);
    if (xt < minXt) {
      minXt = xt;
      segmentIndex = i;
    }
  }

  const start = polyline[segmentIndex];
  const end = polyline[segmentIndex + 1];
  
  const expectedBearing = getBearing(start, end);
  const distanceToWaypoint = getDistance(currentCoords, end);
  
  // Use heading if available, otherwise speed-based bearing calculation would be needed
  // Geolocation heading is degrees clockwise from North.
  const currentBearing = heading; 

  const state = determineState(
    accuracy,
    speed,
    currentBearing,
    expectedBearing,
    minXt,
    config
  );

  return {
    currentCoords,
    accuracy,
    speed,
    bearing: currentBearing,
    expectedBearing,
    bearingDelta: currentBearing !== null ? getBearingDelta(currentBearing, expectedBearing) : null,
    crossTrackDistance: minXt,
    distanceToWaypoint,
    state,
    timestamp: position.timestamp
  };
}
