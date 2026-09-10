"""Installation-scoped secrets. There is deliberately no global/host fallback."""
from contextlib import closing, contextmanager
import json
import sqlite3
from .provider_vault import ProviderVault

def read_secret(id, config=None, db=None):
    if config is None:
        raise ValueError("Ein installationsgebundener Tresor ist erforderlich.")
    if db is not None:
        return ProviderVault(config.data / 'provider-vault', db).read(id)
    with vault_database(config) as db:
        return ProviderVault(config.data / 'provider-vault', db).read(id)


@contextmanager
def vault_database(config):
    # Startup and offline restore already hold the outer installation lock.
    with closing(sqlite3.connect((config.data / 'agent.sqlite3').resolve().as_uri() + '?mode=ro', uri=True)) as cx:
        cx.row_factory = sqlite3.Row
        class ReadOnly:
            def get(self, name):
                row = cx.execute('SELECT value FROM records WHERE key=?', (name,)).fetchone()
                return {'found': bool(row), 'value': json.loads(row[0]) if row else None}
            def rows(self, sql):
                return [dict(row) for row in cx.execute(sql)]
        yield ReadOnly()


def save_secret(id, value, config=None, db=None):
    if config is None or db is None:
        raise ValueError("Ein installationsgebundener Tresor ist erforderlich.")
    ProviderVault(config.data / 'provider-vault', db).save(id, value)


def register_secret(db, id, name):
    with db.lock:
        state = db.get("control/state.json")["value"]
        if not state:
            return
        state["secrets"] = [s for s in state.get("secrets", []) if s["id"] != id] + [{"id": id, "name": name, "system": True}]
        db.put("control/state.json", state)
