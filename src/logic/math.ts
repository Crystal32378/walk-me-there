import type { Coordinates } from '../types/navigation';

const R = 6371e3; // Earth radius in meters

export function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

export function getDistance(p1: Coordinates, p2: Coordinates): number {
  const φ1 = toRadians(p1.lat);
  const φ2 = toRadians(p2.lat);
  const Δφ = toRadians(p2.lat - p1.lat);
  const Δλ = toRadians(p2.lng - p1.lng);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getBearing(p1: Coordinates, p2: Coordinates): number {
  const φ1 = toRadians(p1.lat);
  const φ2 = toRadians(p2.lat);
  const λ1 = toRadians(p1.lng);
  const λ2 = toRadians(p2.lng);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (toDegrees(θ) + 360) % 360;
}

/**
 * Distance from a point to a finite route segment.
 *
 * The original v0.1 implementation measured cross-track distance to the
 * infinitely extended great-circle line. That can report ~0m after the user
 * has already walked beyond a segment endpoint. We keep the public function
 * name for compatibility, but clamp the along-track position to the segment.
 */
export function getCrossTrackDistance(p: Coordinates, start: Coordinates, end: Coordinates): number {
  const segmentLength = getDistance(start, end);
  const distanceFromStart = getDistance(start, p);

  if (segmentLength === 0) {
    return distanceFromStart;
  }

  const δ13 = distanceFromStart / R;
  const θ13 = toRadians(getBearing(start, p));
  const θ12 = toRadians(getBearing(start, end));
  const bearingDelta = θ13 - θ12;

  // Signed along-track angular distance on the great circle.
  const δAt = Math.atan2(
    Math.sin(δ13) * Math.cos(bearingDelta),
    Math.cos(δ13)
  );
  const alongTrackDistance = δAt * R;

  if (alongTrackDistance <= 0) {
    return distanceFromStart;
  }

  if (alongTrackDistance >= segmentLength) {
    return getDistance(end, p);
  }

  const δXt = Math.asin(Math.sin(δ13) * Math.sin(bearingDelta));
  return Math.abs(δXt * R);
}

export function getBearingDelta(b1: number, b2: number): number {
  let delta = Math.abs(b1 - b2);
  if (delta > 180) delta = 360 - delta;
  return delta;
}
