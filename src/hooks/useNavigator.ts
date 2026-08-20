import { useState, useEffect, useRef } from 'react';
import type { NavData, Coordinates } from '../types/navigation';
import { processNavigation } from '../logic/navigator';
import { NAV_CONFIG, TEST_POLYLINE } from '../config';

export function useNavigator(polyline: Coordinates[] = TEST_POLYLINE) {
  const [navData, setNavData] = useState<NavData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const data = processNavigation(position, polyline, NAV_CONFIG);
      setNavData(data);
    };

    const handleError = (error: GeolocationPositionError) => {
      setError(error.message);
    };

    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [polyline]);

  return { navData, error };
}
