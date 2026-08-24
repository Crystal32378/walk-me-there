import { describe, it, expect } from 'vitest';
import { assessNavigation, describeDeviation } from './engine';

describe('Deviation is categorized before the model ever sees it', () => {
  it('maps meters to vocabulary buckets, no raw numbers', () => {
    for (const [m, zh] of [
      [21, '剛偏出路線一點點'],
      [40, '偏了一小段路'],
      [78, '偏得比較遠，但完全找得回來'],
    ]) {
      const d = describeDeviation(m);
      expect(d.zh).toBe(zh);
      expect(`${d.zh}${d.en}`).not.toMatch(/[0-9]/);
    }
  });
});

// The server engine must agree with the frontend engine
// (src/logic/navigator.ts) on every state decision.
describe('Server-side navigation truth', () => {
  const base = {
    currentCoords: { lat: 25.0333, lng: 121.5654 },
    accuracy: 5,
    speed: 1.4,
    bearing: 0,
  };

  it('rejects malformed snapshots', () => {
    expect(assessNavigation(null)).toBe(null);
    expect(assessNavigation({})).toBe(null);
    expect(assessNavigation({ currentCoords: { lat: 'x', lng: 1 } })).toBe(null);
  });

  it('computes ON_ROUTE for a walker following the route', () => {
    expect(assessNavigation(base).state).toBe('ON_ROUTE');
  });

  it('computes WRONG_DIRECTION when the walker turns around', () => {
    const r = assessNavigation({ ...base, bearing: 180 });
    expect(r.state).toBe('WRONG_DIRECTION');
    expect(r.bearingDelta).toBe(180);
  });

  it('computes OFF_ROUTE when the walker drifts off the corridor', () => {
    const r = assessNavigation({ ...base, currentCoords: { lat: 25.0334, lng: 121.5658 }, bearing: 90 });
    expect(r.state).toBe('OFF_ROUTE');
    expect(r.crossTrackDistance).toBeGreaterThan(20);
  });

  it('does not wake the agent on a spoofed recovery claim', () => {
    // Client claims WRONG_DIRECTION but the raw observations say on-route:
    // the server recomputes and disagrees.
    const r = assessNavigation({ ...base, state: 'WRONG_DIRECTION' });
    expect(r.state).toBe('ON_ROUTE');
  });

  it('flags uncertain GPS and stationary from raw observations', () => {
    expect(assessNavigation({ ...base, accuracy: 30 }).state).toBe('UNCERTAIN_GPS');
    expect(assessNavigation({ ...base, speed: 0.1 }).state).toBe('STATIONARY');
  });
});
