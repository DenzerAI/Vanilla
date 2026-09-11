"""Provider credentials live in the installation's .env; SQLite stores references."""
from contextlib import contextmanager
from pathlib import Path
from .env_secrets import EnvSecrets, variable
from .legacy_vault import LegacyVault


class ProviderVault:
    def __init__(self, directory: Path, db, root):
        self.directory, self.db = Path(directory), db
        LegacyVault(self.directory, db).paths()
        self.env = EnvSecrets(root)

    def name(self, name):
        variable(name)
        return 'provider-vault/' + name

    def records(self):
        return self.db.rows("SELECT key,value FROM records WHERE key LIKE 'provider-vault/%'")

    def reference(self, name):
        return {'storage': 'env', 'key': variable(name)}

    def legacy(self):
        return LegacyVault(self.directory, self.db)

    def status(self):
        try:
            self.env.check()
            if self._old_records():
                return {'state':'migration-required','message':'Vorhandene Zugänge einmalig in die lokale .env übernehmen.'}
            values=self.env.values()
            import json
            if any(not values.get(json.loads(r['value']).get('key')) for r in self.records()):
                return {'state':'error','storage':'env','message':'Gespeicherte Zugänge fehlen in .env. Datei wiederherstellen oder erneut verbinden.'}
            configured = bool(self.records()) or self.env.path.exists()
            return {'state':'configured' if configured else 'unconfigured', 'storage':'env',
                    'message':'Zugänge liegen in der lokalen .env im Vanilla-Ordner.' if configured else 'Beim ersten Speichern wird .env im Vanilla-Ordner angelegt.'}
        except ValueError:
            return {'state':'error','message':'Lokale .env oder Installationspfad prüfen.'}

    def _old_records(self):
        import json
        return [r for r in self.records() if not isinstance(json.loads(r['value']), dict)]

    def read(self, name):
        record = self.db.get(self.name(name))['value']
        if record and record != self.reference(name):
            # Existing installations can still read their own old vault until
            # explicit migration; never initialize or replace a missing OS key.
            return self.legacy().read(name)
        value = self.env.values().get(variable(name))
        if not value:
            raise ValueError('Zugang fehlt in .env. Bitte erneut verbinden.')
        return value

    def has(self, name):
        return self.db.get(self.name(name))['found'] or bool(self.env.values().get(variable(name)))

    @contextmanager
    def updating(self, values):
        with self.db.lock:
            if self._old_records():
                raise ValueError('Vorhandene Zugänge zuerst mit python -m core.vault_migrate in .env übernehmen.')
            for name, value in values.items():
                variable(name)
                if value is not None and (not isinstance(value,str) or not value or len(value.encode())>100000 or '\0' in value):
                    raise ValueError('Zugang muss ein nicht leerer Text mit höchstens 100000 Bytes sein.')
            with self.env.updating({variable(k):v for k,v in values.items()}):
                yield {k:self.reference(k) for k,v in values.items() if v is not None}

    def save(self, name, value):
        with self.updating({name:value}) as refs:
            self.db.put(self.name(name),refs[name])

    def remove(self, name):
        with self.updating({name:None}):
            with self.db.transaction() as cx:
                cx.execute('DELETE FROM records WHERE key=?',(self.name(name),))

    def migrate(self):
        import json
        with self.db.lock:
            old = self._old_records()
            if not old:
                return {'changed':False}
            legacy = self.legacy()
            # Validate the entire old set before writing any plaintext file.
            keyfile = self.directory/'provider.key'
            if keyfile.exists():
                from cryptography.fernet import Fernet, InvalidToken
                try:
                    cipher=Fernet(keyfile.read_bytes())
                    values={r['key'].split('/',1)[1]:cipher.decrypt(json.loads(r['value']).encode()).decode() for r in old}
                except (OSError,ValueError,InvalidToken,UnicodeError):
                    raise ValueError('Alter Tresorschlüssel und Zugänge passen nicht zusammen. Keine Änderung vorgenommen.') from None
            else:
                values={r['key'].split('/',1)[1]:legacy.read(r['key'].split('/',1)[1]) for r in old}
            current=self.env.values()
            if any(variable(k) in current and current[variable(k)]!=v for k,v in values.items()):
                raise ValueError('Vorhandene .env und Tresorzugänge widersprechen sich. Keine Änderung vorgenommen.')
            with self.env.updating({variable(k):v for k,v in values.items()}):
                from .database import dump
                from time import time
                with self.db.transaction() as cx:
                    for name in values:
                        cx.execute('UPDATE records SET value=?,updated_at=? WHERE key=?',(dump(self.reference(name)),time(),self.name(name)))
            # Retain legacy artifacts for the explicit rollback path. New writes
            # and startup no longer contact the operating system key store.
            return {'changed':True}
