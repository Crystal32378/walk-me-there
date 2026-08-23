// Server-side navigation truth. The companion service does NOT trust the
// client's claimed state: it recomputes cross-track, bearing delta and the
// nav state from the raw observations before waking the agent. Geographic
// truth stays deterministic at the server boundary, not just in the UI.
//
// Thresholds and polyline mirror src/config.ts — keep them in sync.

import { getDistance, getBearing } from './geo.js';

export const NAV_CONFIG = {
  ACCURACY_THRESHOLD: 15,
  STATIONARY_SPEED_THRESHOLD: 0.5,
  OFF_ROUTE_DISTANCE_THRESHOLD: 20,
  WRONG_DIRECTION_THRESHOLD: 135,
};

export const TEST_POLYLINE = [
  { lat: 25.033, lng: 121.5654 },
  { lat: 25.034, lng: 121.5654 },
  { lat: 25.034, lng: 121.5663 },
];

const R = 6371e3;
const toRadians = (deg) => (deg * Math.PI) / 180;

export function getCrossTrackDistance(p, start, end) {
  const d13 = getDistance(start, p) / R;
  const θ13 = toRadians(getBearing(start, p));
  const θ12 = toRadians(getBearing(start, end));
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(θ13 - θ12)) * R);
}

export function getBearingDelta(b1, b2) {
  let delta = Math.abs(b1 - b2);
  if (delta > 180) delta = 360 - delta;
  return delta;
}

// Mirrors determineState in src/logic/navigator.ts.
export function assessNavigation(raw, polyline = TEST_POLYLINE, config = NAV_CONFIG) {
  const coords = raw?.currentCoords;
  if (
    !coords ||
    typeof coords.lat !== 'number' ||
    typeof coords.lng !== 'number' ||
    Number.isNaN(coords.lat) ||
    Number.isNaN(coords.lng)
  ) {
    return null;
  }

  const accuracy = typeof raw.accuracy === 'number' ? raw.accuracy : Infinity;
  const speed = typeof raw.speed === 'number' ? raw.speed : null;
  const bearing = typeof raw.bearing === 'number' ? raw.bearing : null;

  let minXt = Infinity;
  let segmentIndex = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const xt = getCrossTrackDistance(coords, polyline[i], polyline[i + 1]);
    if (xt < minXt) {
      minXt = xt;
      segmentIndex = i;
    }
  }

  const expectedBearing = getBearing(polyline[segmentIndex], polyline[segmentIndex + 1]);
  const bearingDelta = bearing !== null ? getBearingDelta(bearing, expectedBearing) : null;

  let state = 'ON_ROUTE';
  if (accuracy > config.ACCURACY_THRESHOLD) {
    state = 'UNCERTAIN_GPS';
  } else if (speed !== null && speed < config.STATIONARY_SPEED_THRESHOLD) {
    state = 'STATIONARY';
  } else if (minXt > config.OFF_ROUTE_DISTANCE_THRESHOLD) {
    state = 'OFF_ROUTE';
  } else if (bearingDelta !== null && bearingDelta > config.WRONG_DIRECTION_THRESHOLD) {
    state = 'WRONG_DIRECTION';
  }

  return {
    state,
    crossTrackDistance: minXt,
    expectedBearing,
    bearingDelta,
    bearing,
    accuracy,
    speed,
  };
}
