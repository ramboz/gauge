// Optional Jig adapter implementation retained from the POC (spec 002).
// This module is read-only; Gauge callers consume its output only through
// src/observation.mjs's canonical signal boundary.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseFrontmatter,
  normStatus,
  progressOf,
  parseRunbook,
  countCheckboxes,
  countInboxItems,
  countRefinement,
  parseCompassHistory,
  ageLabel,
  ageDays,
  BUG_CLOSED,
} from './lib.mjs';
import { PROFILE_DEFAULTS } from './profile.mjs';
// detectLayout (ADR-0010 A3, slice 008-02) is the shared nested-vs-flat
// heuristic, defined once in the pure discover.mjs module and reused here
// for `specLayout: auto` so the adapter's read-time resolution and
// discovery's proposed-profile emission can never diverge. This is a
// one-directional import (scan.mjs → discover.mjs, a pure/edge-reusable
// module) — it does not touch discover.mjs's own purity contract.
import { detectLayout } from './discover.mjs';

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readIf(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function* walkMd(dir, base) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walkMd(path.join(dir, e.name), base);
    } else if (e.name.endsWith('.md')) {
      yield path.relative(base, path.join(dir, e.name));
    }
  }
}

// Project-shape profile defaults (ADR-0009, spec 007-01): a project with no
// resolved profile scans exactly the conventional docs/{specs,decisions}
// roots it always has — byte-identical to pre-007-01 behavior. When
// src/config.mjs threads a resolved profile, `artifactRoot` is already an
// absolute path (resolved relative to the project root); callers that bypass
// config.mjs (e.g. direct scanProject() calls in tests) fall back here.
// Defaults are sourced from src/profile.mjs (single source of truth — do not
// re-hardcode 'docs'/'specs'/'decisions'/'status' here).
function resolvedProfile(projectCfg) {
  const root = projectCfg.path;
  const profile = projectCfg.profile || {};
  return {
    artifactRoot: profile.artifactRoot || path.join(root, PROFILE_DEFAULTS.artifactRoot),
    specsDir: profile.specsDir || PROFILE_DEFAULTS.specsDir,
    decisionsDir: profile.decisionsDir || PROFILE_DEFAULTS.decisionsDir,
    statusProperty: profile.statusProperty || PROFILE_DEFAULTS.statusProperty,
    specLayout: profile.specLayout || PROFILE_DEFAULTS.specLayout,
  };
}

// A spec artifact's title: its first `#` heading (stripping a leading
// `Spec N:` / `Spec N —` prefix), else a supplied fallback (the dir/file name).
// Shared by both layouts so flat and nested titles are derived identically.
function titleOf(body, fallback) {
  const titleMatch = body.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].replace(/^Spec\s+\d+\s*[:—-]\s*/i, '').trim() : fallback;
}

// Flat layout (ADR-0010, slice 008-01): each `<specsDir>/<name>.md` is one spec
// artifact (README skipped). No sub-slices exist in a flat layout, so `slices`
// is always []. Status resolution is unchanged (frontmatter statusProperty);
// a flat doc with only a prose status resolves null, which the completion gate
// (observation.mjs) turns into honest `unknown`.
function scanSpecsFlat(specsDir, statusProperty) {
  const specs = [];
  for (const f of fs.readdirSync(specsDir).sort()) {
    if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
    const raw = readIf(path.join(specsDir, f));
    if (raw === null) continue;
    const { data, body } = parseFrontmatter(raw);
    const id = f.replace(/\.md$/, '');
    specs.push({ id, title: titleOf(body, id), status: normStatus(data[statusProperty]), slices: [] });
  }
  specs.sort((a, b) => a.id.localeCompare(b.id));
  return specs;
}

// `auto` (ADR-0010 A3, slice 008-02) resolves to a concrete nested/flat
// decision here, at read time, via the shared detectLayout heuristic — a
// profile explicitly declaring `flat` or `nested` bypasses detection
// entirely (honors the author).
function resolveLayout(artifactRoot, specsDirName, specLayout) {
  return specLayout === 'auto' ? detectLayout(artifactRoot, specsDirName) : specLayout;
}

