"""Registered devices only. Owner setup and agent actions have separate entry points."""
import base64
import hashlib
import ipaddress
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import tempfile
import threading
from time import time, monotonic
from uuid import uuid4
from urllib.parse import urlsplit, urlencode

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ANDROID_KEYS = {'home': '3', 'back': '4', 'up': '19', 'down': '20', 'left': '21', 'right': '22', 'ok': '23', 'volume-up': '24', 'volume-down': '25', 'power': '26', 'mute': '164', 'play-pause': '85'}
TV_KEYS = {'home': 'KEY_HOME', 'back': 'KEY_RETURN', 'up': 'KEY_UP', 'down': 'KEY_DOWN', 'left': 'KEY_LEFT', 'right': 'KEY_RIGHT', 'ok': 'KEY_ENTER', 'volume-up': 'KEY_VOLUP', 'volume-down': 'KEY_VOLDOWN', 'power': 'KEY_POWER', 'mute': 'KEY_MUTE', 'play-pause': 'KEY_PLAY', 'source': 'KEY_SOURCE', 'channel-up': 'KEY_CHUP', 'channel-down': 'KEY_CHDOWN'}
class DeviceIdentityError(ValueError):
    pass


PERMISSIONS = {'status': 'read', 'screenshot': 'read', 'key': 'control', 'tap': 'control', 'swipe': 'control', 'text': 'control', 'launch': 'apps', 'shell': 'shell'}


def host_value(value):
    value = value.strip().strip('[]')
    try:
        ipaddress.ip_address(value)
    except ValueError:
        if not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?', value):
            raise ValueError('Bitte eine IP-Adresse oder einen Gerätenamen ohne Port eingeben.')
    return value


