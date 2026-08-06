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

test('worktree hygiene compares against the default branch, not the parked working tree', () => {
  // Regression for the false-positive inflation: a doc already merged to main
  // must NOT be flagged "worktree-only" just because the primary checkout is
  // parked on a feature branch that predates it. Reproduces the jig case where
  // dozens of merged docs/bugs/*.md were mislabeled.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-wt-hygiene-'));
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
  const writeDoc = (rel, body) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    // An ADR makes the project jig-managed, so hygiene is computed at all.
    writeDoc(path.join('docs', 'decisions', 'adr-0001-x.md'), '# ADR 1\n');
    // main carries a merged bug doc.
    writeDoc(path.join('docs', 'bugs', 'merged.md'), '# merged\n');
    git('add', '-A');
    git('commit', '-qm', 'merged doc on main');
    // Primary checkout is parked on a feature branch that lacks merged.md.
    git('checkout', '-q', '-b', 'feature/parked');
    git('rm', '-q', path.join('docs', 'bugs', 'merged.md'));
    git('commit', '-qm', 'feature branch without merged doc');
    // A worktree checkout holds both the merged doc and a genuinely-lost one.
    const wt = path.join(root, '.claude', 'worktrees', 'wt-x');
    writeDoc(path.join('.claude', 'worktrees', 'wt-x', 'docs', 'bugs', 'merged.md'), '# merged\n');
    writeDoc(path.join('.claude', 'worktrees', 'wt-x', 'docs', 'bugs', 'lost.md'), '# lost\n');
    assert.ok(fs.existsSync(wt));

    const p = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
    const flagged = p.worktreeOnlyDocs.map((d) => d.path);
    // merged.md is on main → not at risk, even though the parked working tree lacks it.
    assert.ok(!flagged.includes(path.join('docs', 'bugs', 'merged.md')), `merged doc should not be flagged; got ${JSON.stringify(flagged)}`);
    // lost.md is on neither main nor the working tree → genuinely worktree-only.
    assert.deepEqual(flagged, [path.join('docs', 'bugs', 'lost.md')]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Shared setup for the git-backed worktree tests: a repo on main with an ADR
// (so it is jig-managed) and a helper to commit files.
function initRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-wt-')));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
  const write = (rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  return { root, git, write };
}

test('worktree hygiene skips fully-merged worktrees, keeps genuinely unmerged ones', () => {
  const { root, git, write } = initRepo();
  try {
    write(path.join('docs', 'decisions', 'adr-0001-x.md'), '# ADR\n');
    write(path.join('docs', 'bugs', 'merged-then-deleted.md'), '# m\n');
    git('add', '-A'); git('commit', '-qm', 'c1');
    git('branch', 'merged-wt');                 // ancestor point, still has the doc
    git('rm', '-q', path.join('docs', 'bugs', 'merged-then-deleted.md'));
    git('commit', '-qm', 'delete on main');     // main advances; merged-wt is now an ancestor
    // A fully-merged worktree: HEAD is an ancestor of main, and it still holds a
    // doc that main later removed. Nothing here is at risk → must be skipped.
    git('worktree', 'add', '-q', path.join('.claude', 'worktrees', 'merged-wt'), 'merged-wt');
    // A genuinely-unmerged worktree with a new doc that never reached main.
    git('worktree', 'add', '-q', '-b', 'feature-wt', path.join('.claude', 'worktrees', 'feature-wt'), 'main');
    const fwt = path.join(root, '.claude', 'worktrees', 'feature-wt');
    fs.mkdirSync(path.join(fwt, 'docs', 'bugs'), { recursive: true });
    fs.writeFileSync(path.join(fwt, 'docs', 'bugs', 'genuine.md'), '# g\n');
    execFileSync('git', ['-C', fwt, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', fwt, 'commit', '-qm', 'unmerged doc'], { stdio: 'ignore' });

    const p = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
    const flagged = p.worktreeOnlyDocs.map((d) => d.path);
    assert.ok(!flagged.includes(path.join('docs', 'bugs', 'merged-then-deleted.md')), `merged worktree committed doc should be skipped; got ${JSON.stringify(flagged)}`);
    assert.deepEqual(flagged, [path.join('docs', 'bugs', 'genuine.md')]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('worktree hygiene still flags UNTRACKED drafts inside a fully-merged worktree', () => {
  const { root, git, write } = initRepo();
  try {
    write(path.join('docs', 'decisions', 'adr-0001-x.md'), '# ADR\n');
    git('add', '-A'); git('commit', '-qm', 'c1');
    // A worktree at main (fully merged, detached so it doesn't claim the branch)
    // carrying an UNTRACKED draft — the doc exists nowhere in git, so it is lost
    // if the worktree is removed.
    git('worktree', 'add', '-q', '--detach', path.join('.claude', 'worktrees', 'merged-wt'), 'main');
    const wt = path.join(root, '.claude', 'worktrees', 'merged-wt');
    fs.mkdirSync(path.join(wt, 'docs', 'bugs'), { recursive: true });
    fs.writeFileSync(path.join(wt, 'docs', 'bugs', 'draft.md'), '# never committed\n');

    const p = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
    const flagged = p.worktreeOnlyDocs.map((d) => d.path);
    assert.deepEqual(flagged, [path.join('docs', 'bugs', 'draft.md')], `untracked draft in merged worktree must be flagged; got ${JSON.stringify(flagged)}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a doc committed in a merged worktree is safe wherever else it appears (order-independent)', () => {
  const { root, git, write } = initRepo();
  try {
    write(path.join('docs', 'decisions', 'adr-0001-x.md'), '# ADR\n');
    write(path.join('docs', 'spikes', 'shared.md'), '# shared\n');
    git('add', '-A'); git('commit', '-qm', 'c1');
    git('branch', 'merged-wt');                          // ancestor point, has shared.md
    git('rm', '-q', path.join('docs', 'spikes', 'shared.md'));
    git('commit', '-qm', 'delete shared.md on main');    // shared.md now off main's current tree
    // shared.md is committed in a MERGED worktree (recoverable from history)...
    git('worktree', 'add', '-q', path.join('.claude', 'worktrees', 'merged-wt'), 'merged-wt');
    // ...and ALSO committed on an UNMERGED branch. It must NOT be flagged from
    // either, regardless of which worktree the walk visits first.
    git('worktree', 'add', '-q', '-b', 'feature-wt', path.join('.claude', 'worktrees', 'feature-wt'), 'merged-wt');
    const fwt = path.join(root, '.claude', 'worktrees', 'feature-wt');
    fs.writeFileSync(path.join(fwt, 'docs', 'spikes', 'only-here.md'), '# genuinely unmerged\n');
    execFileSync('git', ['-C', fwt, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', fwt, 'commit', '-qm', 'diverge with a new doc'], { stdio: 'ignore' });

    const flagged = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] })
      .worktreeOnlyDocs.map((d) => d.path);
    assert.ok(!flagged.includes(path.join('docs', 'spikes', 'shared.md')), `recoverable doc must not be flagged; got ${JSON.stringify(flagged)}`);
    assert.deepEqual(flagged, [path.join('docs', 'spikes', 'only-here.md')]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('worktree hygiene is scoped to the project artifactRoot; unscoped docs are dropped', () => {
  const { root, git, write } = initRepo();
  try {
    // Two artifact subtrees, each jig-managed by its own ADR (multi-entry shape).
    write(path.join('docs', 'opportunities', 'cwv', 'decisions', 'adr-0001-x.md'), '# ADR\n');
    write(path.join('docs', 'superpowers', 'decisions', 'adr-0001-x.md'), '# ADR\n');
    git('add', '-A'); git('commit', '-qm', 'roots');
    // One unmerged worktree carrying a doc in each subtree plus an unscoped one.
    git('worktree', 'add', '-q', '-b', 'feature-wt', path.join('.claude', 'worktrees', 'feature-wt'), 'main');
    const fwt = path.join(root, '.claude', 'worktrees', 'feature-wt');
    const w = (rel) => { const abs = path.join(fwt, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, 'x'); };
    w(path.join('docs', 'opportunities', 'cwv', 'specs', 'a.md'));
    w(path.join('docs', 'superpowers', 'notes', 'b.md'));
    w(path.join('docs', 'blackboard', 'c.md')); // under no project root → dropped
    execFileSync('git', ['-C', fwt, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', fwt, 'commit', '-qm', 'docs'], { stdio: 'ignore' });

    const scan = (artifactRoot) => scanProject({ path: root, label: 'e', pinnedWorkstreams: [], hiddenWorkstreams: [], profile: { artifactRoot } })
      .worktreeOnlyDocs.map((d) => d.path);
    const cwv = scan(path.join(root, 'docs', 'opportunities', 'cwv'));
    const sup = scan(path.join(root, 'docs', 'superpowers'));
    assert.deepEqual(cwv, [path.join('docs', 'opportunities', 'cwv', 'specs', 'a.md')]);
    assert.deepEqual(sup, [path.join('docs', 'superpowers', 'notes', 'b.md')]);
    // The unscoped repo-level doc appears on neither card.
    assert.ok(!cwv.concat(sup).some((f) => f.includes('blackboard')), 'unscoped doc must be dropped');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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

// --- 008-02: specLayout: auto resolves nested-vs-flat at read time (ADR-0010 A3) ---

test('auto specLayout on a nested-only root reads identically to explicit nested (008-02 AC1)', () => {
  const explicitNested = scanProject({
    path: path.join(FIXTURES, 'proj-mixed'), label: 'cwv', pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(FIXTURES, 'proj-mixed', 'docs', 'opportunities', 'cwv'), specLayout: 'nested' },
  });
  const auto = scanProject({
    path: path.join(FIXTURES, 'proj-mixed'), label: 'cwv', pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(FIXTURES, 'proj-mixed', 'docs', 'opportunities', 'cwv'), specLayout: 'auto' },
  });
  assert.equal(auto.jigManaged, true);
  assert.deepEqual(auto, explicitNested);
});

test('auto specLayout on a flat-only root reads identically to explicit flat (008-02 AC1)', () => {
  const explicitFlat = scanProject({
    path: path.join(FIXTURES, 'proj-mixed'), label: 'superpowers', pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(FIXTURES, 'proj-mixed', 'docs', 'superpowers'), specLayout: 'flat' },
  });
  const auto = scanProject({
    path: path.join(FIXTURES, 'proj-mixed'), label: 'superpowers', pinnedWorkstreams: [], hiddenWorkstreams: [],
    profile: { artifactRoot: path.join(FIXTURES, 'proj-mixed', 'docs', 'superpowers'), specLayout: 'auto' },
  });
  assert.equal(auto.jigManaged, true);
  assert.equal(auto.specs.length, 2);
  assert.deepEqual(auto, explicitFlat);
});

test('auto specLayout on a mixed root resolves nested, per ADR-0010 A3 (008-02 AC1)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-mixed-'));
  try {
    const specs = path.join(base, 'docs', 'specs');
    fs.mkdirSync(path.join(specs, '001-x'), { recursive: true });
    fs.writeFileSync(path.join(specs, '001-x', 'spec.md'), '---\nstatus: DONE\n---\n# X\n');
    fs.writeFileSync(path.join(specs, 'stray-design.md'), '# Stray\n');
    const p = scanProject({
      path: base, label: 'mixed', pinnedWorkstreams: [], hiddenWorkstreams: [],
      profile: { artifactRoot: path.join(base, 'docs'), specLayout: 'auto' },
    });
    assert.equal(p.jigManaged, true);
    // Nested reader used: exactly the one nested spec, the stray flat file ignored.
    assert.equal(p.specs.length, 1);
    assert.equal(p.specs[0].id, '001-x');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('auto specLayout on an empty declared root does not fabricate a card (008-02 AC1)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-empty-'));
  try {
    fs.mkdirSync(path.join(base, 'docs', 'specs'), { recursive: true });
    fs.writeFileSync(path.join(base, 'docs', 'specs', 'README.md'), '# index\n');
    const p = scanProject({
      path: base, label: 'empty', pinnedWorkstreams: [], hiddenWorkstreams: [],
      profile: { artifactRoot: path.join(base, 'docs'), specLayout: 'auto' },
    });
    assert.equal(p.jigManaged, false);
    assert.equal(p.specs, undefined);
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
