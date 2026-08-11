// Tiny local server: every /api/data request rescans from disk (no cache),
// so a browser refresh is always current. Zero dependencies (ADR-0001).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from './config.mjs';
import { observeAll, joinProjectProfileFields } from './observation.mjs';
import { readObservationHistory } from './state.mjs';
import { attachForecasts, attentionQueue } from './derive.mjs';
import { attachMilestones } from './milestone.mjs';
import { gitVelocity, attachVelocity } from './velocity.mjs';
import { projectTokenCost, attachTokenCost } from './cost.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolveConfigPath(ROOT, process.env.GAUGE_CONFIG);
const INDEX = path.join(ROOT, 'public', 'index.html');

const config = loadConfig(CONFIG_PATH);
const port = Number(process.env.PORT || config.port || 5111);

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(INDEX));
  } else if (url === '/api/data') {
    try {
      // Goal/deadline (spec 009-01, ADR-0011): joined at this read layer,
      // never inside observeAll/observation-v1 itself — a literal echo of
      // whatever the profile already carries (see joinProjectProfileFields).
      const freshConfig = loadConfig(CONFIG_PATH);
      const joined = joinProjectProfileFields(observeAll(freshConfig), freshConfig);
      // Forecast/risk (spec 009-02, ADR-0006/ADR-0012): the history-derived
      // layer's only I/O — reading each project's history — happens here at
      // the read layer, never inside derive.mjs itself. deriveForecast (via
      // attachForecasts) stays a pure fold over the already-read history and
      // the deadline this loop just joined onto each project.
      const historiesByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [
          project.id,
          readObservationHistory(freshConfig.stateDir, project.id).observations,
        ]),
      );
      const withForecasts = attachForecasts(joined, historiesByProjectId);
      // Active/next milestone (spec 011-01): a pure fold over each project's
      // already-scanned workstreams signal — the release-plan `## Status`
      // convention resolved into exactly one active milestone (shipping ??
      // committed) plus a next list, mirroring attachForecasts's read-layer
      // composition style. No additional I/O.
      const withMilestones = attachMilestones(withForecasts);
      // Git velocity (spec 012, slice 012-02): a raw-layer signal, no deadline
      // dependency. The one I/O read (git log per project) happens HERE, at
      // the read layer — mirroring the forecast history read above — so
      // attachVelocity itself (src/velocity.mjs) stays a pure fold. `nowMs` is
      // captured once so every project's window shares the same clock (AC5).
      const velocityNowMs = Date.now();
      const velocityByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, gitVelocity(project.path, velocityNowMs)]),
      );
      const withVelocity = attachVelocity(withMilestones, velocityByProjectId);
      // Token cost (spec 012, slice 012-03): the spec's one deliberate depth
      // exception. The one I/O (enumerating + reading each project's Claude
      // Code session transcripts, then deduping/pricing them) happens HERE,
      // at the read layer — mirroring the git-velocity read above — so
      // attachTokenCost itself (src/cost.mjs) stays a pure fold. The
      // transcripts root is overridable via GAUGE_TRANSCRIPTS_ROOT (tests
      // never touch the real `~/.claude/projects`); `undefined` here already
      // triggers projectTokenCost's own default-parameter fallback, so no
      // separate branch is needed.
      const transcriptsRoot = process.env.GAUGE_TRANSCRIPTS_ROOT || undefined;
      const costByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, projectTokenCost(project.path, transcriptsRoot)]),
      );
      const withTokenCost = attachTokenCost(withVelocity, costByProjectId);
      // Global attention queue (spec 009-03, ADR-0013): a pure ranking over
      // the forecast/risk read this loop just attached — no additional I/O,
      // no adapter/registry reach from derive.mjs itself (AC4).
      const data = { ...withTokenCost, attention: attentionQueue(withTokenCost) };
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    }
  } else {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Gauge → http://localhost:${port}`);
});
