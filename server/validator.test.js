import { describe, it, expect } from 'vitest';
import { validateGuidance, sanitizeReply } from './validator';
import { clockFace, getBearing } from './geo';

const LANDMARKS = [{ id: 'taipei101', name: '台北101', nameEn: 'Taipei 101' }];

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

  it('rejects English cardinal words too when the user model forbids them', () => {
    const v = validateGuidance(
      { main: 'Head northeast for a bit.', sub: 'Almost there.' },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('cardinal');

    const ok = validateGuidance(
      { main: 'Turn to your left and walk toward 台北101.', sub: "I'm with you." },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(ok.ok).toBe(true);
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

    const goodEn = validateGuidance(
      { main: 'Walk toward Taipei 101.', sub: "It's right ahead of you." },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(goodEn.ok).toBe(true);
  });

  it('rejects references to places outside the registry', () => {
    const en = validateGuidance(
      { main: 'Walk toward Taipei Station.', sub: 'Almost there.' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(en.ok).toBe(false);
    expect(en.reason).toBe('unregistered_place');

    const zh = validateGuidance(
      { main: '朝台北車站的方向走。', sub: '快到了。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(zh.ok).toBe(false);
    expect(zh.reason).toBe('unregistered_place');

    const transit = validateGuidance(
      { main: '往捷運站走。', sub: '我陪你。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(transit.ok).toBe(false);
    expect(transit.reason).toBe('unregistered_place');
  });

  it('still allows registry landmarks, generic environment words and emphasis caps', () => {
    const registry = validateGuidance(
      { main: 'Walk toward Taipei 101, please.', sub: "It's right ahead of you." },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(registry.ok).toBe(true);

    const generic = validateGuidance(
      { main: '穿過公園，朝台北101走。', sub: '沿著這條路，我陪你。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(generic.ok).toBe(true);

    const emphasis = validateGuidance(
      { main: 'Turn to your LEFT now.', sub: "Don't worry, I am right here." },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(emphasis.ok).toBe(true);
  });

  it('allows legal clock-direction expressions (1–12) in both languages', () => {
    const en = validateGuidance(
      { main: 'Taipei 101 is at your 9 o’clock — walk toward it.', sub: "I'm with you." },
      { avoidCardinal: true, orientationVocab: 'clock' },
      LANDMARKS
    );
    expect(en.ok).toBe(true);

    const zh = validateGuidance(
      { main: '往你的9點鐘方向走。', sub: '台北101就在那邊。' },
      { avoidCardinal: true, orientationVocab: 'clock' },
      LANDMARKS
    );
    expect(zh.ok).toBe(true);

    const zhWordNumeral = validateGuidance(
      { main: '朝三點鐘方向慢慢走。', sub: '我陪你。' },
      { avoidCardinal: true },
      LANDMARKS
    );
    expect(zhWordNumeral.ok).toBe(true);
  });

  it('still rejects non-clock numbers and out-of-range clock values', () => {
    const distance = validateGuidance(
      { main: 'Walk 50 meters toward your 9 o’clock.', sub: 'Almost.' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(distance.ok).toBe(false);
    expect(distance.reason).toBe('digits');

    const badClock = validateGuidance(
      { main: '往你的13點鐘方向走。', sub: '快到了。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(badClock.ok).toBe(false);
    expect(badClock.reason).toBe('digits');

    const time = validateGuidance(
      { main: '再走5分鐘就到了。', sub: '加油。' },
      { avoidCardinal: false },
      LANDMARKS
    );
    expect(time.ok).toBe(false);
    expect(time.reason).toBe('digits');
  });

  it('rejects malformed or oversized speech', () => {
    expect(validateGuidance(null, {}, LANDMARKS).ok).toBe(false);
    expect(validateGuidance({ main: 'x'.repeat(101), sub: '' }, {}, LANDMARKS).ok).toBe(false);
  });
});

describe('Dialogue reply sanitizer — raw JSON never reaches the screen', () => {
  it('passes plain text through', () => {
    expect(sanitizeReply('別擔心，我會用左右跟你說。')).toEqual({
      main: '別擔心，我會用左右跟你說。',
      sub: '',
    });
  });

  it('parses JSON-shaped replies instead of showing them raw', () => {
    const r = sanitizeReply('{"main": "Got it, my friend.", "sub": "I will remember."}');
    expect(r).toEqual({ main: 'Got it, my friend.', sub: 'I will remember.' });

    const fenced = sanitizeReply('```json\n{"main": "好的，我記住了。"}\n```');
    expect(fenced?.main).toBe('好的，我記住了。');
  });

  it('drops unparseable JSON-looking output entirely (static fallback takes over)', () => {
    expect(sanitizeReply('{"main": "broken')).toBe(null);
    expect(sanitizeReply('{}')).toBe(null);
    expect(sanitizeReply('')).toBe(null);
    expect(sanitizeReply(undefined)).toBe(null);
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
