import { describe, it, expect } from 'vitest';
import { determineState, processNavigation } from '../logic/navigator';
import { NAV_CONFIG } from '../config';
import type { Coordinates } from '../types/navigation';

function makePosition({
  latitude = 0,
  longitude = 0,
  accuracy = 5,
  speed = 1.5,
  heading = 0,
  timestamp = Date.now()
}: Partial<{
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}> = {}): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading,
      speed,
      toJSON: () => ({})
    },
    timestamp,
    toJSON: () => ({})
  } as GeolocationPosition;
}

describe('Navigation State Machine', () => {
  it('should return UNCERTAIN_GPS if accuracy is low', () => {
    const state = determineState(20, 1, 0, 0, 0, NAV_CONFIG);
    expect(state).toBe('UNCERTAIN_GPS');
  });

  it('should return STATIONARY if speed is low', () => {
    const state = determineState(5, 0.1, 0, 0, 0, NAV_CONFIG);
    expect(state).toBe('STATIONARY');
  });

  it('should return OFF_ROUTE if cross-track distance is high', () => {
    const state = determineState(5, 1.5, 0, 0, 30, NAV_CONFIG);
    expect(state).toBe('OFF_ROUTE');
  });

  it('prioritizes OFF_ROUTE over STATIONARY', () => {
    const state = determineState(5, 0.1, 0, 0, 30, NAV_CONFIG);
    expect(state).toBe('OFF_ROUTE');
  });

  it('should return WRONG_DIRECTION if bearing delta is high', () => {
    const state = determineState(5, 1.5, 180, 0, 0, NAV_CONFIG);
    expect(state).toBe('WRONG_DIRECTION');
  });

  it('should return ON_ROUTE if all conditions are met', () => {
    const state = determineState(5, 1.5, 10, 0, 5, NAV_CONFIG);
    expect(state).toBe('ON_ROUTE');
  });

  it('normalizes invalid heading values to direction unknown', () => {
    const route: Coordinates[] = [
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0 }
    ];
    const data = processNavigation(makePosition({ heading: Number.NaN }), route, NAV_CONFIG);

    expect(data.bearing).toBeNull();
    expect(data.bearingDelta).toBeNull();
    expect(data.state).toBe('ON_ROUTE');
  });

  it('treats null heading as direction unknown', () => {
    const route: Coordinates[] = [
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0 }
    ];
    const data = processNavigation(makePosition({ heading: null }), route, NAV_CONFIG);

    expect(data.bearing).toBeNull();
    expect(data.bearingDelta).toBeNull();
    expect(data.state).toBe('ON_ROUTE');
  });

  it('selects the finite segment nearest a turn', () => {
    const route: Coordinates[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.001, lng: 0.001 }
    ];
    const data = processNavigation(
      makePosition({ latitude: 0.0005, longitude: 0.00105, heading: null }),
      route,
      NAV_CONFIG
    );

    expect(data.expectedBearing).not.toBeNull();
    expect(data.expectedBearing!).toBeLessThan(1);
    expect(data.crossTrackDistance).toBeLessThan(10);
  });

  it('fails safely when the polyline has fewer than two points', () => {
    const data = processNavigation(makePosition(), [{ lat: 0, lng: 0 }], NAV_CONFIG);

    expect(data.state).toBe('UNCERTAIN_GPS');
    expect(data.expectedBearing).toBeNull();
    expect(data.bearing).toBeNull();
  });
});
