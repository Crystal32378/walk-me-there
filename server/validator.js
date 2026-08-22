// Deterministic gate between the model and the user's screen.
// If a guidance fails any rule, the frontend keeps its static message.

const CARDINAL_RE = /[東西南北]/;
const CARDINAL_EN_RE = /\b(north|south|east|west|northeast|northwest|southeast|southwest)\b/i;

export function validateGuidance(speech, userModel, landmarks) {
  if (!speech || typeof speech.main !== 'string' || typeof speech.sub !== 'string') {
    return { ok: false, reason: 'shape' };
  }
  if (speech.main.length === 0 || speech.main.length > 60 || speech.sub.length > 80) {
    return { ok: false, reason: 'length' };
  }

  // Landmark names are the only place digits are allowed (e.g. 台北101 / Taipei 101).
  let stripped = `${speech.main}${speech.sub}`;
  for (const lm of landmarks) {
    for (const name of [lm.name, lm.nameEn]) {
      if (name) stripped = stripped.split(name).join('');
    }
  }

  // The model must not invent numbers — distances and times come from the engine.
  if (/[0-9０-９]/.test(stripped)) {
    return { ok: false, reason: 'digits' };
  }

  if (userModel?.avoidCardinal && (CARDINAL_RE.test(stripped) || CARDINAL_EN_RE.test(stripped))) {
    return { ok: false, reason: 'cardinal' };
  }

  return { ok: true };
}
