import { describe, it, expect } from 'vitest';
import { getDistance, getBearing, getBearingDelta, getCrossTrackDistance } from '../logic/math';

describe('Navigation Math', () => {
  const p1 = { lat: 25.0330, lng: 121.5654 }; // Taipei 101
  const p2 = { lat: 25.0340, lng: 121.5654 }; // North ~110m

  it('calculates distance correctly', () => {
    const dist = getDistance(p1, p2);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it('calculates bearing correctly', () => {
    const bearing = getBearing(p1, p2);
    expect(bearing).toBe(0); // North
  });

  it('calculates bearing delta correctly', () => {
    expect(getBearingDelta(0, 90)).toBe(90);
    expect(getBearingDelta(350, 10)).toBe(20);
    expect(getBearingDelta(10, 350)).toBe(20);
  });

  it('calculates cross-track distance', () => {
    const start = { lat: 0, lng: 0 };
    const end = { lat: 0, lng: 1 };
    const p = { lat: 0.0001, lng: 0.5 }; // ~11m North of equator
    const xt = getCrossTrackDistance(p, start, end);
    expect(xt).toBeGreaterThan(10);
    expect(xt).toBeLessThan(12);
  });
});
