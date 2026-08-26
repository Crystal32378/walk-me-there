import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The server's cloud SDKs live in server/package.json and are installed only in
// the container, so a repo-root `npm test` cannot resolve them. Tests mock them;
// this alias just lets module resolution succeed. See src/test/cloudSdkStub.ts.
const cloudSdkStub = fileURLToPath(new URL('./src/test/cloudSdkStub.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    alias: {
      '@google/genai': cloudSdkStub,
      '@google-cloud/firestore': cloudSdkStub,
      'google-auth-library': cloudSdkStub,
    },
  },
});
