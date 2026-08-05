// Profile onboarding CLI (spec 007-03, AC1/AC3): introspects a source
// read-only and prints a proposed project-profile-v1 document (drop-in for a
// gauge.config.json project's `profile` field) to stdout, with the detection
// source and notes on stderr. Strictly read-only — it emits a profile, never
// writes to the source and never collects observations (AC4).
import fs from 'node:fs';
import path from 'node:path';
import { discoverProfile, surfaceCandidateArtifacts } from '../src/discover.mjs';
import { validateProfile } from '../src/profile.mjs';

// Candidate-artifact pointer note (spec 009-01, ADR-0011): informational
// only — the path to draw a goal/deadline value from, never the value
// itself. Printed regardless of whether shape discovery below succeeds, so
// even a plain (non-jig) source still gets a useful onboarding pointer.
function candidateNote(field, candidate) {
  return candidate
    ? `  ${field} candidate: ${candidate.path} (${candidate.provenance})`
    : `  ${field} candidate: none`;
}

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

// Goal/deadline candidate surfacing (spec 009-01, ADR-0011) is independent of
// jig-shape discovery above: a plain README-only source still gets a useful
// onboarding pointer even when it has no jig artifacts to propose a shape
// profile from.
const candidates = surfaceCandidateArtifacts(root);

if (result.profile === null) {
  console.error(`onboard: no jig artifacts detected under ${root}; nothing to propose.`);
  for (const note of result.notes) console.error(`  note: ${note}`);
  console.error(candidateNote('goal', candidates.goal));
  console.error(candidateNote('deadline', candidates.deadline));
  process.exit(1);
}

// Defensive: a proposed profile that fails validation is a discovery bug, not
// a drop-in profile — refuse to emit it (AC3).
const errors = validateProfile(result.profile);
if (errors.length) fail(`onboard: proposed profile is invalid: ${errors.join('; ')}`);

console.error(`onboard: source=${result.source}`);
for (const note of result.notes) console.error(`  note: ${note}`);
console.error(candidateNote('goal', candidates.goal));
console.error(candidateNote('deadline', candidates.deadline));
console.log(JSON.stringify(result.profile, null, 2));
process.exit(0);
