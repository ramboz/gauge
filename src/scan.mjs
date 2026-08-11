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
  parseReleaseStatus,
  parseReleaseAppetite,
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
      const raw = readIf(path.join(releasesDir, f)) || '';
      const rb = parseRunbook(raw);
      // Lifecycle status + appetite (spec 011-01, ADR-0011 shaper release-plan
      // convention): parsed alongside the existing runbook fields so the
      // active/next milestone deriver (src/milestone.mjs) has what it needs
      // without a second read. Neither is a "goal"/"deadline" value (that
      // remains discover.mjs/ADR-0011's exclusive concern) — status is a
      // lifecycle label and appetite is a timebox phrase, not a date.
      workstreams.push({
        kind: 'release', path: rel, ...rb,
        status: parseReleaseStatus(raw),
        appetite: parseReleaseAppetite(raw),
      });
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
const WORKTREE_STALE_DAYS = 7;

const gitRun = (root, args) =>
  execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });

// The repo's mainline refs (local + remote default branch), in resolution
// order — used both to build the "already merged" doc-path baseline and to
// decide whether a worktree is fully merged. Includes whatever origin/HEAD
// points at, so a non-main/master default branch (e.g. "trunk") is covered.
// Returns only refs that resolve to a commit; empty for a non-git tree.
function mainlineRefs(root) {
  // Only when `root` is itself a git repo's top level. A project nested inside
  // another repo (or a non-git tree — including the test fixtures) would
  // otherwise resolve the OUTER repo's refs and worktree HEAD, mislabeling
  // docs; degrade to a working-tree-only comparison instead.
  try {
    const top = gitRun(root, ['rev-parse', '--show-toplevel']).trim();
    if (!top || fs.realpathSync(top) !== fs.realpathSync(root)) return [];
  } catch { return []; }
  const candidates = ['main', 'master', 'origin/main', 'origin/master'];
  try {
    const head = gitRun(root, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).trim();
    if (head) candidates.unshift(head.replace(/^refs\/remotes\//, ''));
  } catch { /* no origin/HEAD; the well-known names still apply */ }
  const refs = [];
  for (const ref of candidates) {
    if (refs.includes(ref)) continue;
    try { gitRun(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); refs.push(ref); }
    catch { /* ref does not resolve in this repo — skip it */ }
  }
  return refs;
}

// The "already merged" baseline: the union of doc paths committed on any
// mainline ref, restricted to `artifactRootRel` (the project's artifact
// subtree). Comparing worktree docs against THIS — rather than the primary
// checkout's working tree — stops an already-merged doc from being mislabeled
// "worktree-only" just because the primary checkout is parked on a feature
// branch that predates it. Paths are normalized to forward slashes.
function mergedDocPaths(root, refs, artifactRootRel) {
  const set = new Set();
  for (const ref of refs) {
    try {
      const listing = gitRun(root, ['ls-tree', '-r', '--name-only', ref, '--', artifactRootRel]);
      for (const line of listing.split('\n')) { if (line) set.add(line); }
    } catch { /* ref does not resolve / no such path — skip */ }
  }
  return set;
}

// True when a worktree's HEAD is already contained in a mainline ref: every
// commit in it is in mainline history, so its committed docs are recoverable
// (its untracked drafts are a separate concern the caller still surfaces).
function worktreeIsMerged(root, head, refs) {
  for (const ref of refs) {
    try { execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', head, ref], { stdio: 'ignore' }); return true; }
    catch { /* not an ancestor of this ref — try the next */ }
  }
  return false;
}

// The committed docs of a merged worktree, under `artifactRootRel` (forward-
// slash paths). Because the worktree's HEAD is an ancestor of a mainline ref,
// these blobs are reachable from mainline history and recoverable even though
// they may be absent from mainline's *current* tree (merged then deleted). They
// are therefore safe wherever they appear.
function mergedWorktreeDocPaths(wtBase, artifactRootRel) {
  const set = new Set();
  try {
    const listing = gitRun(wtBase, ['ls-tree', '-r', '--name-only', 'HEAD', '--', artifactRootRel]);
    for (const line of listing.split('\n')) { if (line) set.add(line); }
  } catch { /* not a git checkout / no such path */ }
  return set;
}

// Days since the worktree's HEAD commit, or null if it can't be read.
function worktreeAgeDays(wtBase, nowMs) {
  try {
    const ct = Number(gitRun(wtBase, ['log', '-1', '--format=%ct', 'HEAD']).trim());
    if (!Number.isFinite(ct)) return null;
    return (nowMs / 1000 - ct) / 86400;
  } catch { return null; }
}

// True when the worktree's HEAD is reachable from a non-mainline remote-tracking
// ref — a local, offline proxy for "an open PR exists" (ADR-0015). Works for a
// detached HEAD too, since it matches by commit, not branch name. Merged
// worktrees are excluded before this runs, so a match here is a feature branch
// pushed to origin, not the mainline itself.
function worktreePushed(root, head, refs) {
  const mainline = new Set(refs.filter((ref) => ref.includes('/')));
  try {
    const out = gitRun(root, ['branch', '-r', '--contains', head, '--format=%(refname:short)']);
    for (const line of out.split('\n')) {
      const ref = line.trim();
      if (!ref || ref.includes('->') || ref.endsWith('/HEAD') || mainline.has(ref)) continue;
      return true;
    }
  } catch { /* no such commit on a remote / no remote — not pushed */ }
  return false;
}

// Recency state of a worktree (ADR-0015), ORTHOGONAL to `pushed` so that a
// pushed-then-abandoned worktree is still reported as stale (its remote ref may
// linger after a PR merged/closed) rather than masquerading as an open PR:
//   active  — last commit within WORKTREE_STALE_DAYS
//   stale   — no commit within the window (quiet/forgotten)
//   unknown — recency indeterminate; never coerced to a healthier state
function worktreeRecency(wtBase, nowMs) {
  const age = worktreeAgeDays(wtBase, nowMs);
  if (age === null) return 'unknown';
  return age <= WORKTREE_STALE_DAYS ? 'active' : 'stale';
}

// Optional GitHub PR resolution (ADR-0016). The default runner shells out to
// `gh` in the repo dir (which infers owner/repo from the remote). Injectable so
// tests can supply canned PR data without a network call.
function realGhPullRequests(root) {
  const out = execFileSync('gh',
    ['pr', 'list', '--state', 'all', '--limit', '300', '--json', 'number,url,state,headRefName,headRefOid'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(out);
}

// Index a repo's PRs by head branch AND head commit, so a worktree matches
// whether it is on a branch or a detached HEAD. On a reused branch name, an OPEN
// PR wins over MERGED/CLOSED, then the highest number. Exported for tests.
export function indexPullRequests(prs) {
  const byBranch = new Map();
  const byOid = new Map();
  const rankOf = (state) => (state === 'OPEN' ? 2 : state === 'MERGED' ? 1 : 0);
  for (const pr of prs || []) {
    const entry = { number: pr.number, url: pr.url, state: pr.state };
    if (pr.headRefOid) byOid.set(pr.headRefOid, entry);
    if (pr.headRefName) {
      const prev = byBranch.get(pr.headRefName);
      if (!prev || rankOf(pr.state) > rankOf(prev.state)
        || (rankOf(pr.state) === rankOf(prev.state) && pr.number > prev.number)) {
        byBranch.set(pr.headRefName, entry);
      }
    }
  }
  return { byBranch, byOid };
}

// undefined → PR resolution was off or failed (caller falls back to the proxy).
// An entry → the matching PR. null → resolution ran but this worktree has no PR.
function matchPullRequest(index, branch, head) {
  if (!index) return undefined;
  return (branch && index.byBranch.get(branch)) || (head && index.byOid.get(head)) || null;
}

// Build the repo's PR index once, or null on ANY failure (gh missing, unauthed,
// offline, non-GitHub remote) so hygiene degrades to the local push-proxy.
function resolveRepoPullRequests(root, ghRunner) {
  try { return indexPullRequests(ghRunner(root)); }
  catch { return null; }
}

// Worktree hygiene, scoped to the project's artifact subtree (spec 007-01
// blocker 1 was later reversed by owner direction; ADR-0014): a multi-entry
// repo's entries must not each show the same repo-wide list, so a worktree doc
// is attributed only to the project whose `artifactRootRel` prefix contains it;
// docs under no project's root are dropped. A doc is "at risk" only when its
// content is not recoverable from mainline-reachable history. The `safe` set
// captures exactly that: mainline's current tree PLUS every merged worktree's
// committed docs (recoverable via their ancestor commits). It is built in full
// BEFORE the walk so the outcome is independent of worktree iteration order —
// a doc committed in a merged worktree is safe wherever else it also appears.
// What remains flagged: docs committed only on unmerged branches, and untracked
// drafts in any worktree (they exist nowhere in git). A non-git tree resolves
// no refs, so `safe` is just the (empty) mainline set and the scan degrades to
// a working-tree-only comparison. Worktrees are walked in name order for a
// deterministic attribution when a doc appears in more than one.
function scanWorktreeOnlyDocs(root, artifactRootRel, opts = {}) {
  const wtRoot = path.join(root, '.claude', 'worktrees');
  if (!isDir(wtRoot)) return [];
  const resolvePRs = Boolean(opts.resolvePRs);
  const ghRunner = opts.ghRunner || realGhPullRequests;
  const refs = mainlineRefs(root);
  const worktrees = fs.readdirSync(wtRoot, { withFileTypes: true })
    .filter((wt) => wt.isDirectory())
    .map((wt) => wt.name)
    .sort();
  const nowMs = Date.now();
  const safe = mergedDocPaths(root, refs, artifactRootRel);
  // Pass 1: resolve each worktree's HEAD, and feed merged worktrees' committed
  // docs into `safe`. HEADs are kept for the (lazy) state classification below.
  const heads = new Map();
  for (const name of worktrees) {
    const wtBase = path.join(wtRoot, name);
    let head = null;
    try { head = gitRun(wtBase, ['rev-parse', 'HEAD']).trim(); } catch { /* not a git checkout */ }
    heads.set(name, head);
    if (head && refs.length && worktreeIsMerged(root, head, refs)) {
      for (const p of mergedWorktreeDocPaths(wtBase, artifactRootRel)) safe.add(p);
    }
  }
  // Lifecycle metadata — recency `state` + orthogonal `pushed` (ADR-0015), plus
  // an optional resolved `pr` (ADR-0016) — computed lazily, only for worktrees
  // that contribute a flagged doc, so the merged majority pays nothing. The PR
  // index is resolved at most once, and only if resolution is enabled AND some
  // doc is actually flagged (the first metaFor call triggers it).
  let prIndex; // undefined = not yet computed; null = disabled/failed
  const prIndexFor = () => {
    if (prIndex === undefined) prIndex = resolvePRs ? resolveRepoPullRequests(root, ghRunner) : null;
    return prIndex;
  };
  const metaCache = new Map();
  const metaFor = (name, wtBase) => {
    if (!metaCache.has(name)) {
      const head = heads.get(name);
      const index = prIndexFor();
      let branch = null;
      if (index) { try { branch = gitRun(wtBase, ['symbolic-ref', '--quiet', '--short', 'HEAD']).trim() || null; } catch { /* detached */ } }
      metaCache.set(name, {
        state: worktreeRecency(wtBase, nowMs),
        pushed: Boolean(head && refs.length && worktreePushed(root, head, refs)),
        pr: index ? matchPullRequest(index, branch, head) : undefined,
      });
    }
    return metaCache.get(name);
  };
  // Pass 2: flag at-risk docs, each tagged with its worktree's state + pushed
  // (+ pr when resolved).
  const out = [];
  const seen = new Set();
  for (const name of worktrees) {
    const wtBase = path.join(wtRoot, name);
    const wtDocs = path.join(wtBase, artifactRootRel);
    if (!isDir(wtDocs)) continue;
    for (const rel of walkMd(wtDocs, wtBase)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      // Path-existence comparison only, never content diffing (slice 002-02 AC4).
      const relKey = rel.split(path.sep).join('/');
      if (fs.existsSync(path.join(root, rel)) || safe.has(relKey)) continue;
      const meta = metaFor(name, wtBase);
      const doc = { worktree: name, path: rel, state: meta.state, pushed: meta.pushed };
      if (meta.pr !== undefined) doc.pr = meta.pr; // object (resolved PR) or null (resolved, none)
      out.push(doc);
      if (out.length >= WORKTREE_DOC_CAP) return out;
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

export function scanProject(projectCfg, deps = {}) {
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
  // Scoped to this project's artifact subtree so a multi-entry repo's entries
  // don't each show the same repo-wide list — see scanWorktreeOnlyDocs.
  const artifactRootRel = path.relative(root, profile.artifactRoot).split(path.sep).join('/');
  result.worktreeOnlyDocs = scanWorktreeOnlyDocs(root, artifactRootRel, {
    resolvePRs: Boolean(projectCfg.resolvePullRequests),
    ghRunner: deps.ghRunner,
  });
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
    projects: config.projects.map((projectCfg) => scanProject(projectCfg)),
  };
}
