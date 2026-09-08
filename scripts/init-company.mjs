import {fileURLToPath} from 'node:url';
import {ensureCompanyBase} from '../backend/company-base.mjs';
await ensureCompanyBase(fileURLToPath(new URL('../', import.meta.url)));
console.log('Lokale Firmenbasis bereit. Vorhandene Inhalte bleiben erhalten.');
