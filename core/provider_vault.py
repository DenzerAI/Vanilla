"""Encrypted installation records; master key lives only in the native key store."""
import json
import re
from pathlib import Path
from uuid import uuid4
from cryptography.fernet import Fernet, InvalidToken
from .files import atomic_write
from .vault_keys import InstallationKey


class ProviderVault:
    def __init__(self, directory: Path, db):
        self.directory, self.db = directory, db

    def paths(self):
        if any(p.is_symlink() for p in [self.directory, *self.directory.parents]):
            raise ValueError('Ungültiger Tresorpfad.')
        for name in ['vault.json', 'provider.key']:
            if (self.directory / name).is_symlink():
                raise ValueError('Ungültiger Tresorpfad.')

    def identity(self):
        self.paths()
        file = self.directory / 'vault.json'
        if not file.exists():
            return None
        try:
            data = json.loads(file.read_text())
            if data['version'] != 2 or not re.fullmatch(r'[a-f0-9]{32}', data['id']):
                raise ValueError()
            return data['id']
        except (ValueError, KeyError, TypeError, OSError):
            raise ValueError('Tresorzuordnung ist beschädigt oder inkompatibel. Sicherung wiederherstellen.') from None

    def records(self):
        return self.db.rows("SELECT key,value FROM records WHERE key LIKE 'provider-vault/%'")

    def status(self):
        # No OS prompts, key reads or implicit initialization during polling.
        try:
            identity = self.identity()
            if (self.directory / 'provider.key').exists():
                return {'state': 'migration-required', 'message': 'Vorhandenen Tresor mit dem lokalen Migrationsbefehl schützen.'}
            if not identity and self.records():
                return {'state': 'error', 'message': 'Tresorzuordnung fehlt. Vollständige Sicherung wiederherstellen.'}
            return {'state': 'configured' if identity else 'unconfigured',
                    'message': 'Geschützt eingerichtet; Entsperrung wird beim Verwenden geprüft.' if identity else 'Wird beim ersten Speichern in der Betriebssystem-Schlüsselverwaltung eingerichtet.'}
        except ValueError:
            return {'state': 'error', 'message': 'Tresorzuordnung ist ungültig.'}

    def key(self, create=False):
        identity = self.identity()
        if (self.directory / 'provider.key').exists():
            raise ValueError('Lokaler Tresor benötigt Migration. python -m core.vault_migrate ausführen.')
        if identity is None:
            if self.records() or not create:
                raise ValueError('Tresorschlüssel fehlt. Vollständige Sicherung wiederherstellen.')
            identity, key = uuid4().hex, Fernet.generate_key()
            self._install(identity, key)
            return key
        key = InstallationKey(self.directory, identity).read()
        try:
            Fernet(key)
        except (ValueError, TypeError):
            raise ValueError('Tresorschlüssel ist ungültig. Sicherung wiederherstellen.') from None
        return key

    def _install(self, identity, key):
        self.paths()
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.directory.chmod(0o700)
        InstallationKey(self.directory, identity).create(key)
        atomic_write(self.directory / 'vault.json', json.dumps({'version': 2, 'id': identity}))

    def cipher(self):
        return Fernet(self.key())

    def name(self, name):
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,150}', name):
            raise ValueError('Ungültige Schlüsselkennung.')
        return 'provider-vault/' + name

    def encrypt(self, name, value):
        self.name(name)
        if not isinstance(value, str) or not value or len(value.encode()) > 100000:
            raise ValueError('Zugang muss ein nicht leerer Text mit höchstens 100000 Bytes sein.')
        return Fernet(self.key(create=True)).encrypt(value.encode()).decode()

    def save(self, name, value):
        with self.db.lock:
            self.db.put(self.name(name), self.encrypt(name, value))

    def read(self, name):
        value = self.db.get(self.name(name))['value']
        if not value:
            raise ValueError('Zugang fehlt. Bitte erneut verbinden.')
        try:
            return self.cipher().decrypt(value.encode()).decode()
        except (InvalidToken, UnicodeError, AttributeError):
            raise ValueError('Zugang nicht lesbar. Vollständige Sicherung prüfen.') from None

    def has(self, name):
        # Existence is metadata, not proof of an unlocked store or provider login.
        return self.db.get(self.name(name))['found']

    def remove(self, name):
        with self.db.lock:
            if self.has(name):
                self.read(name)
            with self.db.transaction() as cx:
                cx.execute('DELETE FROM records WHERE key=?', (self.name(name),))

    def migrate(self):
        """Explicit offline migration, also used after a verified restore swap."""
        self.paths()
        legacy = self.directory / 'provider.key'
        if not legacy.exists():
            if self.identity():
                self.key()
            return {'changed': False}
        try:
            key = legacy.read_bytes()
            cipher = Fernet(key)
            for row in self.records():
                cipher.decrypt(json.loads(row['value']).encode())
        except (OSError, ValueError, InvalidToken, TypeError, KeyError):
            raise ValueError('Alter Tresorschlüssel und Zugänge passen nicht zusammen. Keine Änderung vorgenommen.') from None
        identity = self.identity()
        if identity:
            if InstallationKey(self.directory, identity).read() != key:
                raise ValueError('Tresorzuordnungen widersprechen sich. Keine Änderung vorgenommen.')
        else:
            self._install(uuid4().hex, key)
        legacy.unlink()
        return {'changed': True}
