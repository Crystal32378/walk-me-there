import { describe, it, expect } from 'vitest';
import { determineState } from '../logic/navigator';
import { NAV_CONFIG } from '../config';

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

  it('should return WRONG_DIRECTION if bearing delta is high', () => {
    const state = determineState(5, 1.5, 180, 0, 0, NAV_CONFIG);
    expect(state).toBe('WRONG_DIRECTION');
  });

  it('should return ON_ROUTE if all conditions are met', () => {
    const state = determineState(5, 1.5, 10, 0, 5, NAV_CONFIG);
    expect(state).toBe('ON_ROUTE');
  });
});
