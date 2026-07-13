import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/scan.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const jig = () =>
  scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    label: 'fixture project',
    pinnedWorkstreams: ['docs/runbook-caption.md'],
    hiddenWorkstreams: [],
  });

test('scanProject: spec statuses and honest progress (002-01 AC1+AC2)', () => {
  const p = jig();
  assert.equal(p.jigManaged, true);
  assert.equal(p.specs.length, 4);
  const s2 = p.specs.find((s) => s.id === '002-b');
  assert.equal(s2.status, 'IN_PROGRESS');
  assert.equal(s2.slices.length, 3);
  assert.deepEqual(s2.slices[1].dependencies, ['002-01']);
  // 2 DONE / (4 − 1 ABANDONED) = 67%
  assert.equal(p.progress.done, 2);
  assert.equal(p.progress.abandoned, 1);
  assert.equal(p.progress.pct, 67);
  // slices: DONE, DONE, IN_PROGRESS, DEFERRED → 2/4, deferred reported
  assert.equal(p.sliceProgress.done, 2);
  assert.equal(p.sliceProgress.deferred, 1);
});

test('scanProject: counts — bugs (README excluded), inbox, refinement, adrs (002-01 AC4)', () => {
  const p = jig();
  assert.deepEqual(p.counts.bugs, { open: 1, total: 2 });
  assert.equal(p.counts.inbox, 2);
  assert.deepEqual(p.counts.refinement, { open: 2, total: 3 });
  assert.equal(p.counts.adrs, 1);
});

test('scanProject: non-jig project degrades gracefully (002-01 AC3)', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'proj-plain'), label: 'plain', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.jigManaged, false);
  assert.equal(p.specs, undefined);
});

test('scanProject: missing path is an error entry, not a crash', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'does-not-exist'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.ok(p.error);
});

test('workstreams: releases + pinned runbook parsed, README excluded (002-02 AC1+AC2)', () => {
  const p = jig();
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.equal(release.title, 'V1 launch plan');
  assert.deepEqual(release.steps, { done: 1, total: 3 });
  assert.equal(p.workstreams.filter((w) => w.kind === 'release').length, 1);
  const runbook = p.workstreams.find((w) => w.kind === 'runbook');
  assert.equal(runbook.steps.total, 3);
  assert.equal(runbook.next.owner, 'you');
  assert.match(runbook.currentPhase, /Phase A/);
});

test('workstreams: discovery excludes specs/releases/pinned (002-02 AC3)', () => {
  const p = jig();
  assert.equal(p.discovered.length, 0); // the only checkbox doc outside specs/releases is pinned
  const unpinned = scanProject({ path: path.join(FIXTURES, 'proj-jig'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(unpinned.discovered.length, 1);
  assert.equal(unpinned.discovered[0].path, path.join('docs', 'runbook-caption.md'));
  const hiddenCfg = scanProject({ path: path.join(FIXTURES, 'proj-jig'), pinnedWorkstreams: [], hiddenWorkstreams: [path.join('docs', 'runbook-caption.md')] });
  assert.equal(hiddenCfg.discovered.length, 0);
});

test('workstreams: discovery excludes docs/bugs even with checklists (002-02 AC3)', () => {
  const p = jig();
  assert.ok(!p.discovered.some((d) => d.path.includes('bugs')));
  assert.ok(!p.workstreams.some((w) => w.path.includes('bugs')));
});

test('worktree-only docs flagged by path comparison (002-02 AC4)', () => {
  const p = jig();
  assert.equal(p.worktreeOnlyDocs.length, 1);
  assert.equal(p.worktreeOnlyDocs[0].worktree, 'wt-lost');
  assert.equal(p.worktreeOnlyDocs[0].path, path.join('docs', 'notes', 'lost-doc.md'));
});

test('compass: latest valid snapshot surfaces, malformed line warns (002-03 AC2)', () => {
  const p = jig();
  assert.equal(p.compass.headline, 'beta is close');
  assert.equal(p.compass.next, 'finish slice 002-02');
  assert.ok(p.warnings.some((w) => w.includes('malformed')));
});
