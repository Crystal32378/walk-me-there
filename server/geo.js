// Deterministic geometry for the companion server.
// Mirrors src/logic/math.ts — geographic truth is computed, never generated.

const R = 6371e3;

const toRadians = (deg) => (deg * Math.PI) / 180;
const toDegrees = (rad) => (rad * 180) / Math.PI;

export function getDistance(p1, p2) {
  const φ1 = toRadians(p1.lat);
  const φ2 = toRadians(p2.lat);
  const Δφ = toRadians(p2.lat - p1.lat);
  const Δλ = toRadians(p2.lng - p1.lng);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getBearing(p1, p2) {
  const φ1 = toRadians(p1.lat);
  const φ2 = toRadians(p2.lat);
  const λ1 = toRadians(p1.lng);
  const λ2 = toRadians(p2.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// Translate a target bearing into a clock-face direction relative to where
// the user is facing. 12 o'clock = straight ahead. Returns null without heading.
export function clockFace(targetBearing, userHeading) {
  if (userHeading === null || userHeading === undefined || Number.isNaN(userHeading)) {
    return null;
  }
  const rel = (targetBearing - userHeading + 360) % 360;
  let hour = Math.round(rel / 30);
  if (hour === 0) hour = 12;
  return hour;
}