function scanSpecs(artifactRoot, specsDirName, statusProperty, specLayout) {
  const specsDir = path.join(artifactRoot, specsDirName);
  if (!isDir(specsDir)) return null;
  const layout = resolveLayout(artifactRoot, specsDirName, specLayout);
  if (layout === 'flat') return scanSpecsFlat(specsDir, statusProperty);
  const specs = [];
  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(specsDir, entry.name);
    const raw = readIf(path.join(dir, 'spec.md'));
    if (raw === null) continue;
    const { data, body } = parseFrontmatter(raw);
    const title = titleOf(body, entry.name);
    const slices = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^slice-.*\.md$/.test(f)) continue;
      const fm = parseFrontmatter(readIf(path.join(dir, f)) || '').data;
      slices.push({
        file: f,
        status: normStatus(fm[statusProperty]),
        dependencies: Array.isArray(fm.dependencies) ? fm.dependencies : [],
        lastVerified: fm.last_verified || null,
      });
    }
    specs.push({ id: entry.name, title, status: normStatus(data[statusProperty]), slices });
  }
  specs.sort((a, b) => a.id.localeCompare(b.id));
  return specs;
}

// bugs/ (like releases/) has no profile override in v1 — it is always the
// sibling of specs/decisions under the resolved artifactRoot.
function scanBugs(artifactRoot) {
  const dir = path.join(artifactRoot, 'bugs');
  if (!isDir(dir)) return { open: 0, total: 0 };
  let open = 0;
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
    total++;
    const status = normStatus(parseFrontmatter(readIf(path.join(dir, f)) || '').data.status);
    if (!status || !BUG_CLOSED.has(status)) open++;
  }
  return { open, total };
}

export function gitInfo(root) {
  const run = (args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const revision = run(['rev-parse', 'HEAD']);
    const commits = parseInt(run(['rev-list', '--count', 'HEAD']), 10);
    const lastCommit = run(['log', '-1', '--format=%cs']);
    const firstCommit = run(['log', '--reverse', '--format=%cs']).split('\n')[0];
    return { revision, firstCommit, lastCommit, commits };
  } catch {
    return null;
  }
}

// Scoped to the resolved artifactRoot (spec 007-01 blocker 1): a profiled
// nested sub-project (artifactRoot = docs/opportunities/cwv) walks only its
// own subtree, never the umbrella repo's sibling docs/{releases,bugs,...}.
// Output `path` labels stay root-relative (matching pinnedWorkstreams /
// hiddenWorkstreams, which the caller supplies as root-relative strings);
// walkMd(artifactRoot, root) yields exactly that while only visiting files
// under artifactRoot. With the default profile, artifactRoot === <root>/docs
// and every label/exclusion below is byte-identical to pre-007-01 behavior.
function scanWorkstreams(root, profile, projectCfg) {
  const workstreams = [];
  const discovered = [];
  const pinned = new Set(projectCfg.pinnedWorkstreams);
  const hidden = new Set(projectCfg.hiddenWorkstreams);
  const { artifactRoot, specsDir } = profile;
  const artifactRootLabel = path.relative(root, artifactRoot);

  const releasesDir = path.join(artifactRoot, 'releases');
  const releasesLabel = path.join(artifactRootLabel, 'releases');
  if (isDir(releasesDir)) {
    for (const f of fs.readdirSync(releasesDir).sort()) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
      const rel = path.join(releasesLabel, f);
      if (hidden.has(rel)) continue;
      const rb = parseRunbook(readIf(path.join(releasesDir, f)) || '');
      workstreams.push({ kind: 'release', path: rel, ...rb });
    }
  }

  for (const rel of projectCfg.pinnedWorkstreams) {
    // Release plans render unconditionally above — a pin there would duplicate the row.
    if (rel.startsWith(releasesLabel + path.sep)) continue;
    const abs = path.join(root, rel);
    const raw = readIf(abs);
    if (raw === null) continue; // missing pin → the worktree scan may explain why
    workstreams.push({ kind: 'runbook', path: rel, ...parseRunbook(raw) });
  }

  if (isDir(artifactRoot)) {
    const specsLabel = path.join(artifactRootLabel, specsDir);
    const bugsLabel = path.join(artifactRootLabel, 'bugs');
    const adoptionReadinessLabel = path.join(artifactRootLabel, 'adoption-readiness.md');
    for (const rel of walkMd(artifactRoot, root)) {
      if (rel.startsWith(specsLabel + path.sep)) continue;
      if (rel.startsWith(releasesLabel + path.sep)) continue;
      // Bugs have their own counter; their DoD checklists are not workstreams.
      if (rel.startsWith(bugsLabel + path.sep)) continue;
      // Scaffold boilerplate, identical in every jig project — pin explicitly if wanted.
      if (rel === adoptionReadinessLabel) continue;
      if (pinned.has(rel) || hidden.has(rel)) continue;
      const raw = readIf(path.join(root, rel));
      if (raw === null) continue;
      const boxes = countCheckboxes(raw);
      if (boxes.total >= 3) {
        const rb = parseRunbook(raw);
        discovered.push({ path: rel, title: rb.title, steps: boxes });
      }
    }
  }
  return { workstreams, discovered };
}

