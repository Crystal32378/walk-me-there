import { describe, it, expect, vi, beforeEach } from 'vitest';

// The one rule this file exists to enforce: the owl's voice is downstream of
// the validator. Nothing the validator rejected may ever be spoken, and the
// words that are spoken are the words the validator approved - unedited.

const h = vi.hoisted(() => ({
  generateContent: vi.fn(),
  synthesizeSpeech: vi.fn(),
  // Call log, in real execution order, across the gate and the voice.
  trace: [],
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = { generateContent: h.generateContent };
    }
  },
}));

vi.mock('./firestore.js', () => ({
  getUserModel: vi.fn(async () => ({ avoidCardinal: false, orientationVocab: null, notes: [] })),
  patchUserModel: vi.fn(async () => ({})),
  openEpisode: vi.fn(async () => 'ep-1'),
  appendEpisodeMessage: vi.fn(async () => {}),
  closeEpisode: vi.fn(async () => {}),
}));

// The real validator rules are kept - only instrumented, so ordering is
// asserted against the actual gate rather than a stand-in for it.
vi.mock('./validator.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    validateGuidance: (...args) => {
      const verdict = actual.validateGuidance(...args);
      h.trace.push(`validate:${verdict.ok ? 'ok' : verdict.reason}`);
      return verdict;
    },
    sanitizeReply: (...args) => {
      h.trace.push('sanitize');
      return actual.sanitizeReply(...args);
    },
  };
});

vi.mock('./voice.js', () => ({
  synthesizeSpeech: (...args) => {
    h.trace.push('synthesize');
    return h.synthesizeSpeech(...args);
  },
}));

const { handleTurn } = await import('./companion.js');

// Raw observations the server engine independently scores as WRONG_DIRECTION.
const OFF_ROUTE_SNAPSHOT = {
  currentCoords: { lat: 25.0333, lng: 121.5654 },
  accuracy: 5,
  speed: 1.4,
  bearing: 180,
};

const CLEAN_GUIDANCE = {
  main: '先停下來，轉身朝台北101的方向。',
  sub: '沒關係，我陪你慢慢走。',
};

// The model invents a distance: the validator's digit ban rejects it.
const DIRTY_GUIDANCE = { main: '往前走50公尺。', sub: '快到了。' };

const modelSays = (text) => ({ text, functionCalls: undefined, candidates: [] });
const guidanceReply = (obj) => modelSays(JSON.stringify(obj));

const recoveryTurn = (extra) =>
  handleTurn({
    deviceId: 'd1',
    event: 'recovery_needed',
    navSnapshot: OFF_ROUTE_SNAPSHOT,
    lang: 'zh',
    ...extra,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.trace.length = 0;
  h.synthesizeSpeech.mockResolvedValue('BASE64WAV');
});

describe('TTS sits after the validator, never beside it', () => {
  it('speaks approved guidance, with the on-screen text unchanged', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(CLEAN_GUIDANCE));

    const out = await recoveryTurn({ voice: true });

    expect(out.source).toBe('gemini');
    expect(out.speech).toEqual(CLEAN_GUIDANCE);
    expect(out.audio).toBe('BASE64WAV');

    // Synthesized from the approved object itself - not a rewrite of it.
    expect(h.synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(h.synthesizeSpeech).toHaveBeenCalledWith(CLEAN_GUIDANCE, 'zh');
  });

  it('validates before it synthesizes, in that order', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(CLEAN_GUIDANCE));

    await recoveryTurn({ voice: true });

    expect(h.trace).toEqual(['validate:ok', 'synthesize']);
  });

  it('never speaks guidance the validator rejected', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(DIRTY_GUIDANCE));

    const out = await recoveryTurn({ voice: true });

    expect(out.source).toBe('fallback');
    expect(out.speech).toBe(null);
    expect(out.audio).toBe(null);
    expect(h.trace).toEqual(['validate:digits']);
    expect(h.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('stays silent when the engine itself refuses to wake the agent', async () => {
    // Same coordinates, but walking the right way: the engine says ON_ROUTE,
    // so no guidance is generated and there is nothing to speak.
    const out = await recoveryTurn({
      navSnapshot: { ...OFF_ROUTE_SNAPSHOT, bearing: 0 },
      voice: true,
    });

    expect(out.error).toBe('engine_disagrees');
    expect(h.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('speaks a dialogue reply only after it has been sanitized', async () => {
    // Raw model output is fenced JSON; sanitizeReply is what makes it speakable.
    h.generateContent.mockResolvedValueOnce(modelSays('```json\n{"main":"我在這裡，先深呼吸。"}\n```'));

    const out = await handleTurn({
      deviceId: 'd1',
      event: 'user_message',
      message: '我好慌',
      lang: 'zh',
      voice: true,
    });

    expect(out.speech.main).toBe('我在這裡，先深呼吸。');
    expect(out.audio).toBe('BASE64WAV');
    expect(h.trace).toEqual(['sanitize', 'synthesize']);
    // The spoken object is the displayed object: no raw JSON reaches the voice.
    expect(h.synthesizeSpeech).toHaveBeenCalledWith(out.speech, 'zh');
  });
});

describe('Voice is opt-in and never load-bearing', () => {
  it('does not synthesize when the flag is off', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(CLEAN_GUIDANCE));

    const out = await recoveryTurn({});

    expect(out.speech).toEqual(CLEAN_GUIDANCE);
    expect(out.audio).toBe(null);
    expect(h.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('ignores a non-boolean voice flag rather than guessing', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(CLEAN_GUIDANCE));

    const out = await recoveryTurn({ voice: 'yes' });

    expect(out.audio).toBe(null);
    expect(h.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('keeps the text when synthesis fails or times out', async () => {
    h.generateContent.mockResolvedValueOnce(guidanceReply(CLEAN_GUIDANCE));
    h.synthesizeSpeech.mockRejectedValueOnce(new Error('tts_timeout'));

    const out = await recoveryTurn({ voice: true });

    expect(out.source).toBe('gemini');
    expect(out.speech).toEqual(CLEAN_GUIDANCE);
    expect(out.audio).toBe(null);
  });

  it('leaves the dialogue fallback silent when the model itself fails', async () => {
    h.generateContent.mockRejectedValueOnce(new Error('gemini_timeout'));

    const out = await handleTurn({
      deviceId: 'd1',
      event: 'user_message',
      message: '我好慌',
      lang: 'zh',
      voice: true,
    });

    expect(out.source).toBe('fallback');
    expect(out.speech.main).toBeTruthy();
    expect(out.audio).toBe(null);
    expect(h.synthesizeSpeech).not.toHaveBeenCalled();
  });
});
