import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitInfo, scanProject } from '../src/scan.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const ROOT = path.join(FIXTURES, '..', '..');

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

test('jigManaged requires concrete evidence, not a bare docs/specs dir (#6)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jig-detect-'));
  const cfg = (name) => ({ path: path.join(base, name), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  try {
    // (a) a bare, empty docs/specs dir is NOT evidence → degrades to generic.
    fs.mkdirSync(path.join(base, 'bare', 'docs', 'specs'), { recursive: true });
    assert.equal(scanProject(cfg('bare')).jigManaged, false);
    // (b) scaffold.json alone → jig-managed, even with no docs/specs.
    fs.mkdirSync(path.join(base, 'scaffolded'), { recursive: true });
    fs.writeFileSync(path.join(base, 'scaffolded', 'scaffold.json'), '{}');
    assert.equal(scanProject(cfg('scaffolded')).jigManaged, true);
    // (c) a real docs/specs/*/spec.md → jig-managed.
    fs.mkdirSync(path.join(base, 'withspec', 'docs', 'specs', '001-x'), { recursive: true });
    fs.writeFileSync(path.join(base, 'withspec', 'docs', 'specs', '001-x', 'spec.md'), '---\nstatus: DONE\n---\n# X\n');
    assert.equal(scanProject(cfg('withspec')).jigManaged, true);
    // (d) a jig-convention ADR → jig-managed, even without specs.
    fs.mkdirSync(path.join(base, 'withadr', 'docs', 'decisions'), { recursive: true });
    fs.writeFileSync(path.join(base, 'withadr', 'docs', 'decisions', 'adr-0001-x.md'), '# ADR 1\n');
    assert.equal(scanProject(cfg('withadr')).jigManaged, true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
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

test('gitInfo captures the exact HEAD revision for provenance', () => {
  const expected = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.equal(gitInfo(ROOT).revision, expected);
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

test('profile: no-profile default is byte-identical to an explicit default profile (007-01 AC3)', () => {
  const explicit = scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    label: 'fixture project',
    pinnedWorkstreams: ['docs/runbook-caption.md'],
    hiddenWorkstreams: [],
    profile: {
      artifactRoot: path.join(FIXTURES, 'proj-jig', 'docs'),
      specsDir: 'specs',
      decisionsDir: 'decisions',
    },
  });
  assert.deepEqual(explicit, jig());
});

test('profile: a non-docs artifactRoot is scanned only when a profile declares it (007-01 AC4)', () => {
  // Real Pattern B shape: nested jig artifacts under docs/opportunities/cwv,
  // with sibling umbrella content (docs/releases, docs/bugs, a root-level
  // discovered doc) at the parent level that must never bleed into the
  // profiled card (spec 007-01 reconciliation blocker 1+2).
  const root = path.join(FIXTURES, 'proj-nested');
  const cfg = (extra = {}) => ({ path: root, label: 'nested', pinnedWorkstreams: [], hiddenWorkstreams: [], ...extra });

  // Without a profile, the nested-root artifacts are invisible: no jig
  // evidence at the conventional docs/{specs,decisions} root, so the
  // project degrades to generic — never a misleading 0/0.
  const generic = scanProject(cfg());
  assert.equal(generic.jigManaged, false);
  assert.equal(generic.specs, undefined);

  // With a profile pointing at the real (nested) root, the adapter finds
  // only the specs/decisions that live there and reports real progress —
  // and none of the parent-level releases/bugs/discovered docs bleed in.
  const withProfile = scanProject(cfg({
    profile: { artifactRoot: path.join(root, 'docs', 'opportunities', 'cwv'), specsDir: 'specs', decisionsDir: 'decisions' },
  }));
  assert.equal(withProfile.jigManaged, true);
  assert.equal(withProfile.specs.length, 1);
  assert.equal(withProfile.specs[0].id, '001-nested');
  assert.equal(withProfile.specs[0].status, 'DONE');
  assert.equal(withProfile.progress.pct, 100);
  assert.equal(withProfile.counts.adrs, 1);

  // The umbrella's own docs/releases/launch.md, docs/bugs/bug-x.md, and
  // docs/roadmap.md (a >=3-checkbox discovered doc) all sit outside
  // docs/opportunities/cwv and must not be counted.
  assert.equal(withProfile.workstreams.length, 0);
  assert.equal(withProfile.discovered.length, 0);
  assert.deepEqual(withProfile.counts.bugs, { open: 0, total: 0 });
});

test('profile: statusProperty is wired into spec/slice status parsing (007-01 nit 3)', () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-status-property'),
    label: 'status-property',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
    profile: { statusProperty: 'state' },
  });
  assert.equal(p.jigManaged, true);
  assert.equal(p.specs.length, 1);
  assert.equal(p.specs[0].status, 'DONE');

  // The default statusProperty ("status") does not see the `state:` field —
  // the spec is jig-managed (spec.md exists) but its status resolves to null.
  const defaulted = scanProject({
    path: path.join(FIXTURES, 'proj-status-property'),
    label: 'status-property',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  assert.equal(defaulted.specs[0].status, null);
});

test('multi-entry (007-02): each track root scans in isolation, decisions-only track has no false 0/0', () => {
  // Real Pattern C shape: tracks/<name>/{specs,decisions} directly (no docs/
  // wrapper), one entry per track, no config.mjs involved here — this proves
  // scanProject() itself is unchanged by 007-02 (config.mjs is the only seam
  // that expands entries; each entry is an ordinary single-entry profile by
  // the time it reaches scanProject).
  const root = path.join(FIXTURES, 'proj-umbrella');
  const track = (name, extra = {}) => scanProject({
    path: root, label: name, pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(root, 'tracks', name), specsDir: 'specs', decisionsDir: 'decisions' },
    ...extra,
  });

  const a = track('a');
  assert.equal(a.jigManaged, true);
  assert.equal(a.specs.length, 1);
  assert.equal(a.progress.pct, 100);
  assert.equal(a.counts.adrs, 1);

  const b = track('b');
  assert.equal(b.jigManaged, true);
  assert.equal(b.specs.length, 2);
  assert.equal(b.progress.done, 1);
  assert.equal(b.counts.adrs, 1);

  // Track c is decisions-only (no specs/ dir at all): jig-managed via ADR
  // evidence, but specs stays an empty array — never a coerced 0/0.
  const c = track('c');
  assert.equal(c.jigManaged, true);
  assert.deepEqual(c.specs, []);
  assert.equal(c.progress, null);
  assert.equal(c.counts.adrs, 1);

  // Each track sees only its own tree — no cross-track bleed.
  assert.equal(a.specs[0].id, '001-a');
  assert.equal(b.specs.map((s) => s.id).sort().join(','), '001-b,002-b');
});

// --- 008-01: flat specLayout + honest completion (ADR-0010) ---

const flatCfg = (extra = {}) => ({
  path: path.join(FIXTURES, 'proj-flat'), label: 'flat',
  pinnedWorkstreams: [], hiddenWorkstreams: [],
  profile: { artifactRoot: path.join(FIXTURES, 'proj-flat', 'docs'), specLayout: 'flat' },
  ...extra,
});

test('flat specLayout reads specs/<name>.md, skips README, titles from heading (008-01 AC2)', () => {
  const p = scanProject(flatCfg());
  assert.equal(p.jigManaged, true);
  assert.equal(p.specs.length, 2);
  // README.md is not a spec artifact.
  assert.ok(!p.specs.some((s) => s.id.toLowerCase() === 'readme'));
  const alpha = p.specs.find((s) => s.id === '2026-01-01-alpha-design');
  assert.equal(alpha.title, 'Alpha design');
  assert.deepEqual(alpha.slices, []);
  // A `Spec N:` heading prefix is stripped exactly as the nested reader does.
  const beta = p.specs.find((s) => s.id === '2026-02-02-beta-design');
  assert.equal(beta.title, 'Beta design');
  // Prose status (no frontmatter) resolves no status under the frontmatter reader.
  assert.equal(alpha.status, null);
  assert.equal(beta.status, null);
});

test('flat specLayout: default (nested) does not see the flat files (008-01 AC2/AC4)', () => {
  // Same root, no specLayout override → default nested → the flat <name>.md
  // files are not <dir>/spec.md, so no jig evidence (byte-identical to today).
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-flat'), label: 'flat',
    pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(FIXTURES, 'proj-flat', 'docs') },
  });
  assert.equal(p.jigManaged, false);
  assert.equal(p.specs, undefined);
});

