import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STALE_FIX_THRESHOLD_MS, useNavigator } from './useNavigator';
import type { Coordinates } from '../types/navigation';

const route: Coordinates[] = [
  { lat: 0, lng: 0 },
  { lat: 0.001, lng: 0 }
];

function makePosition(timestamp: number): GeolocationPosition {
  return {
    coords: {
      latitude: 0.0002,
      longitude: 0,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: 0,
      speed: 1.5,
      toJSON: () => ({})
    },
    timestamp,
    toJSON: () => ({})
  } as GeolocationPosition;
}

describe('useNavigator geolocation lifecycle', () => {
  let successCallback: PositionCallback;
  let errorCallback: PositionErrorCallback;
  const clearWatch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00Z'));
    clearWatch.mockReset();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
          successCallback = success;
          errorCallback = error;
          return 7;
        }),
        clearWatch
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears a stale geolocation error after a successful fix', () => {
    const { result } = renderHook(() => useNavigator(route));

    act(() => {
      errorCallback({ code: 3, message: 'Timeout expired' } as GeolocationPositionError);
    });
    expect(result.current.error).toBe('Timeout expired');
    expect(result.current.errorCode).toBe(3);

    act(() => {
      successCallback(makePosition(Date.now()));
    });
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.navData).not.toBeNull();
  });

  it('downgrades an old fix to UNCERTAIN_GPS', () => {
    const { result } = renderHook(() => useNavigator(route));

    act(() => {
      successCallback(makePosition(Date.now()));
    });
    expect(result.current.navData?.state).toBe('ON_ROUTE');

    act(() => {
      vi.advanceTimersByTime(STALE_FIX_THRESHOLD_MS);
    });
    expect(result.current.navData?.state).toBe('UNCERTAIN_GPS');
    expect(result.current.navData?.bearing).toBeNull();
    expect(result.current.navData?.bearingDelta).toBeNull();
  });
});
