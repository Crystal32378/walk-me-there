// Verification harness: a scripted GPS trace that walks the real test route,
// turns around, deviates, and recovers — so the full loop can be exercised
// (and demoed) without standing next to Taipei 101.
// Activated only by ?sim=1. Production behavior is untouched.

interface SimTick {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
}

const T: SimTick[] = [];
const push = (lat: number, lng: number, heading: number) =>
  T.push({ lat, lng, heading, speed: 1.4 });

// Phase A — on route, walking north along the polyline.
for (let i = 0; i <= 2; i++) push(25.0331 + i * 0.0001, 121.5654, 0);
// Phase B — turned around: heading south against the expected bearing.
for (let i = 0; i <= 4; i++) push(25.0333 - i * 0.0001, 121.5654, 180);
// Phase C — recovered: walking north again long enough for the engine to certify it.
for (let i = 0; i <= 5; i++) push(25.0329 + i * 0.0001, 121.5654, 0);
// Phase D — drifting east, off the route corridor.
for (let i = 1; i <= 4; i++) push(25.0334, 121.5654 + i * 0.0001, 90);
// Phase E — coming back west, then continuing north on route.
for (let i = 3; i >= 0; i--) push(25.0334, 121.5654 + i * 0.0001, 270);
for (let i = 1; i <= 5; i++) push(25.0334 + i * 0.0001, 121.5654, 0);

export const SIM_TICK_MS = 1200;

export function isSimMode(): boolean {
  return new URLSearchParams(window.location.search).get('sim') === '1';
}

export function startSimulatedWalk(
  onPosition: (position: GeolocationPosition) => void
): () => void {
  let idx = 0;
  const emit = () => {
    const t = T[Math.min(idx, T.length - 1)];
    onPosition({
      coords: {
        latitude: t.lat,
        longitude: t.lng,
        accuracy: 5,
        speed: t.speed,
        heading: t.heading,
        altitude: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
    idx++;
  };
  emit();
  const interval = setInterval(() => {
    if (idx >= T.length) {
      clearInterval(interval);
      return;
    }
    emit();
  }, SIM_TICK_MS);
  return () => clearInterval(interval);
}
