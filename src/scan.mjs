// Deterministic scanner over configured jig project roots (spec 002).
// Read-only over other repos; the only writes anywhere are in this repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
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

export function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw);
  cfg.projects = (cfg.projects || []).map((p) => ({
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
    ...p,
    path: expandHome(p.path),
  }));
  return cfg;
}

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

function scanSpecs(root) {
  const specsDir = path.join(root, 'docs', 'specs');
  if (!isDir(specsDir)) return null;
  const specs = [];
  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(specsDir, entry.name);
    const raw = readIf(path.join(dir, 'spec.md'));
    if (raw === null) continue;
    const { data, body } = parseFrontmatter(raw);
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].replace(/^Spec\s+\d+\s*[:—-]\s*/i, '').trim()
      : entry.name;
    const slices = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^slice-.*\.md$/.test(f)) continue;
      const fm = parseFrontmatter(readIf(path.join(dir, f)) || '').data;
      slices.push({
        file: f,
        status: normStatus(fm.status),
        dependencies: Array.isArray(fm.dependencies) ? fm.dependencies : [],
        lastVerified: fm.last_verified || null,
      });
    }
    specs.push({ id: entry.name, title, status: normStatus(data.status), slices });
  }
  specs.sort((a, b) => a.id.localeCompare(b.id));
  return specs;
}

function scanBugs(root) {
  const dir = path.join(root, 'docs', 'bugs');
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

function gitInfo(root) {
  const run = (args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const commits = parseInt(run(['rev-list', '--count', 'HEAD']), 10);
    const lastCommit = run(['log', '-1', '--format=%cs']);
    const firstCommit = run(['log', '--reverse', '--format=%cs']).split('\n')[0];
    return { firstCommit, lastCommit, commits };
  } catch {
    return null;
  }
}

function scanWorkstreams(root, projectCfg) {
  const workstreams = [];
  const discovered = [];
  const pinned = new Set(projectCfg.pinnedWorkstreams);
  const hidden = new Set(projectCfg.hiddenWorkstreams);
  const docsDir = path.join(root, 'docs');

  const releasesDir = path.join(docsDir, 'releases');
  if (isDir(releasesDir)) {
    for (const f of fs.readdirSync(releasesDir).sort()) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
      const rel = path.join('docs', 'releases', f);
      if (hidden.has(rel)) continue;
      const rb = parseRunbook(readIf(path.join(releasesDir, f)) || '');
      workstreams.push({ kind: 'release', path: rel, ...rb });
    }
  }

  for (const rel of projectCfg.pinnedWorkstreams) {
    // Release plans render unconditionally above — a pin there would duplicate the row.
    if (rel.startsWith(path.join('docs', 'releases') + path.sep)) continue;
    const abs = path.join(root, rel);
    const raw = readIf(abs);
    if (raw === null) continue; // missing pin → the worktree scan may explain why
    workstreams.push({ kind: 'runbook', path: rel, ...parseRunbook(raw) });
  }

  if (isDir(docsDir)) {
    for (const rel of walkMd(docsDir, root)) {
      if (rel.startsWith(path.join('docs', 'specs') + path.sep)) continue;
      if (rel.startsWith(path.join('docs', 'releases') + path.sep)) continue;
      // Bugs have their own counter; their DoD checklists are not workstreams.
      if (rel.startsWith(path.join('docs', 'bugs') + path.sep)) continue;
      // Scaffold boilerplate, identical in every jig project — pin explicitly if wanted.
      if (rel === path.join('docs', 'adoption-readiness.md')) continue;
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

function scanWorktreeOnlyDocs(root) {
  const wtRoot = path.join(root, '.claude', 'worktrees');
  if (!isDir(wtRoot)) return [];
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
      if (!fs.existsSync(path.join(root, rel))) {
        out.push({ worktree: wt.name, path: rel });
        if (out.length >= WORKTREE_DOC_CAP) return out;
      }
    }
  }
  return out;
}

function scanCompass(root) {
  const raw = readIf(path.join(root, 'docs', 'status', 'compass-history.jsonl'));
  if (raw === null) return { latest: null, malformed: 0, count: 0 };
  return parseCompassHistory(raw);
}

export function scanProject(projectCfg) {
  const root = projectCfg.path;
  const name = projectCfg.label || path.basename(root);
  if (!isDir(root)) {
    return { name, path: root, error: 'path does not exist' };
  }
  const specs = scanSpecs(root);
  const jigManaged = specs !== null;
  const result = {
    name,
    path: root,
    jigManaged,
    git: gitInfo(root),
  };
  if (!jigManaged) return result;

  const allSlices = specs.flatMap((s) => s.slices);
  result.specs = specs;
  result.progress = progressOf(specs);
  result.sliceProgress = allSlices.length ? progressOf(allSlices) : null;
  result.counts = {
    bugs: scanBugs(root),
    refinement: countRefinement(readIf(path.join(root, 'docs', 'refinement-todo.md')) || ''),
    inbox: countInboxItems(readIf(path.join(root, 'docs', 'inbox.md')) || ''),
    adrs: isDir(path.join(root, 'docs', 'decisions'))
      ? fs.readdirSync(path.join(root, 'docs', 'decisions')).filter((f) => /^adr-\d+.*\.md$/.test(f)).length
      : 0,
  };
  Object.assign(result, scanWorkstreams(root, projectCfg));
  result.worktreeOnlyDocs = scanWorktreeOnlyDocs(root);
  const compass = scanCompass(root);
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

const DEFAULT_CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard.config.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig(process.env.DASHBOARD_CONFIG || DEFAULT_CONFIG);
  process.stdout.write(JSON.stringify(scanAll(cfg), null, 2) + '\n');
}
