// Compass-snapshot writer (ADR-0002, slice 002-03 AC4).
//
// Manual (narrative supplied by you or by compass):
//   node scripts/snapshot.mjs --project <path> --headline "..." \
//     [--next "..."] [--blockers "a;b"] [--ts <iso>]
//
// Auto (deterministic headline from scan data; for scheduled routines):
//   node scripts/snapshot.mjs --project <path> --auto
//   node scripts/snapshot.mjs --all --auto     # every jig project in dashboard.config.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSnapshot } from '../src/lib.mjs';
import { expandHome, loadConfig, scanProject } from '../src/scan.mjs';

const DEFAULT_CONFIG = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard.config.json'
);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function autoFields(scanned) {
  const p = scanned.progress;
  const parts = [`${p.done}/${p.denom} specs done`];
  if (p.by.IN_PROGRESS) parts.push(`${p.by.IN_PROGRESS} in progress`);
  if (scanned.counts.bugs.open) parts.push(`${scanned.counts.bugs.open} open bug(s)`);
  const inProgress = scanned.specs.find((s) => s.status === 'IN_PROGRESS');
  return {
    headline: `auto: ${parts.join(' · ')}`,
    ...(inProgress ? { next: `in progress: ${inProgress.id}` } : {}),
  };
}

function writeSnapshot(root, args) {
  const scanned = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  if (scanned.error) return { root, error: scanned.error };
  if (!scanned.jigManaged) return { root, skipped: 'not jig-managed' };

  const snapshot = { v: 1, ts: args.ts || new Date().toISOString() };
  if (args.auto) {
    Object.assign(snapshot, autoFields(scanned), { source: 'auto' });
  } else {
    snapshot.headline = args.headline;
    if (args.next) snapshot.next = args.next;
    if (args.blockers) {
      snapshot.blockers = args.blockers.split(';').map((s) => s.trim()).filter(Boolean);
    }
    snapshot.source = 'manual';
  }
  snapshot.specs = { done: scanned.progress.done, total: scanned.progress.denom };

  const errors = validateSnapshot(snapshot);
  if (errors.length) return { root, error: 'invalid snapshot: ' + errors.join('; ') };

  const dir = path.join(root, 'docs', 'status');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'compass-history.jsonl'), JSON.stringify(snapshot) + '\n');
  return { root, snapshot };
}

const args = parseArgs(process.argv.slice(2));
const usage =
  'usage: node scripts/snapshot.mjs --project <path> --headline "..." [--next "..."] [--blockers "a;b"] [--ts <iso>]\n' +
  '       node scripts/snapshot.mjs --project <path> --auto\n' +
  '       node scripts/snapshot.mjs --all --auto [--config <path>]';

let targets;
if (args.all) {
  if (!args.auto) {
    console.error('--all requires --auto (a shared manual headline would be wrong per project)\n' + usage);
    process.exit(1);
  }
  const cfg = loadConfig(args.config ? expandHome(args.config) : process.env.DASHBOARD_CONFIG || DEFAULT_CONFIG);
  targets = cfg.projects.map((p) => p.path);
} else if (args.project && (args.auto || args.headline)) {
  targets = [expandHome(args.project)];
} else {
  console.error(usage);
  process.exit(1);
}

let failed = 0;
for (const root of targets) {
  const res = writeSnapshot(root, args);
  if (res.error) {
    failed++;
    console.error(`✗ ${root}: ${res.error}`);
  } else if (res.skipped) {
    console.log(`- ${root}: skipped (${res.skipped})`);
  } else {
    console.log(`✓ ${root}: ${res.snapshot.headline}`);
  }
}
process.exit(failed ? 1 : 0);