def private_address(host):
    try:
        addresses = {ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)}
    except OSError:
        raise ValueError('Geräteadresse ist nicht erreichbar. Netzwerk oder Tailscale prüfen.') from None
    nets = [ipaddress.ip_network(s) for s in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', 'fc00::/7')]
    if not addresses or any(not any(ip in net for net in nets) for ip in addresses):
        raise ValueError('Diese Verbindung benötigt eine private LAN- oder Tailscale-Adresse.')
    return str(sorted(addresses, key=str)[0])


class DeviceInput(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    id: str = Field(default='', max_length=64, pattern=r'^[a-zA-Z0-9-]*$')
    revision: int = Field(default=0, ge=0)
    name: str = Field(min_length=1, max_length=100)
    provider: str = Field(pattern=r'^(android-adb|samsung-tv)$')
    transport: str = Field(default='network', pattern=r'^(network|usb)$')
    host: str = Field(default='', max_length=253)
    port: int = Field(default=5555, ge=1, le=65535)
    serial: str = Field(default='', max_length=120, pattern=r'^[a-zA-Z0-9._-]*$')
    url: str = Field(default='', max_length=1000)
    allowPublic: bool = False
    enabled: bool = False
    projectId: str = Field(default='default', min_length=1, max_length=100)
    workers: list[str] = Field(default_factory=lambda: ['codex'], max_length=30)
    permissions: list[str] = Field(default_factory=lambda: ['read', 'control'], max_length=4)

    @field_validator('name')
    @classmethod
    def name_valid(cls, v):
        if not v.strip():
            raise ValueError('Gerätename fehlt.')
        return v.strip()

    @model_validator(mode='after')
    def validate_device(self):
        if not self.workers or any(not re.fullmatch(r'[a-zA-Z0-9_-]{1,60}', w) for w in self.workers):
            raise ValueError('Mindestens einen konkreten Agenten auswählen.')
        if not set(self.permissions) <= {'read', 'control', 'apps', 'shell'}:
            raise ValueError('Unbekannte Geräteberechtigung.')
        if self.provider == 'android-adb':
            if self.transport == 'usb':
                if not self.serial or self.serial.startswith('-'):
                    raise ValueError('USB-Gerät auswählen.')
            else:
                self.host = host_value(self.host)
            if self.allowPublic or self.url:
                raise ValueError('ADB bleibt im privaten Netz; keine öffentliche Freigabe.')
        else:
            if self.transport != 'network' or set(self.permissions) - {'read', 'control'}:
                raise ValueError('Fernseher unterstützen Lesen und Fernbedienung über das Netzwerk.')
            u = urlsplit(self.url)
            try:
                _ = u.port
            except ValueError:
                raise ValueError('Ungültiger Fernseher-Port.') from None
            if u.scheme not in {'ws', 'wss'} or not u.hostname or u.username or u.password or u.query or u.fragment or u.path not in {'', '/', '/api/v2/channels/samsung.remote.control'}:
                raise ValueError('Fernseher-Adresse als ws://Adresse:8001 oder wss://Adresse ohne Zugangsdaten eingeben.')
            host_value(u.hostname)
            if self.allowPublic and u.scheme != 'wss':
                raise ValueError('Öffentliche Fernseher-Verbindungen benötigen WSS mit gültigem Zertifikat.')
        return self


class DeviceAction(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    action: str = Field(pattern=r'^(connect|pair|disconnect|status|screenshot|key|tap|swipe|text|launch|shell)$')
    pairingPort: int | None = Field(default=None, ge=1, le=65535)
    code: str = Field(default='', max_length=6, repr=False)
    key: str = Field(default='', max_length=30)
    x: int = Field(default=0, ge=0, le=20000)
    y: int = Field(default=0, ge=0, le=20000)
    x2: int = Field(default=0, ge=0, le=20000)
    y2: int = Field(default=0, ge=0, le=20000)
    duration: int = Field(default=300, ge=50, le=5000)
    text: str = Field(default='', max_length=2000, repr=False)
    component: str = Field(default='', max_length=250)
    command: str = Field(default='', max_length=4000, repr=False)


class Devices:
    key = 'devices/registry-v1'

    def __init__(self, db, config):
        self.db, self.config = db, config
        self.lock = threading.RLock()
        self.action_lock = threading.Lock()
        self.tv_sessions = {}
        self.closed = False

    def state(self):
        state = self.db.get(self.key)['value'] or {'schema': 1, 'devices': [], 'audit': []}
        if state.get('schema') != 1:
            raise ValueError('Diese Geräteversion benötigt eine neuere Anwendung.')
        return state

    def list(self, project=None, worker=None):
        with self.lock:
            items = self.state()['devices']
            if project is not None:
                items = [d for d in items if self.allowed(d, project, worker)]
            return {'devices': [{**d, 'kind': 'device', 'category': 'devices'} for d in items], 'adbInstalled': bool(shutil.which('adb')), 'schema': 1}

    @staticmethod
    def allowed(d, project, worker):
        return d['enabled'] and d['projectId'] == project and worker in d['workers']

    def get(self, id):
        return next((d for d in self.state()['devices'] if d['id'] == id), None)

    def audit(self, id, action, actor, outcome):
        with self.lock:
            state = self.state()
            state['audit'] = (state['audit'] + [{'id': uuid4().hex, 'deviceId': id, 'action': action, 'actor': actor, 'outcome': outcome, 'at': time()}])[-500:]
            self.db.put(self.key, state)

    def save(self, data):
        with self.lock:
            state = self.state()
            old = self.get(data.id) if data.id else None
            if data.id and (not old or old['revision'] != data.revision):
                raise FileExistsError('Gerät wurde geändert. Bitte erneut öffnen.')
            if data.projectId != 'default' and not self.db.rows('SELECT id FROM projects WHERE id=?', (data.projectId,)):
                raise ValueError('Arbeitsbereich nicht gefunden.')
            value = data.model_dump()
            value.update(id=old['id'] if old else uuid4().hex, revision=(old['revision'] if old else 0) + 1)
            target = ('provider', 'transport', 'host', 'port', 'serial', 'url', 'allowPublic')
            changed = not old or any(old[k] != value[k] for k in target)
            if changed:
                value.update(enabled=False, checkedAt=None, status='unchecked', deviceIdentity=None)
            else:
                value.update(checkedAt=old.get('checkedAt'), status=old.get('status', 'unchecked'), deviceIdentity=old.get('deviceIdentity'))
            if value['enabled'] and value['status'] != 'connected':
                raise ValueError('Gerät zuerst erfolgreich verbinden, dann freigeben.')
            state['devices'] = [d for d in state['devices'] if d['id'] != value['id']] + [value]
            self.db.put(self.key, state)
            if changed:
                self.close_tv(value['id'])
            self.audit(value['id'], 'save', 'owner', 'saved')
            return value

    def revoke(self, id):
        with self.lock:
            state = self.state()
            d = next((d for d in state['devices'] if d['id'] == id), None)
            if not d:
                raise ValueError('Gerät nicht gefunden.')
            d['enabled'] = False
            d['revision'] += 1
            self.db.put(self.key, state)
            self.close_tv(id)
            self.audit(id, 'revoke', 'owner', 'blocked')
            return d

    def remove(self, id, revision):
        with self.lock:
            d = self.get(id)
            if not d or d['revision'] != revision:
                raise FileExistsError('Gerät wurde geändert. Bitte erneut öffnen.')
            state = self.state()
            state['devices'] = [d for d in state['devices'] if d['id'] != id]
            self.db.put(self.key, state)
            self.close_tv(id)
            self.audit(id, 'remove', 'owner', 'removed')
            return {'ok': True}

    def close_tv(self, id):
        ws = self.tv_sessions.pop(id, None)
        if ws:
            ws.close()

    def close(self):
        self.closed = True
        for id in list(self.tv_sessions):
            self.close_tv(id)

    def adb(self, arguments, stdin=None, binary=False):
        executable = shutil.which('adb')
        if not executable:
            raise ValueError('Android Platform Tools fehlen. ADB installieren und erneut prüfen.')
        # Native ADB owns its existing keys and server. Never reset or kill it.
        env = {k: v for k, v in os.environ.items() if k not in {'ADB_TRACE', 'ADB_SERVER_SOCKET', 'ANDROID_ADB_SERVER_PORT'}}
        try:
            with tempfile.TemporaryFile() as output:
                p = subprocess.run([executable, *arguments], input=stdin.encode() if stdin else None, stdout=output, stderr=subprocess.DEVNULL, timeout=20, env=env)
                size = output.tell()
                if size > 10 * 1024 * 1024:
                    raise ValueError('Geräteantwort ist zu groß.')
                output.seek(0)
                result = output.read()
        except subprocess.TimeoutExpired:
            raise ValueError('Gerät antwortet nicht rechtzeitig. Aktion wurde nicht automatisch wiederholt.') from None
        if p.returncode:
            raise ValueError('ADB-Verbindung fehlgeschlagen. Gerät entsperren und USB-/WLAN-Debugging sowie Port prüfen.')
        return result if binary else result.decode('utf-8', errors='replace')[:100000]

    def usb(self):
        rows = self.adb(['devices']).splitlines()[1:]
        return {'devices': [{'serial': p[0], 'status': p[1]} for row in rows if len(p := row.split()) == 2]}

    def endpoint(self, d):
        if d['transport'] == 'usb':
            return d['serial']
        ip = private_address(d['host'])
        return f'[{ip}]:{d["port"]}' if ':' in ip else f'{ip}:{d["port"]}'

    def android(self, d, a):
        endpoint = self.endpoint(d)
        if a.action == 'pair':
            if d['transport'] != 'network' or not a.pairingPort or not re.fullmatch(r'\d{6}', a.code):
                raise ValueError('Sechsstelligen Kopplungscode und Kopplungsport vom Android-Gerät eingeben.')
            target = endpoint.rsplit(':', 1)[0] + ':' + str(a.pairingPort)
            result = self.adb(['pair', target], stdin=a.code + '\n')
            if 'Successfully paired' not in result:
                raise ValueError('Kopplung nicht bestätigt. Neuen Code und Kopplungsport prüfen.')
            return {'ok': True, 'status': 'paired', 'message': 'Gekoppelt. Jetzt mit dem Verbindungsport verbinden.'}
        if a.action == 'disconnect':
            if d['transport'] == 'network':
                self.adb(['disconnect', endpoint])
            return {'ok': True, 'status': 'disconnected'}
        if a.action == 'connect' and d['transport'] == 'network':
            result = self.adb(['connect', endpoint])
            if not any(s in result for s in ('connected to', 'already connected')):
                raise ValueError('ADB-Verbindung nicht bestätigt. Verbindungsport prüfen.')
        identity = self.adb(['-s', endpoint, 'shell', 'getprop ro.serialno']).strip()
        if not identity or identity == 'unknown':
            identity = self.adb(['-s', endpoint, 'shell', 'getprop ro.boot.serialno']).strip()
        if not identity or identity == 'unknown':
            raise ValueError('Android meldet keine eindeutige Gerätekennung. Verbindung kann nicht sicher zugeordnet werden.')
        identity = hashlib.sha256(identity.encode()).hexdigest()
        if d.get('deviceIdentity') and d['deviceIdentity'] != identity:
            raise DeviceIdentityError('An dieser Adresse antwortet ein anderes Android-Gerät. Gerät neu einrichten.')
        if not d.get('deviceIdentity') and a.action not in {'connect', 'status'}:
            raise ValueError('Gerät zuerst verbinden und seine Identität bestätigen.')
        if a.action in {'connect', 'status'}:
            if self.adb(['-s', endpoint, 'get-state']).strip() != 'device':
                raise ValueError('Gerät ist nicht verbunden oder noch nicht freigegeben.')
            return {'ok': True, 'status': 'connected', 'deviceIdentity': identity}
        if a.action == 'screenshot':
            png = self.adb(['-s', endpoint, 'exec-out', 'screencap', '-p'], binary=True)
            if not png.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Gerät lieferte kein Bildschirmbild.')
            return {'ok': True, 'image': base64.b64encode(png).decode(), 'mimeType': 'image/png'}
        if a.action == 'key':
            if a.key not in ANDROID_KEYS:
                raise ValueError('Unbekannte Taste.')
            command = ['input', 'keyevent', ANDROID_KEYS[a.key]]
        elif a.action == 'tap':
            command = ['input', 'tap', str(a.x), str(a.y)]
        elif a.action == 'swipe':
            command = ['input', 'swipe', *map(str, [a.x, a.y, a.x2, a.y2, a.duration])]
        elif a.action == 'text':
            if not a.text or any(ord(c) < 32 or ord(c) > 126 for c in a.text) or '%' in a.text:
                raise ValueError('ADB-Texteingabe unterstützt hier druckbares ASCII ohne Prozentzeichen.')
            command = ['input', 'text', a.text.replace(' ', '%s')]
        elif a.action == 'launch':
            if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.]*/[A-Za-z0-9_.$]+', a.component):
                raise ValueError('App-Komponente als paket.name/.Activity angeben.')
            command = ['am', 'start', '-n', a.component]
        elif a.action == 'shell':
            if not a.command.strip():
                raise ValueError('Befehl fehlt.')
            return {'ok': True, 'output': self.adb(['-s', endpoint, 'shell', a.command])}
        else:
            raise ValueError('Unbekannte Android-Aktion.')
        return {'ok': True, 'output': self.adb(['-s', endpoint, 'shell', shlex.join(command)])}

    def television(self, d, a):
        from websockets.sync.client import connect
        from websockets.exceptions import WebSocketException
        if a.action == 'disconnect':
            self.close_tv(d['id'])
            return {'ok': True, 'status': 'disconnected'}
        if a.action not in {'connect', 'status', 'key'}:
            raise ValueError('Samsung unterstützt Verbindungsprüfung und Fernbedienungstasten.')
        if a.action == 'key' and a.key not in TV_KEYS:
            raise ValueError('Unbekannte Fernseher-Taste.')
        u = urlsplit(d['url'])
        ip = private_address(u.hostname) if not d['allowPublic'] else None
        try:
            ws = self.tv_sessions.get(d['id'])
            if ws is None:
                # Pin private DNS resolution to the checked address; WSS still verifies the original hostname.
                sock = socket.create_connection((ip or u.hostname, u.port or (443 if u.scheme == 'wss' else 80)), timeout=10)
                url = f'{u.scheme}://{u.netloc}/api/v2/channels/samsung.remote.control?' + urlencode({'name': base64.b64encode(b'Vanilla').decode()})
                try:
                    ws = connect(url, sock=sock, proxy=None, open_timeout=10, close_timeout=1, max_size=65536)
                except BaseException:
                    sock.close()
                    raise
                deadline = monotonic() + 20
                try:
                    while monotonic() < deadline:
                        message = json.loads(ws.recv(timeout=max(.01, deadline - monotonic())))
                        if message.get('event') == 'ms.channel.connect':
                            break
                        if message.get('event') in {'ms.channel.unauthorized', 'ms.channel.timeOut'}:
                            raise ValueError('Verbindung am Fernseher zulassen und erneut verbinden.')
                    else:
                        raise ValueError('Bestätigung am Fernseher fehlt.')
                except BaseException:
                    ws.close()
                    raise
                with self.lock:
                    if self.closed or not self.get(d['id']) or self.get(d['id'])['revision'] != d['revision']:
                        ws.close()
                        raise ValueError('Gerät wurde während der Verbindung geändert.')
                    self.tv_sessions[d['id']] = ws
            if a.action in {'status', 'connect'}:
                if not ws.ping().wait(5):
                    raise ValueError('Fernseher antwortet nicht.')
                return {'ok': True, 'status': 'connected'}
            ws.send(json.dumps({'method': 'ms.remote.control', 'params': {'Cmd': 'Click', 'DataOfCmd': TV_KEYS[a.key], 'Option': 'false', 'TypeOfRemote': 'SendRemoteKey'}}))
            return {'ok': True, 'status': 'sent', 'message': 'Taste gesendet. Der Fernseher bestätigt die Ausführung nicht separat.'}
        except ValueError:
            self.close_tv(d['id'])
            raise
        except (OSError, TimeoutError, WebSocketException, json.JSONDecodeError):
            self.close_tv(d['id'])
            raise ValueError('Fernseher nicht erreichbar. Einschalten, Fernzugriff zulassen und Adresse/Zertifikat prüfen.') from None

    def execute(self, id, action, project=None, worker=None):
        actor = f'{project}/{worker}' if project is not None else 'owner'
        # Serialize actions, but revocation can be saved immediately while I/O is pending.
        with self.action_lock:
            with self.lock:
                d = self.get(id)
                if not d:
                    raise ValueError('Gerät nicht gefunden.')
                if project is not None and (not self.allowed(d, project, worker) or PERMISSIONS.get(action.action) not in d['permissions']):
                    self.audit(id, action.action, actor, 'denied')
                    raise ValueError('Dieses Gerät oder diese Aktion ist für den Agenten nicht freigegeben.')
                if self.closed:
                    raise ValueError('Geräteanschluss wird beendet.')
                self.audit(id, action.action, actor, 'started')
            try:
                result = self.android(d, action) if d['provider'] == 'android-adb' else self.television(d, action)
            except ValueError as error:
                if action.action in {'connect', 'status'} or isinstance(error, DeviceIdentityError):
                    with self.lock:
                        current = self.get(id)
                        if current and current['revision'] == d['revision']:
                            state = self.state()
                            current.update(status='error', enabled=False, checkedAt=time(), revision=current['revision'] + 1)
                            state['devices'] = [current if item['id'] == id else item for item in state['devices']]
                            self.db.put(self.key, state)
                self.audit(id, action.action, actor, 'failed')
                raise
            with self.lock:
                current = self.get(id)
                if current and current['revision'] == d['revision'] and result.get('status') in {'paired', 'connected', 'disconnected'}:
                    state = self.state()
                    current.update(status=result['status'], checkedAt=time(), revision=current['revision'] + 1)
                    if result.get('deviceIdentity'):
                        current['deviceIdentity'] = result['deviceIdentity']
                    if result['status'] != 'connected':
                        current['enabled'] = False
                    state['devices'] = [current if item['id'] == id else item for item in state['devices']]
                    self.db.put(self.key, state)
                self.audit(id, action.action, actor, 'sent' if result.get('status') == 'sent' else 'completed')
            return result
