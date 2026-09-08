import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { diagnoseHeroKeys, heroKeyCandidates } from '../backend/hero-key-diagnostics.mjs';

import { localPath, projectRoot } from '../wrapper/isolation.mjs';
const envFile = localPath(process.argv[2] || 'data/hero.env', projectRoot);
let raw;
try {
  raw = await readFile(envFile, 'utf8');
} catch (error) {
  console.error(`HERO-Konfiguration nicht lesbar: ${error.message}`);
  process.exitCode = 2;
}

if (raw !== undefined) {
  const candidates = heroKeyCandidates(raw);
  if (!candidates.length) {
    console.error('Keine HERO-Key-Kandidaten gefunden.');
    process.exitCode = 2;
  } else {
    const results = await diagnoseHeroKeys(candidates);
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
    if (!results.some((item) => item.graphql.authenticated || item.lead.authenticated)) {
      process.exitCode = 1;
    }
  }
}