const WORKTREE_DOC_CAP = 40;

// The "already merged" baseline for worktree hygiene: the union of doc paths
// committed on any of the repo's mainline refs (local and remote default
// branch). Comparing worktree docs against THIS — rather than the primary
// checkout's working tree — is what stops an already-merged doc from being
// mislabeled "worktree-only" merely because the primary checkout happens to be
// parked on a feature branch that predates it (the common case, and the source
// of the false-positive inflation). The union matters for the local-single-
// user model: a doc merged to LOCAL main but not yet pushed is not at risk, and
// neither is one on origin/main when local main lags. Paths are normalized to
// forward slashes. Returns an empty set when `root` is not a git repo or has no
// resolvable mainline ref; the caller then degrades to a working-tree-only
// comparison, preserving pre-fix behavior for non-git trees.
function mergedDocPaths(root) {
  const run = (args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  const refs = new Set(['main', 'master', 'origin/main', 'origin/master']);
  try {
    // Whatever origin/HEAD points at, in case the default branch is named
    // something other than main/master (e.g. "trunk", "develop").
    const head = run(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).trim();
    if (head) refs.add(head.replace(/^refs\/remotes\//, ''));
  } catch { /* no origin/HEAD; the well-known names still apply */ }
  const set = new Set();
  for (const ref of refs) {
    try {
      const listing = run(['ls-tree', '-r', '--name-only', ref, '--', 'docs']);
      for (const line of listing.split('\n')) { if (line) set.add(line); }
    } catch { /* ref does not resolve in this repo — skip it */ }
  }
  return set;
}

// Deliberately repo-root-scoped, not artifactRoot-scoped (spec 007-01 blocker
// 1 exception): worktree hygiene tracks docs lost to abandoned `.claude/
// worktrees/*` checkouts, a whole-git-repo concern, not a per-sub-project one.
// A nested profile (e.g. artifactRoot = docs/opportunities/cwv) still sees
// worktree-only docs from anywhere in the repo's worktree checkouts.
function scanWorktreeOnlyDocs(root) {
  const wtRoot = path.join(root, '.claude', 'worktrees');
  if (!isDir(wtRoot)) return [];
  const merged = mergedDocPaths(root);
  const out = [];
  const seen = new Set();
  for (const wt of fs.readdirSync(wtRoot, { withFileTypes: true })) {
    if (!wt.isDirectory()) continue;
    const wtBase = path.join(wtRoot, wt.name);
    const wtDocs = path.join(wtBase, 'docs');
    if (!isDir(wtDocs)) continue;
    for (const rel of walkMd(wtDocs, wtBase)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      // Path-existence comparison only, never content diffing (slice 002-02 AC4).
      // "Worktree-only" (at risk of loss) means absent from BOTH the primary
      // checkout's working tree AND the default branch's committed tree — the
      // latter is what keeps already-merged docs off the list when the primary
      // checkout is sitting on an unrelated feature branch.
      const relKey = rel.split(path.sep).join('/');
      if (!fs.existsSync(path.join(root, rel)) && !merged.has(relKey)) {
        out.push({ worktree: wt.name, path: rel });
        if (out.length >= WORKTREE_DOC_CAP) return out;
      }
    }
  }
  return out;
}

function scanCompass(artifactRoot) {
  const raw = readIf(path.join(artifactRoot, 'status', 'compass-history.jsonl'));
  if (raw === null) return { latest: null, malformed: 0, count: 0 };
  return parseCompassHistory(raw);
}

// Concrete jig evidence, not a bare directory: a scaffolded marker, at least one
// real spec (a docs/specs/*/spec.md), or at least one jig-convention ADR. A lone
// empty docs/specs/ dir — or an incidental one in an otherwise generic repo — no
// longer counts, so such projects degrade to generic instead of a false 0/0.
// The spec-evidence check is layout-aware (ADR-0010 sub-decision 4, tier 2): a
// declared root is trackable only when it holds ≥1 artifact matching the
// declared specLayout — a nested `<dir>/spec.md`, or (flat) a non-README
// `<name>.md`. An empty/irrelevant declared root fabricates no card.
// `specLayout: auto` (slice 008-02) resolves via the same detectLayout
// heuristic scanSpecs uses, so the evidence gate and the reader can never
// disagree about which check applies.
function hasJigEvidence(root, profile) {
  if (fs.existsSync(path.join(root, 'scaffold.json'))) return true;
  const specsDir = path.join(profile.artifactRoot, profile.specsDir);
  if (isDir(specsDir)) {
    const layout = resolveLayout(profile.artifactRoot, profile.specsDir, profile.specLayout);
    if (layout === 'flat') {
      if (fs.readdirSync(specsDir).some((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')) return true;
    } else {
      for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
        if (entry.isDirectory() && fs.existsSync(path.join(specsDir, entry.name, 'spec.md'))) return true;
      }
    }
  }
  const decisionsDir = path.join(profile.artifactRoot, profile.decisionsDir);
  if (isDir(decisionsDir) && fs.readdirSync(decisionsDir).some((f) => /^adr-\d+.*\.md$/.test(f))) return true;
  return false;
}

export function scanProject(projectCfg) {
  const root = projectCfg.path;
  const name = projectCfg.label || path.basename(root);
  if (!isDir(root)) {
    return { name, path: root, error: 'path does not exist' };
  }
  const profile = resolvedProfile(projectCfg);
  const jigManaged = hasJigEvidence(root, profile);
  const result = {
    name,
    path: root,
    jigManaged,
    git: gitInfo(root),
  };
  if (!jigManaged) return result;

  // A jig-managed project may still have no specs at the conventional root
  // (e.g. artifacts nested under a subpath). Keep specs an array and leave
  // progress null so the adapter can report insufficient evidence, not 0/0.
  const specs = scanSpecs(profile.artifactRoot, profile.specsDir, profile.statusProperty, profile.specLayout) || [];
  result.specs = specs;
  if (specs.length) {
    const allSlices = specs.flatMap((s) => s.slices);
    result.progress = progressOf(specs);
    result.sliceProgress = allSlices.length ? progressOf(allSlices) : null;
  } else {
    result.progress = null;
    result.sliceProgress = null;
  }
  const decisionsDir = path.join(profile.artifactRoot, profile.decisionsDir);
  result.counts = {
    bugs: scanBugs(profile.artifactRoot),
    refinement: countRefinement(readIf(path.join(profile.artifactRoot, 'refinement-todo.md')) || ''),
    inbox: countInboxItems(readIf(path.join(profile.artifactRoot, 'inbox.md')) || ''),
    adrs: isDir(decisionsDir)
      ? fs.readdirSync(decisionsDir).filter((f) => /^adr-\d+.*\.md$/.test(f)).length
      : 0,
  };
  Object.assign(result, scanWorkstreams(root, profile, projectCfg));
  // Repo-root-scoped by design, not artifactRoot-scoped — see scanWorktreeOnlyDocs.
  result.worktreeOnlyDocs = scanWorktreeOnlyDocs(root);
  const compass = scanCompass(profile.artifactRoot);
  result.compass = compass.latest
    ? {
        ...compass.latest,
        ageLabel: ageLabel(compass.latest.ts),
        ageDays: ageDays(compass.latest.ts),
        stale: (ageDays(compass.latest.ts) ?? 0) > 7,
      }
    : null;
  result.warnings = [];
  if (compass.malformed > 0) {
    result.warnings.push(`compass-history.jsonl: ${compass.malformed} malformed line(s) skipped`);
  }
  return result;
}

export function scanAll(config) {
  return {
    generatedAt: new Date().toISOString(),
    projects: config.projects.map(scanProject),
  };
}
