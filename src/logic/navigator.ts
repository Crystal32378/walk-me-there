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

  // Location relative to the route is more trustworthy/actionable than speed.
  if (crossTrackDistance > config.OFF_ROUTE_DISTANCE_THRESHOLD) {
    return 'OFF_ROUTE';
  }

  if (speed !== null && speed < config.STATIONARY_SPEED_THRESHOLD) {
    return 'STATIONARY';
  }

  if (currentBearing !== null) {
    const delta = getBearingDelta(currentBearing, expectedBearing);
    if (delta > config.WRONG_DIRECTION_THRESHOLD) {
      return 'WRONG_DIRECTION';
    }
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

  // A route needs at least one finite segment. Fail closed rather than crash or
  // invent a segment when route data is missing/malformed.
  if (polyline.length < 2) {
    return {
      currentCoords,
      accuracy,
      speed,
      bearing: null,
      expectedBearing: null,
      bearingDelta: null,
      crossTrackDistance: 0,
      distanceToWaypoint: 0,
      state: 'UNCERTAIN_GPS',
      timestamp: position.timestamp
    };
  }

  let minXt = Infinity;
  let segmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const xt = getCrossTrackDistance(currentCoords, polyline[i], polyline[i + 1]);
    if (xt < minXt) {
      minXt = xt;
      segmentIndex = i;
    }
  }

  const start = polyline[segmentIndex];
  const end = polyline[segmentIndex + 1];
  const expectedBearing = getBearing(start, end);
  const distanceToWaypoint = getDistance(currentCoords, end);

  // Browser heading is optional and can be NaN on some devices. Only a finite
  // value in the documented [0, 360) range is evidence; otherwise direction
  // remains unknown.
  const currentBearing = typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading < 360
    ? heading
    : null;

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
