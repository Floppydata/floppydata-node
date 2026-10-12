// Download the production v2 OpenAPI spec into openapi/v2.json.
//
//   node scripts/sync-spec.mjs [expected-sha256]
//
// With an expected hash (sent by the client-api production deploy), wait until
// production serves exactly that spec: the dispatch can arrive before every
// Cloudflare location runs the new version. The hash is over the compact JSON
// (JSON.stringify of the parsed spec), so formatting does not matter.
//
// Writes the spec formatted like the monorepo's committed copy and, on GitHub
// Actions, `changed=true|false` to $GITHUB_OUTPUT.

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const SPEC_URL = 'https://api.floppydata.net/v2/openapi.json';
const SPEC_PATH = 'openapi/v2.json';
const WAIT_MS = 15 * 60 * 1000;
const POLL_MS = 20 * 1000;

const expected = process.argv[2] || undefined;
const hash = (spec) => createHash('sha256').update(JSON.stringify(spec)).digest('hex');

async function download() {
  const response = await fetch(SPEC_URL, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`GET ${SPEC_URL} returned HTTP ${response.status}`);
  return response.json();
}

let spec = await download();
const deadline = Date.now() + WAIT_MS;
while (expected && hash(spec) !== expected) {
  if (Date.now() > deadline) {
    throw new Error(`Production still serves spec ${hash(spec)}, not ${expected}, after ${WAIT_MS / 60000} min`);
  }
  console.log(`Production serves ${hash(spec).slice(0, 12)}, waiting for ${expected.slice(0, 12)}...`);
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  spec = await download();
}

let current;
try {
  current = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
} catch {
  current = undefined;
}
const changed = !current || hash(current) !== hash(spec);

if (changed) writeFileSync(SPEC_PATH, `${JSON.stringify(spec, null, 2)}\n`);
console.log(changed ? `Spec updated (${hash(spec).slice(0, 12)})` : 'Spec unchanged');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
