import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildVoicePrompt,
  voiceCacheKey,
  parseAudioMime,
  pcmToWav,
  synthesizeSpeech,
  _resetVoiceCache,
  VOICE_NAME,
} from './voice';

// google-auth-library is resolved through the unit-test alias; a real token is
// never needed because the HTTP call itself is stubbed.
vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    async getAccessToken() {
      return 'test-token';
    }
  },
}));

// The product promise: what the walker hears is what the walker reads.
// The TTS prompt is where that promise could quietly break, so it is tested
// as a contract, not as a formatting detail.
describe('Voice speaks the approved text verbatim', () => {
  const speech = {
    main: '先停下來，轉身朝台北101的方向。',
    sub: '沒關係，我陪你慢慢走。',
  };

  it('carries main and sub through character for character', () => {
    const prompt = buildVoicePrompt(speech);
    expect(prompt).toContain(speech.main);
    expect(prompt).toContain(speech.sub);
  });

  it('adds nothing to the utterance but the voice direction', () => {
    const prompt = buildVoicePrompt(speech);
    // Everything after "Say:" is exactly the two approved lines, unedited.
    const spoken = prompt.slice(prompt.indexOf('Say:') + 'Say:'.length).trim();
    expect(spoken).toBe(`${speech.main} ${speech.sub}`);
  });

  it('keeps the voice direction fixed', () => {
    const prompt = buildVoicePrompt(speech);
    expect(prompt).toContain('calm, clever boy about ten years old');
    expect(prompt).toContain('never cutesy, never performative');
    expect(prompt.indexOf('Say:')).toBeLessThan(prompt.indexOf(speech.main));
  });

  it('works for English guidance without touching the wording', () => {
    const en = { main: 'Turn around and walk toward Taipei 101.', sub: "I'm right here." };
    const prompt = buildVoicePrompt(en);
    expect(prompt).toContain(en.main);
    expect(prompt).toContain(en.sub);
  });

  it('tolerates a missing sub without inventing filler', () => {
    const prompt = buildVoicePrompt({ main: 'Stop for a second.', sub: '' });
    expect(prompt.trim().endsWith('Stop for a second.')).toBe(true);
  });
});

describe('Voice cache key', () => {
  const text = buildVoicePrompt({ main: 'a', sub: 'b' });

  it('is stable for the same text, language and voice', () => {
    expect(voiceCacheKey(text, 'zh')).toBe(voiceCacheKey(text, 'zh'));
    expect(voiceCacheKey(text, 'zh')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('separates languages, voices and wordings', () => {
    const zh = voiceCacheKey(text, 'zh');
    expect(voiceCacheKey(text, 'en')).not.toBe(zh);
    expect(voiceCacheKey(text, 'zh', 'Kore')).not.toBe(zh);
    expect(voiceCacheKey(buildVoicePrompt({ main: 'a', sub: 'c' }), 'zh')).not.toBe(zh);
  });

  it('defaults to the owl voice', () => {
    expect(voiceCacheKey(text, 'zh')).toBe(voiceCacheKey(text, 'zh', VOICE_NAME));
  });
});

// Vertex hands back headerless little-endian PCM. Browsers refuse to play it,
// so the header we prepend has to be exactly right or the owl is mute.
describe('PCM to WAV wrapping', () => {
  const read4 = (buf, at) => buf.toString('ascii', at, at + 4);

  it('reads the sample format out of the response mime type', () => {
    expect(parseAudioMime('audio/L16;codec=pcm;rate=24000')).toEqual({
      sampleRate: 24000,
      bitsPerSample: 16,
      channels: 1,
    });
    expect(parseAudioMime('audio/L16;codec=pcm;rate=16000;channels=2')).toEqual({
      sampleRate: 16000,
      bitsPerSample: 16,
      channels: 2,
    });
  });

  it('falls back to the documented default when the mime type is missing', () => {
    expect(parseAudioMime(undefined)).toEqual({
      sampleRate: 24000,
      bitsPerSample: 16,
      channels: 1,
    });
  });

  it('writes a canonical 44-byte mono 24kHz header', () => {
    const pcm = Buffer.alloc(480); // 10ms of 24kHz 16-bit mono
    const wav = pcmToWav(pcm, { sampleRate: 24000, bitsPerSample: 16, channels: 1 });

    expect(wav.length).toBe(44 + pcm.length);
    expect(read4(wav, 0)).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
    expect(read4(wav, 8)).toBe('WAVE');
    expect(read4(wav, 12)).toBe('fmt ');
    expect(wav.readUInt32LE(16)).toBe(16); // fmt chunk size
    expect(wav.readUInt16LE(20)).toBe(1); // uncompressed PCM
    expect(wav.readUInt16LE(22)).toBe(1); // channels
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt32LE(28)).toBe(48000); // byte rate = rate * blockAlign
    expect(wav.readUInt16LE(32)).toBe(2); // blockAlign
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(read4(wav, 36)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
  });

  it('derives byte rate and block align from the declared format', () => {
    const wav = pcmToWav(Buffer.alloc(8), { sampleRate: 16000, bitsPerSample: 16, channels: 2 });
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(16000);
    expect(wav.readUInt16LE(32)).toBe(4);
    expect(wav.readUInt32LE(28)).toBe(64000);
  });

  it('passes the samples through byte for byte', () => {
    const pcm = Buffer.from([0x01, 0xff, 0x7f, 0x80, 0x00, 0x00]);
    const wav = pcmToWav(pcm, parseAudioMime('audio/L16;codec=pcm;rate=24000'));
    expect(wav.subarray(44).equals(pcm)).toBe(true);
  });
});

describe('Synthesis is best-effort and never load-bearing', () => {
  const speech = { main: 'Turn around.', sub: "I'm with you." };
  const pcm = Buffer.from([0x11, 0x22, 0x33, 0x44]);

  const audioResponse = () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/L16;codec=pcm;rate=24000',
                  data: pcm.toString('base64'),
                },
              },
            ],
          },
        },
      ],
    }),
  });

  beforeEach(() => {
    _resetVoiceCache();
    vi.stubGlobal('fetch', vi.fn(audioResponse));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a playable WAV built from the returned PCM', async () => {
    const b64 = await synthesizeSpeech(speech, 'en');
    const wav = Buffer.from(b64, 'base64');

    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.subarray(44).equals(pcm)).toBe(true);
  });

  it('sends the Puck voice config and the verbatim text', async () => {
    await synthesizeSpeech(speech, 'en');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash-preview-tts:generateContent');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      VOICE_NAME
    );
    expect(body.contents[0].parts[0].text).toContain(speech.main);
    expect(body.contents[0].parts[0].text).toContain(speech.sub);
  });

  it('serves a repeated utterance from cache instead of calling again', async () => {
    const first = await synthesizeSpeech(speech, 'en');
    const second = await synthesizeSpeech(speech, 'en');

    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);

    // A different language is a different utterance.
    await synthesizeSpeech(speech, 'zh');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('degrades to silence on an API error, without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(synthesizeSpeech(speech, 'en')).resolves.toBe(null);
  });

  it('degrades to silence on a timeout or network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('The operation was aborted');
      })
    );
    await expect(synthesizeSpeech(speech, 'en')).resolves.toBe(null);
  });

  it('degrades to silence when the response carries no audio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(synthesizeSpeech(speech, 'en')).resolves.toBe(null);
  });

  it('does not cache a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    expect(await synthesizeSpeech(speech, 'en')).toBe(null);

    vi.stubGlobal('fetch', vi.fn(audioResponse));
    expect(await synthesizeSpeech(speech, 'en')).not.toBe(null);
  });
});
