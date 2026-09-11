"""Tailnet setup. Only the exact app handler may be changed; never reset Serve."""
import json
import os
import re
import subprocess
import tempfile
import threading
from time import monotonic
from urllib.parse import urlsplit
from .files import atomic_write, read_json


class DeviceNetwork:
    def __init__(self, operations):
        self.o = operations
        self.db, self.config = operations.db, operations.config
        self.lock = threading.Lock()
        self.login = None
        self.login_output = None
        self.login_started = 0

    def run(self, *args):
        binary = self.o.tailscale_binary()
        if not binary:
            raise ValueError('Tailscale zuerst installieren und öffnen.')
        try:
            r = subprocess.run([binary, *args], env=self.o.tailscale_env(), capture_output=True, text=True, timeout=15)
        except (subprocess.TimeoutExpired, OSError):
            raise ValueError('Tailscale antwortet nicht. App öffnen und erneut prüfen.') from None
        if r.returncode:
            # CLI output may contain account information: only expose a validated provider approval URL.
            urls = re.findall(r'https://login\.tailscale\.com/[^\s<>"\x27]+', r.stdout + r.stderr)
            error = 'Tailscale konnte die Aktion nicht ausführen. Anmeldung und Freigabe im Tailscale-Konto prüfen.'
            if urls:
                error += ' ' + urls[0]
            raise ValueError(error)
        return r.stdout

    def inspect(self):
        try:
            state = json.loads(self.run('status', '--json'))
            rules = json.loads(self.run('serve', 'status', '--json'))
        except json.JSONDecodeError:
            raise ValueError('Tailscale liefert keinen lesbaren Status.') from None
        dns = state.get('Self', {}).get('DNSName', '').rstrip('.')
        if state.get('BackendState') != 'Running' or not re.fullmatch(r'[a-zA-Z0-9.-]+\.ts\.net', dns):
            raise ValueError('Tailscale öffnen und im gewünschten Netzwerk anmelden.')
        return dns, rules

    def login_state(self):
        if not self.login:
            return {}
        if monotonic() - self.login_started > 180 and self.login.poll() is None:
            self.login.terminate()
        self.login_output.seek(0)
        text = self.login_output.read(20000).decode(errors='replace')
        urls = re.findall(r'https://login\.tailscale\.com/[^\s<>"\x27]+', text)
        return {'loginPending': self.login.poll() is None, 'loginUrl': urls[-1] if urls else None}

    def status(self):
        result = {'installed': bool(self.o.tailscale_binary()), 'connected': False, 'serving': False, 'funnel': False, 'managed': os.getenv('VANILLA_MANAGED_HTTPS') == '1', 'loginRequired': self.config.login_required}
        result.update(self.login_state())
        if not result['installed']:
            return result
        if result['managed']:
            return {**result, **self.o.tailscale(True), 'canConfigure': False}
        try:
            dns, rules = self.inspect()
            result['connected'] = True
            desired = {'Handlers': {'/': {'Proxy': f'http://127.0.0.1:{self.config.port}'}}}
            owned = self.db.get('devices/network-v1')['value'] or {}
            result['ownsRule'] = False
            for port in dict.fromkeys([owned.get('port', self.config.port), self.config.port]):
                key = f'{dns}:{port}'
                if rules.get('Web', {}).get(key) == desired:
                    result.update(serving=True, funnel=bool(rules.get('AllowFunnel', {}).get(key)), url=f'https://{dns}' + (f':{port}' if port != 443 else ''), ownsRule=owned.get('key') == key)
                    break
            result['canConfigure'] = True
        except ValueError as e:
            result['error'] = str(e)
        return result

    def action(self, action, public_confirmed=False):
        with self.lock:
            if action == 'login':
                if os.getenv('VANILLA_MANAGED_HTTPS') == '1':
                    raise ValueError('Diese Installation wird zentral verwaltet. Anmeldung am Host vornehmen.')
                if self.status().get('connected'):
                    return self.status()
                if not self.login or self.login.poll() is not None:
                    if self.login_output:
                        self.login_output.close()
                    binary = self.o.tailscale_binary()
                    if not binary:
                        raise ValueError('Tailscale zuerst installieren und öffnen.')
                    self.login_output = tempfile.TemporaryFile()
                    self.login = subprocess.Popen([binary, 'login', '--timeout=3m'], stdout=self.login_output, stderr=subprocess.STDOUT, env=self.o.tailscale_env())
                    self.login_started = monotonic()
                return self.status()
            if action not in {'serve', 'funnel', 'stop'}:
                raise ValueError('Unbekannte Netzwerkaktion.')
            if os.getenv('VANILLA_MANAGED_HTTPS') == '1':
                raise ValueError('Diese HTTPS-Freigabe wird zentral am Host verwaltet.')
            if action == 'funnel' and (not public_confirmed or not self.config.login_required):
                raise ValueError('Öffentlicher Zugriff benötigt eine eingerichtete App-Anmeldung und deine ausdrückliche Bestätigung.')
            dns, before = self.inspect()
            owned = self.db.get('devices/network-v1')['value'] or {}
            port = owned.get('port') if action == 'stop' else (8443 if action == 'funnel' else self.config.port)
            if not port:
                raise ValueError('Keine von dieser Anwendung eingerichtete Freigabe vorhanden.')
            key = f'{dns}:{port}'
            target = f'http://127.0.0.1:{self.config.port}'
            expected = {'Handlers': {'/': {'Proxy': target}}}
            existing = before.get('Web', {}).get(key)
            if owned and owned.get('key') != key:
                raise ValueError('Zuerst die bisherige App-Freigabe beenden; dann die neue Freigabe einrichten.')
            if existing and (existing != expected or owned.get('key') != key):
                raise ValueError('Dieser HTTPS-Port wird bereits verwaltet. Bestehende Freigabe bleibt unverändert.')
            if before.get('TCP', {}).get(str(port)) and not existing:
                raise ValueError('Dieser Port gehört bereits einer anderen Freigabe.')
            public = bool(before.get('AllowFunnel', {}).get(key))
            if public and action == 'serve':
                raise ValueError('Zuerst den öffentlichen Zugriff beenden.')
            origin = f'https://{dns}' + (f':{port}' if port != 443 else '')
            if action != 'stop' and self.config.public_origin and self.config.public_origin != origin:
                raise ValueError('Die Anwendung hat bereits eine andere HTTPS-Adresse. Bestehende Adresse am Host abstimmen.')
            if action == 'stop':
                if owned.get('key') != key or existing != expected:
                    raise ValueError('Die gespeicherte Freigabe wurde außerhalb der App geändert.')
                self.run('funnel' if public else 'serve', f'--https={port}', 'off')
            else:
                self.run(action, f'--https={port}', '--bg', target)
            _, after = self.inspect()
            for section in set(before) | set(after):
                old, new = before.get(section, {}), after.get(section, {})
                if section in {'Web', 'TCP', 'AllowFunnel'}:
                    old = {k: v for k, v in old.items() if k not in {key, str(port)}}
                    new = {k: v for k, v in new.items() if k not in {key, str(port)}}
                if old != new:
                    raise ValueError('Eine andere Tailscale-Regel hat sich geändert. Am Host prüfen; keine automatische Rücksetzung.')
            if action == 'stop':
                if after.get('Web', {}).get(key) or after.get('AllowFunnel', {}).get(key):
                    raise ValueError('Beenden wurde nicht bestätigt. Tailscale-Status prüfen.')
                self.db.put('devices/network-v1', {})
                if self.config.public_origin == origin:
                    self.persist_origin('')
            else:
                if after.get('Web', {}).get(key) != expected or bool(after.get('AllowFunnel', {}).get(key)) != (action == 'funnel'):
                    raise ValueError('Freigabe wurde nicht bestätigt. Tailscale-Status prüfen.')
                self.db.put('devices/network-v1', {'schema': 1, 'key': key, 'port': port, 'public': action == 'funnel'})
                self.persist_origin(origin)
            self.o.network_cache = (0, {})
            return self.status()

    def persist_origin(self, origin):
        host = read_json(self.config.data / 'host.json', {})
        host['public_origin'] = origin
        atomic_write(self.config.data / 'host.json', json.dumps(host))
        self.config.public_origin = origin

    def close(self):
        if self.login and self.login.poll() is None:
            self.login.terminate()
            try:
                self.login.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.login.kill()
                self.login.wait(timeout=3)
        if self.login_output:
            self.login_output.close()
