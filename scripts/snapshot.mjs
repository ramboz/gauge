// Compatibility-named Gauge collector. Unlike the retired Compass snapshot
// command, this writes validated observations only beneath the instance stateDir.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from '../src/config.mjs';
import { observeProject } from '../src/observation.mjs';
import { collectObservation } from '../src/state.mjs';

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

const args = parseArgs(process.argv.slice(2));
const usage = 'usage: node scripts/snapshot.mjs [--config <gauge.config.json>] [--project-id <id>]';
const retired = ['project', 'headline', 'next', 'blockers', 'ts', 'auto', 'all'].find((name) => args[name] !== undefined);
if (retired) {
  console.error(`--${retired} belonged to the retired source-writing Compass command.\n${usage}`);
  process.exit(1);
}

const configPath = resolveConfigPath(ROOT, args.config || process.env.GAUGE_CONFIG);
let failed = 0;
try {
  const config = loadConfig(configPath);
  for (const warning of config.warnings) console.error(`warning: ${warning}`);
  const projects = args['project-id']
    ? config.projects.filter((project) => project.id === args['project-id'])
    : config.projects;
  if (args['project-id'] && projects.length === 0) throw new Error(`unknown project id: ${args['project-id']}`);
  for (const project of projects) {
    try {
      const observation = observeProject(project);
      const recordPath = collectObservation(config, observation);
      console.log(`Gauge collected ${project.label} → ${recordPath}`);
    } catch (error) {
      failed++;
      console.error(`Gauge failed ${project.label}: ${error.message}`);
    }
  }
} catch (error) {
  failed++;
  console.error(`Gauge collector: ${error.message}\n${usage}`);
}
process.exit(failed ? 1 : 0);
