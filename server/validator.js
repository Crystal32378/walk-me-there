// Deterministic gate between the model and the user's screen.
// If a guidance fails any rule, the frontend keeps its static message.

const CARDINAL_RE = /[東西南北]/;
const CARDINAL_EN_RE = /\b(north|south|east|west|northeast|northwest|southeast|southwest)\b/i;

// Unregistered-place heuristics. The model is prompted to only reference
// registry landmarks; this deny-list makes the claim enforceable for the
// realistic hallucination classes: named/transit/brand POIs (zh) and
// mid-sentence proper nouns (en). Generic environment words (路, 公園,
// "the corner") are deliberately allowed — pointing at what's visibly
// there is not invented geography.
const ZH_POI_RE = /(車站|火車站|捷運站|捷運|高鐵|公車站|夜市|百貨|廣場大樓|新光三越|誠品|星巴克|麥當勞|肯德基|全家|萊爾富|便利商店|饒河|士林|西門町)/;

// Mid-sentence capitalized English words are treated as proper nouns.
// All-caps tokens (LEFT, GPS) are emphasis/acronyms, not place names.
const EN_CAP_ALLOWLIST = new Set(['I', "I'm", "I'll", "I've", "I'd"]);

function hasUnregisteredPlaceReference(stripped) {
  if (ZH_POI_RE.test(stripped)) return true;

  const sentences = stripped.split(/[.!?…\n]+/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const w = words[i].replace(/[^A-Za-z']/g, '');
      if (!w) continue;
      if (/^[A-Z]+$/.test(w)) continue; // all-caps emphasis or acronym
      if (/^[A-Z]/.test(w) && !EN_CAP_ALLOWLIST.has(w)) return true;
    }
  }
  return false;
}

// Clock-face directions (1–12 only) are legal direction language — the engine
// computes them and provides them as facts. Anything else with a digit
// (distances, times, house numbers) stays banned.
const CLOCK_EN_RE = /(?<!\d)(1[0-2]|[1-9])(?!\d)[\s-]*o[’'`]?clock/gi;
const CLOCK_ZH_RE = /(?<!\d)(1[0-2]|[1-9])(?!\d)\s*點鐘/g;

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

  // Legal clock-direction expressions are exempt from the digit ban.
  stripped = stripped.replace(CLOCK_EN_RE, '').replace(CLOCK_ZH_RE, '');

  // The model must not invent any other numbers — distances and times come
  // from the engine.
  if (/[0-9０-９]/.test(stripped)) {
    return { ok: false, reason: 'digits' };
  }

  if (hasUnregisteredPlaceReference(stripped)) {
    return { ok: false, reason: 'unregistered_place' };
  }

  if (userModel?.avoidCardinal && (CARDINAL_RE.test(stripped) || CARDINAL_EN_RE.test(stripped))) {
    return { ok: false, reason: 'cardinal' };
  }

  return { ok: true };
}
