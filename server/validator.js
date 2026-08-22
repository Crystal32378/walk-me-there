// Deterministic gate between the model and the user's screen.
// If a guidance fails any rule, the frontend keeps its static message.

const CARDINAL_RE = /[東西南北]/;

export function validateGuidance(speech, userModel, landmarks) {
  if (!speech || typeof speech.main !== 'string' || typeof speech.sub !== 'string') {
    return { ok: false, reason: 'shape' };
  }
  if (speech.main.length === 0 || speech.main.length > 60 || speech.sub.length > 80) {
    return { ok: false, reason: 'length' };
  }

  // Landmark names are the only place digits are allowed (e.g. 台北101).
  let stripped = `${speech.main}${speech.sub}`;
  for (const lm of landmarks) {
    stripped = stripped.split(lm.name).join('');
  }

  // The model must not invent numbers — distances and times come from the engine.
  if (/[0-9０-９]/.test(stripped)) {
    return { ok: false, reason: 'digits' };
  }

  if (userModel?.avoidCardinal && CARDINAL_RE.test(stripped)) {
    return { ok: false, reason: 'cardinal' };
  }

  return { ok: true };
}
