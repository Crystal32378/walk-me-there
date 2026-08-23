import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTurn } from './companion.js';

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');

// Note: /healthz is intercepted by Google Frontend on Cloud Run (reserved
// path, returns GFE 404 before reaching the container) — hence /api/health.
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'walk-me-there' }));

app.post('/api/companion/turn', async (req, res) => {
  try {
    const out = await handleTurn(req.body ?? {});
    if (out.error) {
      res.status(out.status ?? 400).json({ error: out.error });
      return;
    }
    res.json(out);
  } catch (err) {
    console.error('companion turn failed:', err);
    res.status(500).json({ error: 'companion_unavailable' });
  }
});

app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`walk-me-there serving on :${port}`));
