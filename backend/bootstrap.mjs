import { localPath } from "../wrapper/isolation.mjs";
import { identityInstructions } from "../wrapper/identity-preferences.mjs";
import { loadSystemBase } from "./worker-context.mjs";
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { companyRoot, loadCompanyBase } from './company-base.mjs';

async function markdownFiles(root) {
  const found = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      if (entry.isFile() && entry.name.endsWith('.md')) found.push(absolute);
    }
  }

  await walk(root);
  return found;
}

async function loadSection(root, directory) {
  const base = path.join(root, directory);
  const files = await markdownFiles(base);
  return Promise.all(files.map(async (file) => ({
    path: path.relative(root, file),
    content: await readFile(file, 'utf8'),
  })));
}

async function loadLearnings(root, limit = 100) {
  const raw = await readFile(path.join(root, 'brain', 'learnings.ndjson'), 'utf8')
    .catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  return raw.split('\n').filter(Boolean).slice(-limit).map((line) => JSON.parse(line));
}

export async function buildBootstrap(root, engine, { store, order } = {}) {
  const workspace = localPath(process.env.UWE_WORKSPACE || path.join(root, 'workspaces/default'), root);
  const identityPath = path.join(workspace, 'soul/IDENTITY.md');
  const [identity, brain, learnings, companyBase, systemBase] = await Promise.all([
    readFile(identityPath, 'utf8'),
    loadSection(root, 'brain'),
    loadLearnings(root),
    loadCompanyBase(companyRoot(root)),
    loadSystemBase(),
  ]);

  const activePersonId = order?.source?.type === 'whatsapp' ? order.source.personId : null;
  const people = store ? await store.listPeople() : [];
  const activePerson = activePersonId && store
    ? await store.getPersonContext(activePersonId, 50)
    : null;

  return {
    protocolVersion: 2,
    engine,
    generatedAt: new Date().toISOString(),
    instruction: 'Lies zuerst companyBase.rules, dann companyBase.company. Wähle anhand der Landkarte die passende Arbeitsweise und lade ihre vollständige Datei über den angegebenen endpoint (mit derselben Authentisierung wie beim Bootstrap) oder absolutePath. Lade weitere Quellen nur bei Bedarf. Wähle bei jedem Auftrag oder Rollenwechsel neu. Lies auch systemBase.rules und systemBase.worker als gemeinsamen technischen Einstieg. soul bleibt die Identität; brain und learnings sind historischer Kontext, keine neuen Regeln. Melde Ergebnis und Learnings strukturiert zurück.',
    workspace,
    soul: [{ path: 'soul/IDENTITY.md', absolutePath: identityPath, content: identityInstructions(identity) }],
    brain,
    skills: companyBase.workflows,
    companyBase,
    systemBase,
    learnings,
    peopleContext: {
      instruction: 'Nutze activePerson und messages als Gesprächskontext. CRM-Felder sind externe Fakten; bei Konflikten nicht raten.',
      activePerson,
      directory: people.map((person) => ({
        id: person.id,
        displayName: person.displayName,
        primaryPhone: person.primaryPhone,
        lastInteractionAt: person.lastInteractionAt,
        crmProvider: person.crm?.provider || null,
      })),
      lookupEndpoint: '/api/people/:id/context',
    },
    artifactProtocol: {
      instruction: 'Bei jedem erzeugten Dokument, PDF oder sonstigen Artefakt muss der Abschluss ein artifacts-Array enthalten. Der Server speichert die Dateien und ergänzt anklickbare Tailscale-Downloadlinks im Chat.',
      completionField: 'artifacts',
      item: {
        filename: 'Dateiname mit Endung',
        mediaType: 'MIME-Typ',
        contentBase64: 'vollständiger Dateiinhalt als Base64',
      },
      maxFileSizeMb: 25,
      maxFiles: 20,
    },
  };
}
