import {installationRoot} from '../wrapper/layout.mjs';
import {ensureCompanyBase} from '../backend/company-base.mjs';
await ensureCompanyBase(installationRoot);
console.log('Lokale Firmenbasis bereit. Vorhandene Inhalte bleiben erhalten.');
