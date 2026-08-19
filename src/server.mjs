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
import { spliceLiveObservation } from './live-tail.mjs';
import { attachMilestones } from './milestone.mjs';
import { gitVelocity, attachVelocity } from './velocity.mjs';
import { gitTeamSignals, attachTeamSignals } from './team.mjs';
import { projectCostBundle, attachTokenCost, attachCostBreakdown } from './cost.mjs';

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
      // 014-02 AC4: splice each project's LIVE current observation (from the
      // `joined`/`observeAll` pass above — collectedAt = now, freshness
      // recomputed this request) as the TAIL of its stored history, so
      // deriveForecast's `latest` reflects now. This removes the false
      // `on_track` a frozen old stored record would produce; Gate 2 then
      // splits fresh-but-flat (→ at_risk) from quiet (→ stale-evidence)
      // honestly. deriveForecast stays a pure, now-free fold (ADR-0006).
      const liveByProjectId = Object.fromEntries(
        joined.projects.map((observation) => [observation.project.id, observation]),
      );
      const historiesByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [
          project.id,
          spliceLiveObservation(
            readObservationHistory(freshConfig.stateDir, project.id).observations,
            liveByProjectId[project.id],
          ),
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
      // Team signals — human-vs-agent split + contributor count (spec 012,
      // slice 012-05): a raw-layer signal, git-derived like velocity above,
      // sharing the SAME `nowMs` capture (velocityNowMs) so both git reads
      // observe one consistent clock instant per request. gitTeamSignals
      // (src/team.mjs) reuses velocity's DEFAULT_VELOCITY_WINDOW_WEEKS as its
      // own default window (AC6) — the one I/O read (git log per project)
      // happens HERE, at the read layer, so attachTeamSignals itself stays a
      // pure fold.
      const teamByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, gitTeamSignals(project.path, velocityNowMs)]),
      );
      const withTeam = attachTeamSignals(withVelocity, teamByProjectId);
      // Token cost — total + by-activity/by-skill (spec 012, slices 012-03/
      // 012-04): the spec's one deliberate depth exception. The one I/O
      // (enumerating + reading each project's Claude Code session
      // transcripts, plus its skill-usage.jsonl) happens HERE, at the read
      // layer — mirroring the git-velocity read above — via projectCostBundle
      // (src/cost.mjs), which reads + dedupes a project's transcripts ONCE
      // and fans that single deduped record set out to all three pure folds
      // (costFromRecords/costByActivity/costBySkill). Reconciliation fix
      // (both review passes): calling projectTokenCost + projectCostByActivity
      // + projectCostBySkill separately re-read/re-parsed/re-deduped the SAME
      // bytes three times per project per request; the bundle collapses that
      // to one read. attachTokenCost/attachCostBreakdown stay pure folds over
      // the bundle's two fields. The transcripts root is overridable via
      // GAUGE_TRANSCRIPTS_ROOT (tests never touch the real
      // `~/.claude/projects`); `undefined` here already triggers
      // projectCostBundle's own default-parameter fallback, so no separate
      // branch is needed.
      const transcriptsRoot = process.env.GAUGE_TRANSCRIPTS_ROOT || undefined;
      const costBundleByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, projectCostBundle(project.path, transcriptsRoot)]),
      );
      const costByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, costBundleByProjectId[project.id]?.tokenCost ?? null]),
      );
      const withTokenCost = attachTokenCost(withTeam, costByProjectId);
      const breakdownByProjectId = Object.fromEntries(
        freshConfig.projects.map((project) => [project.id, costBundleByProjectId[project.id]?.tokenCostBreakdown ?? null]),
      );
      const withCostBreakdown = attachCostBreakdown(withTokenCost, breakdownByProjectId);
      // Global attention queue (spec 009-03, ADR-0013): a pure ranking over
      // the forecast/risk read this loop just attached — no additional I/O,
      // no adapter/registry reach from derive.mjs itself (AC4).
      const data = { ...withCostBreakdown, attention: attentionQueue(withCostBreakdown) };
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