test('flat specLayout with a recognized delivery status rolls up as today (008-01 AC3)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flat-delivery-'));
  try {
    const specs = path.join(base, 'docs', 'specs');
    fs.mkdirSync(specs, { recursive: true });
    fs.writeFileSync(path.join(specs, 'a-design.md'), '---\nstatus: DONE\n---\n# A\n');
    fs.writeFileSync(path.join(specs, 'b-design.md'), '# B\n\n**Status:** Approved\n');
    const p = scanProject({
      path: base, label: 'flat-delivery', pinnedWorkstreams: [], hiddenWorkstreams: [],
      profile: { artifactRoot: path.join(base, 'docs'), specLayout: 'flat' },
    });
    assert.equal(p.specs.length, 2);
    // ≥1 recognized status → progressOf runs exactly as today (status-absent
    // artifact stays in the denominator): 1 DONE / 2 = 50%.
    assert.equal(p.progress.done, 1);
    assert.equal(p.progress.total, 2);
    assert.equal(p.progress.pct, 50);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('card gate: an empty/irrelevant declared flat root does not fabricate a card (008-01 AC5)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flat-empty-'));
  try {
    // A declared flat root whose specs/ holds only a README (no matching
    // artifact) and no scaffold/ADR → not trackable, no card.
    const specs = path.join(base, 'docs', 'specs');
    fs.mkdirSync(specs, { recursive: true });
    fs.writeFileSync(path.join(specs, 'README.md'), '# index\n');
    const cfg = { path: base, label: 'empty', pinnedWorkstreams: [], hiddenWorkstreams: [],
      profile: { artifactRoot: path.join(base, 'docs'), specLayout: 'flat' } };
    assert.equal(scanProject(cfg).jigManaged, false);

    // Add one matching flat artifact → the root becomes trackable (tier 2).
    fs.writeFileSync(path.join(specs, 'real-design.md'), '# Real\n');
    assert.equal(scanProject(cfg).jigManaged, true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('compass: latest valid snapshot surfaces, malformed line warns (002-03 AC2)', () => {
  const p = jig();
  assert.equal(p.compass.headline, 'beta is close');
  assert.equal(p.compass.next, 'finish slice 002-02');
  assert.ok(p.warnings.some((w) => w.includes('malformed')));
});
