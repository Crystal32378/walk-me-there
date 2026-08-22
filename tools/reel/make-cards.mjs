// Renders the title/section/end cards as 1920x1080 PNGs via Playwright.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || './out';
mkdirSync(OUT, { recursive: true });

const docsDir = path.resolve(__dirname, '../../docs');

const baseCss = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1920px; height:1080px; display:flex; flex-direction:column;
         align-items:center; justify-content:center; text-align:center;
         font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;
         background:#0b1220; color:#f1f5f9; }
  h1 { font-size:96px; font-weight:800; letter-spacing:-1px; }
  h2 { font-size:44px; font-weight:600; color:#fbbf24; margin-top:28px; }
  p  { font-size:34px; color:#94a3b8; margin-top:22px; line-height:1.5; max-width:1400px; }
  .small { font-size:26px; color:#64748b; margin-top:40px; }
`;

const cards = {
  '01-title': `
    <h1>Walk Me There</h1>
    <h2>Maps know the route.<br/>Walk Me There helps the human actually follow it.</h2>
    <p>A walking companion for people who can hold the map — and still get lost.<br/>
       The engine knows where you are. Gemini knows who you are.</p>`,

  '02-demo-intro': `
    <h1 style="font-size:72px">Live demo</h1>
    <h2>Reproducible GPS replay — Gemini, Cloud Run and Firestore are live.</h2>
    <p>Watch for three moments:<br/>
       ① the engine catches a turn-around — no “I’m lost” button pressed<br/>
       ② the user teaches the owl: “I can’t tell east from west”<br/>
       ③ every guidance after that changes — enforced, not hoped for</p>`,

  '04-architecture': `
    <div style="background:#f8fafc; width:1920px; height:1080px; display:flex; align-items:center; justify-content:center;">
      <img src="file://${docsDir}/architecture.svg" style="width:1720px;"/>
    </div>`,

  '05-owl-vision': `
    <div style="width:1920px; height:1080px; background:#0b1220; display:flex; flex-direction:column; align-items:center; justify-content:center;">
      <img src="file://${docsDir}/owl-hardware-concept.png" style="max-width:1560px; max-height:860px; border-radius:18px;"/>
      <p style="margin-top:30px">The truth layer is small enough to live inside a plush owl<br/>with one motor and one LED. That is the next body.</p>
    </div>`,

  '06-end': `
    <h1 style="font-size:80px">Walk Me There</h1>
    <h2>牠知道路，但不嫌你不知道。</h2>
    <p>It knows the way without making you feel bad for not knowing it.</p>
    <p class="small">walk-me-there-v01-134673885671.asia-east1.run.app<br/>
       github.com/Crystal32378/walk-me-there · Built on Google Cloud<br/>
       Gemini 3.5 Flash · Vertex AI · GenAI SDK · Cloud Run · Firestore</p>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

for (const [name, body] of Object.entries(cards)) {
  await page.setContent(`<!doctype html><html><head><style>${baseCss}</style></head><body>${body}</body></html>`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`card: ${name}.png`);
}

await browser.close();
