// Profile onboarding CLI (spec 007-03, AC1/AC3): introspects a source
// read-only and prints a proposed project-profile-v1 document (drop-in for a
// gauge.config.json project's `profile` field) to stdout, with the detection
// source and notes on stderr. Strictly read-only — it emits a profile, never
// writes to the source and never collects observations (AC4).
import fs from 'node:fs';
import path from 'node:path';
import { discoverProfile } from '../src/discover.mjs';
import { validateProfile } from '../src/profile.mjs';

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

const usage = 'usage: node scripts/onboard.mjs --path <repo>';
const args = parseArgs(process.argv.slice(2));

function fail(message) {
  console.error(`${message}\n${usage}`);
  process.exit(1);
}

if (!args.path || args.path === true) fail('onboard: --path <repo> is required');
const root = path.resolve(args.path);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  fail(`onboard: path does not exist or is not a directory: ${args.path}`);
}

// A pathological directory name can make id derivation throw (safeProjectId);
// surface it as a graceful CLI error, never a raw stack trace.
let result;
try {
  result = discoverProfile(root);
} catch (error) {
  fail(`onboard: discovery failed: ${error.message}`);
}

if (result.profile === null) {
  console.error(`onboard: no jig artifacts detected under ${root}; nothing to propose.`);
  for (const note of result.notes) console.error(`  note: ${note}`);
  process.exit(1);
}

// Defensive: a proposed profile that fails validation is a discovery bug, not
// a drop-in profile — refuse to emit it (AC3).
const errors = validateProfile(result.profile);
if (errors.length) fail(`onboard: proposed profile is invalid: ${errors.join('; ')}`);

console.error(`onboard: source=${result.source}`);
for (const note of result.notes) console.error(`  note: ${note}`);
console.log(JSON.stringify(result.profile, null, 2));
process.exit(0);
