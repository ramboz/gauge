// Auto-installer for the SessionEnd capture hook (spec 014, slice 014-01,
// AC4/AC6). Merges a Gauge hook registration into `hooks.SessionEnd[].hooks[]`
// in a Claude Code settings.json, backing up the file first; idempotent
// (`npm run install-hook` twice never duplicates the entry); supports
// `--uninstall` to reverse it. The settings path is ALWAYS overridable
// (`--settings <path>` or `GAUGE_CLAUDE_SETTINGS`) so tests never touch the
// real `~/.claude/settings.json` — only the default falls back to it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installHook, uninstallHook, buildHookEntry, DEFAULT_HOOK_TIMEOUT_MS } from '../src/hook-install.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_SCRIPT = path.join(ROOT, 'scripts', 'session-stop-hook.mjs');
const START_HOOK_SCRIPT = path.join(ROOT, 'scripts', 'session-start-hook.mjs');
const usage = 'usage: node scripts/install-hook.mjs [--settings <path>] [--timeout <ms>] [--uninstall]';

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

function settingsPathFor(args) {
  if (args.settings) return path.resolve(String(args.settings));
  if (process.env.GAUGE_CLAUDE_SETTINGS) return path.resolve(process.env.GAUGE_CLAUDE_SETTINGS);
  return path.join(os.homedir(), '.claude', 'settings.json');
}

// Absent settings.json reads as an empty object (first-ever install, edge
// case in the slice); present-but-invalid-JSON throws — the caller must
// refuse and never silently overwrite it.
function readSettings(settingsPath) {
  let raw;
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { existed: false, raw: null, settings: {} };
    throw new Error(`cannot read ${settingsPath}: ${error.message}`);
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${settingsPath} is not valid JSON; refusing to overwrite it (${error.message})`);
  }
  return { existed: true, raw, settings };
}

function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temp, contents);
  fs.renameSync(temp, filePath);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const settingsPath = settingsPathFor(args);
  // Quote the script path so a home dir with a space (e.g. `/Users/My Name/…`)
  // does not break the shell-executed hook command (craft-review nit).
  const timeout = args.timeout ? Number(args.timeout) : DEFAULT_HOOK_TIMEOUT_MS;
  // The thin client registers TWO hooks (014-01 + 014-04): the SessionEnd
  // capture hook and the SessionStart active-session marker hook. Both are
  // merged/removed via the same event-generic pure core.
  const registrations = [
    { event: 'SessionEnd', entry: buildHookEntry(`node ${JSON.stringify(HOOK_SCRIPT)}`, timeout) },
    { event: 'SessionStart', entry: buildHookEntry(`node ${JSON.stringify(START_HOOK_SCRIPT)}`, timeout) },
  ];

  const { existed, raw, settings } = readSettings(settingsPath);

  if (args.uninstall && !existed) {
    console.log(`Gauge install-hook: ${settingsPath} does not exist; nothing to uninstall.`);
    return;
  }

  // AC4: back up the pristine file before any mutation — but never clobber an
  // existing backup, so the *pristine* pre-Gauge original survives a second
  // (idempotent) install rather than being overwritten with an already-modified
  // copy (compliance/craft/arch nit — keeps AC6 reversibility honest).
  const backupPath = `${settingsPath}.bak`;
  if (existed && !fs.existsSync(backupPath)) atomicWrite(backupPath, raw);

  let next = settings;
  for (const { event, entry } of registrations) {
    next = args.uninstall ? uninstallHook(next, entry, event) : installHook(next, entry, event);
  }
  atomicWrite(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Gauge ${args.uninstall ? 'uninstalled' : 'installed'} the SessionEnd + SessionStart hooks in ${settingsPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Gauge install-hook: ${error.message}\n${usage}`);
  process.exit(1);
}
