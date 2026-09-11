"""Bounded, read-only frontend checks on the existing local server, without an LLM."""
import json
import os
import shutil
import statistics
import subprocess
from time import monotonic

import httpx


class FrontendCheckError(ValueError):
    def __init__(self, details):
        self.details = details
        super().__init__('Ladeleistung prüfen: ' + '; '.join(details['issues'])[:400])


def check_frontend(config, *, client=None, runner=subprocess.run):
    issues, metrics = [], {}
    result = {'version': 1, 'scope': 'Lokale Auslieferung; keine Messung auf dem Endgerät',
              'issues': issues, 'metrics': metrics}
    dist = config.root / 'wrapper/dist'
    try:
        manifest = json.loads((dist / '.vite/manifest.json').read_text())
        entry = manifest['index.html']
        assets = set()

        def visit(chunk):
            if chunk['file'] in assets:
                return
            assets.add(chunk['file'])
            assets.update(chunk.get('css', []))
            for key in chunk.get('imports', []):
                visit(manifest[key])

        visit(entry)
        if len(assets) > 20 or any(not name.startswith('assets/') or not (dist/name).resolve().is_relative_to(dist.resolve()) for name in assets):
            raise ValueError('Invalid initial assets')
        metrics['initialBrotliBytes'] = sum((dist/(name+'.br')).stat().st_size for name in assets)
        if metrics['initialBrotliBytes'] > 320*1024:
            issues.append('Startpaket überschreitet 320 KiB')
        result['uiVersion'] = json.loads((dist/'version.json').read_text())['uiVersion']
    except (OSError, ValueError, KeyError, StopIteration, TypeError):
        assets = set()
        issues.append('Build oder komprimierte Startdateien fehlen')

    node = shutil.which('node')
    if node:
        try:
            env = {key:value for key,value in os.environ.items() if not key.startswith(('AGENT_', 'UWE_')) and key not in ('COMPANY_BASE','SYSTEM_BASE')}
            checked = runner([node, '--test', 'wrapper/test/build-efficiency.test.mjs', 'wrapper/test/thread-view.test.mjs'],
                             cwd=config.root, env=env, capture_output=True, text=True, timeout=15)
            metrics['regressionTestsPassed'] = checked.returncode == 0
            if checked.returncode:
                issues.append('Prüfung für Nachladen, Datenmengen oder Komprimierung fehlgeschlagen')
        except (OSError, subprocess.TimeoutExpired):
            issues.append('Ladeprüfungen konnten nicht abgeschlossen werden')
    else:
        issues.append('Node für die Ladeprüfungen fehlt')

    headers = {'Accept-Encoding': 'identity'}
    if config.login_required:
        headers['Authorization'] = 'Bearer ' + config.access_token
    owned = client is None
    client = client or httpx.Client(base_url=f'http://127.0.0.1:{config.port}', headers=headers,
                                    trust_env=False, timeout=4, follow_redirects=False)

    def probe(path, *, compressed=False):
        start = monotonic()
        with client.stream('GET', path, headers={'Accept-Encoding':'gzip' if compressed else 'identity'}) as response:
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_raw():
                size += len(chunk)
                if size > 1024*1024:
                    raise ValueError('Response too large')
                chunks.append(chunk)
            return {'milliseconds': round((monotonic()-start)*1000), 'bytes':size}, response.headers, b''.join(chunks)

    try:
        for name in sorted(assets):
            try:
                measured, response_headers, _ = probe('/'+name, compressed=True)
                if response_headers.get('content-encoding') != 'gzip' or 'immutable' not in response_headers.get('cache-control',''):
                    issues.append('Startdateien werden nicht komprimiert und dauerhaft zwischengespeichert')
                    break
            except (httpx.HTTPError, ValueError):
                issues.append('Eine Startdatei ist nicht zuverlässig erreichbar')
                break

        endpoints = [('bootstrap','/api/bootstrap?view=sidebar',256*1024),
                     ('chats','/api/chats?view=sidebar',256*1024),
                     ('connections','/api/integrations?view=settings',128*1024)]
        for label, path, budget in endpoints:
            samples, failed = [], 0
            for _ in range(3):
                try:
                    measured, response_headers, _ = probe(path)
                    samples.append(measured)
                    if response_headers.get('cache-control') != 'no-store':
                        issues.append(label+': private Daten dürfen nicht zwischengespeichert werden')
                except (httpx.HTTPError, ValueError):
                    failed += 1
            metrics[label] = {'samples':len(samples),'failed':failed}
            if failed >= 2:
                issues.append(label+': wiederholt nicht erreichbar oder Antwort über 1 MiB')
            if samples:
                median = statistics.median(sample['milliseconds'] for sample in samples)
                size = max(sample['bytes'] for sample in samples)
                metrics[label].update(medianMs=median, bytes=size)
                if len(samples) >= 2 and median > 2000:
                    issues.append(label+': mittlere lokale Antwortzeit über 2 Sekunden')
                if size > budget:
                    issues.append(label+': unnötig große Datenantwort')
        try:
            _, response_headers, _ = probe('/')
            if response_headers.get('cache-control') != 'no-store':
                issues.append('Startseite kann einen veralteten Stand behalten')
            _, _, payload = probe('/api/updates')
            updates = json.loads(payload)
            if updates.get('restartRequired') or updates.get('uiVersion') != result.get('uiVersion'):
                issues.append('Quellstand, Oberfläche und laufender Server sind nicht vollständig aktiviert')
        except (httpx.HTTPError, ValueError):
            issues.append('Aktiver Versionsstand konnte nicht geprüft werden')
    finally:
        if owned:
            client.close()
    result['issues'] = list(dict.fromkeys(issues))
    result['ok'] = not result['issues']
    result['text'] = 'Ladeprüfung ohne Auffälligkeiten.' if result['ok'] else 'Ladeleistung prüfen: ' + '; '.join(result['issues'])
    return result
