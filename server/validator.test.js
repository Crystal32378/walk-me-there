import { describe, it, expect } from 'vitest';
import { validateGuidance } from './validator';
import { clockFace, getBearing } from './geo';

const LANDMARKS = [{ id: 'taipei101', name: '台北101' }];

describe('Guidance Validator', () => {
  it('accepts clean guidance', () => {
    const v = validateGuidance(
      { main: '先停下來，轉身朝台北101的方向。', sub: '沒關係，我陪你慢慢走。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(v.ok).toBe(true);
  });

  it('rejects cardinal words when the user model forbids them', () => {
    const v = validateGuidance(
      { main: '往東北方向走。', sub: '快到了。' },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('cardinal');
  });

  it('allows cardinal words before the user says otherwise', () => {
    const v = validateGuidance(
      { main: '往北走。', sub: '跟著我。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(v.ok).toBe(true);
  });

  it('rejects invented numbers but allows digits inside landmark names', () => {
    const bad = validateGuidance(
      { main: '再走50公尺。', sub: '快到了。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('digits');

    const good = validateGuidance(
      { main: '朝台北101走。', sub: '牠就在你眼前。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(good.ok).toBe(true);
  });

  it('rejects malformed or oversized speech', () => {
    expect(validateGuidance(null, {}, LANDMARKS).ok).toBe(false);
    expect(validateGuidance({ main: 'x'.repeat(61), sub: '' }, {}, LANDMARKS).ok).toBe(false);
  });
});

describe('Deterministic landmark direction', () => {
  it('computes clock-face direction from engine-calculated bearings', () => {
    // Landmark due north (bearing 0), user facing east (90°) → 9 o'clock.
    expect(clockFace(0, 90)).toBe(9);
    // Facing the landmark → 12 o'clock.
    expect(clockFace(180, 180)).toBe(12);
    // No heading → no clock direction; the agent must not guess one.
    expect(clockFace(0, null)).toBe(null);
  });

  it('bearing math matches the frontend engine convention', () => {
    const b = getBearing({ lat: 25.033, lng: 121.5654 }, { lat: 25.034, lng: 121.5654 });
    expect(b).toBe(0);
  });
});
