import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from './config.mjs';
import { observeAll } from './observation.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolveConfigPath(ROOT, process.env.GAUGE_CONFIG);
process.stdout.write(`${JSON.stringify(observeAll(loadConfig(configPath)), null, 2)}\n`);
