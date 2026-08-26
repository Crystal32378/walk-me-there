// The server's cloud SDKs (@google/genai, @google-cloud/firestore,
// google-auth-library) are declared in server/package.json and installed only
// inside the container. The repo-root `vitest run` still has to resolve those
// import specifiers to load server modules, so vitest.config.ts aliases them
// here.
//
// Every test that exercises a code path touching these SDKs mocks them
// explicitly (see server/companion.voice.test.js). This stub exists purely so
// module resolution succeeds; the no-op shapes below are deliberately inert so
// an unmocked path fails loudly at call time rather than silently succeeding.

const unavailable = (name: string) => () => {
  throw new Error(`${name} is not available in unit tests - mock it with vi.mock()`);
};

export class GoogleGenAI {
  models = { generateContent: unavailable('GoogleGenAI.models.generateContent') };
}

export class Firestore {
  collection = unavailable('Firestore.collection');
}

export const FieldValue = {
  serverTimestamp: unavailable('FieldValue.serverTimestamp'),
  arrayUnion: unavailable('FieldValue.arrayUnion'),
};

export class GoogleAuth {
  getAccessToken = unavailable('GoogleAuth.getAccessToken');
}
