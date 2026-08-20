import { useState, useEffect, useRef } from 'react';
import type { NavData, Coordinates } from '../types/navigation';
import { processNavigation } from '../logic/navigator';
import { NAV_CONFIG, TEST_POLYLINE } from '../config';

export const STALE_FIX_THRESHOLD_MS = 10_000;

export function useNavigator(polyline: Coordinates[] = TEST_POLYLINE) {
  const [navData, setNavData] = useState<NavData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearStaleTimer = () => {
      if (staleTimer.current !== null) {
        clearTimeout(staleTimer.current);
        staleTimer.current = null;
      }
    };

    const markFixStale = () => {
      setNavData((current) => current ? {
        ...current,
        state: 'UNCERTAIN_GPS',
        bearing: null,
        bearingDelta: null
      } : current);
    };

    const scheduleStaleCheck = (timestamp: number) => {
      clearStaleTimer();
      const age = Math.max(0, Date.now() - timestamp);
      const remaining = Math.max(0, STALE_FIX_THRESHOLD_MS - age);
      staleTimer.current = setTimeout(markFixStale, remaining);
    };

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setErrorCode(0);
      return clearStaleTimer;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const data = processNavigation(position, polyline, NAV_CONFIG);
      const isAlreadyStale = Date.now() - position.timestamp >= STALE_FIX_THRESHOLD_MS;

      setError(null);
      setErrorCode(null);
      setNavData(isAlreadyStale ? {
        ...data,
        state: 'UNCERTAIN_GPS',
        bearing: null,
        bearingDelta: null
      } : data);
      scheduleStaleCheck(position.timestamp);
    };

    const handleError = (geoError: GeolocationPositionError) => {
      setError(geoError.message);
      setErrorCode(geoError.code);
    };

    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });

    return () => {
      clearStaleTimer();
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [polyline]);

  return { navData, error, errorCode };
}
