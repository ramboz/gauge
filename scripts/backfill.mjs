// Git-backfill seed entry point (spec 013-01, ADR-0018): reconstructs each
// configured jig project's spec-level progress(t) from its own git history
// and writes it into the Gauge state dir as honestly-marked, reconstructed-
// from-git observation snapshots — read-only against every source repo,
// exactly like scripts/snapshot.mjs is read-only against the live tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from '../src/config.mjs';
import { gitBackfillSeries, buildBackfillObservation, recordBackfillObservation } from '../src/backfill.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

// The specs pathspec (git-relative to the project root) that gitBackfillSeries
// walks: the resolved profile's artifactRoot/specsDir, expressed relative to
// the project path and normalized to forward slashes for a git pathspec —
// mirrors the git-relative label computation src/scan.mjs already does for
// worktree hygiene (artifactRootRel).
function specsDirRelOf(project) {
  const profile = project.profile || {};
  const artifactRoot = profile.artifactRoot || path.join(project.path, 'docs');
  const specsDir = profile.specsDir || 'specs';
  return path.join(path.relative(project.path, artifactRoot), specsDir).split(path.sep).join('/');
}

const args = parseArgs(process.argv.slice(2));
const usage = 'usage: node scripts/backfill.mjs [--config <gauge.config.json>] [--project-id <id>]';
const configPath = resolveConfigPath(ROOT, args.config || process.env.GAUGE_CONFIG);
let failed = 0;
try {
  const config = loadConfig(configPath);
  for (const warning of config.warnings) console.error(`warning: ${warning}`);
  const projects = args['project-id']
    ? config.projects.filter((project) => project.id === args['project-id'])
    : config.projects;
  if (args['project-id'] && projects.length === 0) throw new Error(`unknown project id: ${args['project-id']}`);
  const nowMs = Date.now();
  for (const project of projects) {
    try {
      const series = gitBackfillSeries(project.path, { specsDirRel: specsDirRelOf(project) });
      let written = 0;
      let already = 0;
      for (const point of series) {
        const observation = buildBackfillObservation(project, point, nowMs);
        const result = recordBackfillObservation(config, observation);
        if (result.created) written++;
        else already++;
      }
      console.log(`Gauge backfilled ${project.label}: ${written} written, ${already} already present (${series.length} reconstructed point(s))`);
    } catch (error) {
      failed++;
      console.error(`Gauge backfill failed ${project.label}: ${error.message}`);
    }
  }
} catch (error) {
  failed++;
  console.error(`Gauge backfill: ${error.message}\n${usage}`);
}
process.exit(failed ? 1 : 0);
