// Profile discovery (spec 007-03, ADR-0009): read-only introspection of a
// source that authors a valid project-profile-v1 document. It prefers a
// source's own self-declaration (repos.yaml scope tags, a tracks/*/{specs,
// decisions} layout) over heuristics, honoring project authority (ADR-0003).
//
// Purity contract (AC5): this module is edge-reusable and carries NO
// central-only assumptions. It imports only node builtins and safeProjectId
// from src/config.mjs — never the central collection/state/server modules —
// so spec 006's edge skill can reuse it to self-profile at onboarding time.
//
// Read-only contract (AC4): every filesystem touch is a read (readdirSync /
// statSync). Discovery emits a profile; it never writes and never collects
// observations.
import fs from 'node:fs';
import path from 'node:path';
import { safeProjectId } from './config.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
const MAX_DEPTH = 4;

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readDirs(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// An "artifact-root" directory directly holds a specs/ or decisions/ subdir.
function isArtifactRoot(absDir) {
  return isDir(path.join(absDir, 'specs')) || isDir(path.join(absDir, 'decisions'));
}

// Layout detection (ADR-0010 A3, slice 008-02): pure, deterministic
// nested-vs-flat inspection, reused by both the adapter's `specLayout: auto`
// resolution (src/scan.mjs, at read time) and this module's discovery
// emission (below) — one implementation so the two paths cannot diverge.
// Prefers `nested` when any `<specsDirName>/<dir>/spec.md` exists (checked
// first, so a mixed folder resolves toward nested per A3); else `flat` when
// any non-README `<specsDirName>/<name>.md` exists; else `nested` (the safe,
// indeterminate default — an empty/missing specs dir is not evidence of a
// flat layout).
export function detectLayout(absArtifactRoot, specsDirName = 'specs') {
  const specsDir = path.join(absArtifactRoot, specsDirName);
  let entries;
  try {
    entries = fs.readdirSync(specsDir, { withFileTypes: true });
  } catch {
    return 'nested';
  }
  const hasNested = entries.some(
    (e) => e.isDirectory() && fs.existsSync(path.join(specsDir, e.name, 'spec.md')),
  );
  if (hasNested) return 'nested';
  const hasFlat = entries.some(
    (e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md',
  );
  return hasFlat ? 'flat' : 'nested';
}

// Deterministic id dedup: on collision append the lowest free numeric suffix,
// keeping every id within the project-id pattern (safeProjectId already does).
function uniqueId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

// specLayout (008-02 AC2): attached only when the detected layout is `flat`
// — `nested` is the default, so a nested entry stays exactly the 007-03
// shape (byte-identical proposal, drop-in with no hand-editing needed).
function entriesFrom(root, pairs) {
  // pairs: [{ name, artifactRoot }] in the desired order.
  const used = new Set();
  return pairs.map(({ name, artifactRoot }) => {
    const entry = {
      id: uniqueId(safeProjectId(name), used),
      label: name,
      artifactRoot,
    };
    if (detectLayout(path.join(root, artifactRoot)) === 'flat') entry.specLayout = 'flat';
    return entry;
  });
}

// --- Declaration path (AC2): tracks/*/{specs,decisions}, ordered by repos.yaml ---

// Minimal, zero-dependency line scan (ADR-0001): collect `scope:` tokens in
// first-seen order. Handles scalar (`scope: rtb`) and inline-list
// (`scope: [rtb, offer-management]`) forms; strips quotes and trailing
// comments. Never a full YAML parse — only the scope tags we order tracks by.
function parseScopeTags(reposPath) {
  let raw;
  try {
    raw = fs.readFileSync(reposPath, 'utf8');
  } catch {
    return [];
  }
  const tags = [];
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*scope\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    let value = m[1];
    let tokens;
    if (value.startsWith('[')) {
      tokens = value.replace(/^\[|\].*$/g, '').split(',');
    } else {
      tokens = [value.replace(/#.*$/, '')];
    }
    for (const token of tokens) {
      const t = token.trim().replace(/^['"]|['"]$/g, '');
      if (t && !seen.has(t)) {
        seen.add(t);
        tags.push(t);
      }
    }
  }
  return tags;
}

function discoverDeclaration(root) {
  const tracksDir = path.join(root, 'tracks');
  if (!isDir(tracksDir)) return null;
  const trackDirs = readDirs(tracksDir).filter((name) => isArtifactRoot(path.join(tracksDir, name)));
  if (trackDirs.length === 0) return null;

  const sorted = [...trackDirs].sort();
  const reposPath = path.join(root, 'repos.yaml');
  const hasRepos = fs.existsSync(reposPath);
  const scopeTags = hasRepos ? parseScopeTags(reposPath) : [];

  // Scope-tag-named tracks come first in declared order; remaining tracks
  // follow in directory sort order.
  const ordered = [];
  const added = new Set();
  for (const tag of scopeTags) {
    if (sorted.includes(tag) && !added.has(tag)) {
      ordered.push(tag);
      added.add(tag);
    }
  }
  for (const name of sorted) {
    if (!added.has(name)) {
      ordered.push(name);
      added.add(name);
    }
  }

  const entries = entriesFrom(root, ordered.map((name) => ({ name, artifactRoot: `tracks/${name}` })));
  const note = hasRepos && scopeTags.length
    ? 'derived from repos.yaml scope tags'
    : 'derived from tracks/* layout';
  return { source: 'declaration', profile: { entries }, notes: [note] };
}

// --- Heuristic path (AC1): artifact roots nested under docs/ ---

// Collect qualifying artifact roots at/under docs (bounded depth; skips
// vendored dirs). docs itself is always descended into — even when it directly
// holds a specs/ or decisions/ subdir — so a real nested root is never masked
// by an incidental shallow one. Once a NESTED dir qualifies we stop descending
// into it (its own specs/ contain spec dirs, not further artifact roots).
function collectRoots(root) {
  const docsAbs = path.join(root, 'docs');
  if (!isDir(docsAbs)) return [];
  const roots = [];
  if (isArtifactRoot(docsAbs)) roots.push('docs');

  const walk = (relSegs) => {
    if (relSegs.length >= MAX_DEPTH) return;
    const absDir = path.join(root, ...relSegs);
    for (const name of readDirs(absDir)) {
      if (SKIP_DIRS.has(name)) continue;
      const childSegs = [...relSegs, name];
      const childAbs = path.join(root, ...childSegs);
      if (isArtifactRoot(childAbs)) {
        roots.push(childSegs.join('/'));
        // Do not descend into a qualifying nested root.
      } else {
        walk(childSegs);
      }
    }
  };
  walk(['docs']);
  return roots;
}

function discoverHeuristic(root) {
  let roots = collectRoots(root);
  if (roots.length === 0) return null;

  // Heuristic assumption (mystique "stray docs/specs" case): when a real
  // artifact root is nested strictly below docs, a bare docs/specs at the repo
  // root is incidental scaffolding, not a portfolio entry — drop the bare docs
  // root so the genuine nested artifacts drive the profile.
  const nested = roots.filter((r) => r !== 'docs');
  if (nested.length > 0) roots = nested;

  if (roots.length === 1) {
    // specLayout (008-02 AC2): attached only when detected `flat`, so a
    // nested single-entry proposal stays byte-identical to 007-03.
    const layout = detectLayout(path.join(root, roots[0])) === 'flat' ? { specLayout: 'flat' } : {};
    if (roots[0] === 'docs') {
      return { source: 'default', profile: { artifactRoot: 'docs', ...layout }, notes: ['flat docs/ layout'] };
    }
    return { source: 'heuristic', profile: { artifactRoot: roots[0], ...layout }, notes: [] };
  }

  const sorted = [...roots].sort();
  const entries = entriesFrom(root, sorted.map((r) => ({ name: r.split('/').pop(), artifactRoot: r })));
  return { source: 'heuristic', profile: { entries }, notes: [] };
}

// Precedence: declaration → heuristic → default → none.
export function discoverProfile(root) {
  const declaration = discoverDeclaration(root);
  if (declaration) return declaration;

  const heuristic = discoverHeuristic(root);
  if (heuristic) return heuristic;

  return { source: 'none', profile: null, notes: ['no jig artifacts detected'] };
}
