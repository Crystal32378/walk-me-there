// Records the live demo take against the deployed app (?sim=1, English mode).
// Everything on screen is real: production Cloud Run, real Gemini calls,
// real Firestore writes. The GPS trace is the reproducible sim replay.
//
// Flow (one continuous recording):
//   Run 1: on-route → wrong direction caught → Gemini guidance →
//          teach the owl "I can't tell east from west" → memory badge
//   (reload, same device id kept in localStorage)
//   Run 2: wrong direction + off-route guidance now adapted — no cardinal words
//
// Usage: node record-demo.mjs [output-dir]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WMT_URL || 'https://walk-me-there-v01-134673885671.asia-east1.run.app';
const OUT = process.argv[2] || './out';
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 430, height: 932 };

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function mainText(page) {
  return (await page.locator('.main-instruction').textContent().catch(() => '')) ?? '';
}

// Wait until the owl says something that is NOT one of the static engine
// messages — i.e. Gemini's guidance has arrived and passed the validator.
async function waitForGeminiSpeech(page, timeoutMs) {
  const staticSnippets = [
    'this is the way',
    "heading the wrong way",
    "we've drifted",
    'stand here for now',
    'still finding you',
    'Finding your position',
    'owl is thinking',
  ];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await mainText(page);
    if (text && !staticSnippets.some((s) => text.toLowerCase().includes(s.toLowerCase()))) {
      return text;
    }
    await page.waitForTimeout(400);
  }
  return null;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: OUT, size: VIEWPORT },
});
await context.addInitScript(() => localStorage.setItem('wmt-lang', 'en'));

const page = await context.newPage();

log('RUN 1 — loading sim replay (fresh device, no user model)');
await page.goto(`${BASE}/?sim=1`, { waitUntil: 'networkidle' });

// Let the on-route phase breathe, then the sim turns around (~4s in).
await page.waitForTimeout(5000);
log(`state now: "${await mainText(page)}"`);

// Engine catches the turn-around; wait for Gemini's first guidance.
const g1 = await waitForGeminiSpeech(page, 25000);
log(g1 ? `RUN 1 guidance: "${g1}"` : 'RUN 1: no Gemini speech seen (static fallback stayed up)');
await page.waitForTimeout(2500);

// Teach the owl.
log('opening "I\'m confused" and teaching: I can\'t tell east from west');
await page.locator('.confused-action-btn').click();
await page.locator('.confused-option-card', { hasText: "east from west" }).click();

const badge = page.locator('.memory-badge');
await badge.waitFor({ timeout: 25000 }).catch(() => log('memory badge did not appear!'));
log(`owl reply: "${await mainText(page)}"`);
await page.waitForTimeout(4000);

log('RUN 2 — reloading (same device, memory persists in Firestore)');
await page.reload({ waitUntil: 'networkidle' });

// Wrong-direction phase guidance, now adapted.
await page.waitForTimeout(5000);
const g2 = await waitForGeminiSpeech(page, 25000);
log(g2 ? `RUN 2 wrong-direction guidance: "${g2}"` : 'RUN 2 wrong-dir: static only');

// Off-route phase guidance (~19s into the run).
await page.waitForTimeout(6000);
const g3 = await waitForGeminiSpeech(page, 25000);
log(g3 ? `RUN 2 off-route guidance: "${g3}"` : 'RUN 2 off-route: static only');

const cardinal = /(north|south|east|west)/i;
for (const [label, t] of [['run2-wrongdir', g2], ['run2-offroute', g3]]) {
  if (t) log(`${label} cardinal check: ${cardinal.test(t) ? 'FOUND CARDINAL — retake!' : 'clean ✓'}`);
}

// Let the sim settle back on route (engine certifies recovery), hold the ending.
await page.waitForTimeout(14000);
log(`final state: "${await mainText(page)}"`);

const video = page.video();
await context.close();
const path = await video.path();
await browser.close();
log(`saved: ${path}`);
