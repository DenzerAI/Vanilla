import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Store } from '../backend/store.mjs';
import {
  ArtifactStore,
  detectTailscaleBaseUrl,
  formatResultWithArtifacts,
  tailscaleBaseUrlFromStatus,
} from '../backend/artifacts.mjs';

test('Tailscale status becomes a clickable artifact base URL', () => {
  const baseUrl = tailscaleBaseUrlFromStatus({
    Self: { DNSName: 'uwe.tailnet.ts.net.', TailscaleIPs: ['100.64.0.1'] },
  }, 8787, true);

  assert.equal(baseUrl, 'https://uwe.tailnet.ts.net');
});

test('Tailscale base URL is detected through the macOS app CLI', async () => {
  const called = [];
  const baseUrl = await detectTailscaleBaseUrl({
    env: {},
    port: 8787,
    execStatus: async (command, args) => {
      called.push(command);
      if (command !== '/Applications/Tailscale.app/Contents/MacOS/Tailscale') throw new Error('fehlt');
      if (args[0] === 'serve') return { stdout: JSON.stringify({ Web: {} }) };
      return { stdout: JSON.stringify({
        Self: { DNSName: 'uwe.tailnet.ts.net.', TailscaleIPs: ['100.64.0.1'] },
      }) };
    },
  });

  assert.equal(baseUrl, 'https://uwe.tailnet.ts.net');
  assert.ok(called.includes('/Applications/Tailscale.app/Contents/MacOS/Tailscale'));
});

test('Tailscale IP is used when Serve is unavailable', async () => {
  const baseUrl = await detectTailscaleBaseUrl({
    env: {},
    port: 8787,
    execStatus: async (_command, args) => ({
      stdout: args[0] === 'serve'
        ? '{}'
        : JSON.stringify({ Self: { DNSName: 'uwe.tailnet.ts.net.', TailscaleIPs: ['100.64.0.1'] } }),
    }),
  });

  assert.equal(baseUrl, 'http://100.64.0.1:8787');
});

test('base64 artifact is stored and returned as a Tailscale download link', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'order-artifacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifacts = new ArtifactStore(root, {
    baseUrl: 'http://uwe.tailnet.ts.net:8787',
  });
  await artifacts.init();

  const [artifact] = await artifacts.publish('run-123', [{
    filename: 'Angebot 7.pdf',
    mediaType: 'application/pdf',
    contentBase64: Buffer.from('PDF-Inhalt').toString('base64'),
  }]);

  assert.equal(artifact.filename, 'Angebot 7.pdf');
  assert.equal(artifact.url, 'http://uwe.tailnet.ts.net:8787/artifacts/run-123/Angebot%207.pdf');
  assert.equal(await readFile(artifact.path, 'utf8'), 'PDF-Inhalt');
});

test('result contains named Markdown links for every artifact', () => {
  const result = formatResultWithArtifacts('Fertig 👍', [{
    filename: 'Angebot.pdf',
    url: 'http://uwe.tailnet.ts.net:8787/artifacts/run/Angebot.pdf',
  }]);

  assert.equal(result, 'Fertig 👍\n\n**Download:** [Angebot.pdf](http://uwe.tailnet.ts.net:8787/artifacts/run/Angebot.pdf)');
});

test('artifact filenames cannot escape the download directory', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'order-artifacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifacts = new ArtifactStore(root, {
    baseUrl: 'http://uwe.tailnet.ts.net:8787',
  });
  await artifacts.init();

  await assert.rejects(
    artifacts.publish('run-123', [{
      filename: '../secret.pdf',
      contentBase64: Buffer.from('nope').toString('base64'),
    }]),
    /ungültig/i,
  );
});

test('completed orders retain published artifact metadata', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'order-artifacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  await store.init();
  await store.createOrder({ title: 'Dokument', instructions: 'PDF erstellen' });
  const { run } = await store.claimNext('codex');

  const finished = await store.finishRun(run.id, {
    result: 'Fertig',
    artifacts: [{
      filename: 'Angebot.pdf',
      mediaType: 'application/pdf',
      size: 12,
      url: 'http://uwe.tailnet.ts.net:8787/artifacts/run/Angebot.pdf',
    }],
  });

  assert.equal(finished.order.artifacts[0].filename, 'Angebot.pdf');
  assert.equal(finished.order.artifacts[0].url, 'http://uwe.tailnet.ts.net:8787/artifacts/run/Angebot.pdf');
});
