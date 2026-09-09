"""Installation-local provider vault. Never imports host credentials."""

import json
import os
import re
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken


class ProviderVault:
    def __init__(self, directory: Path, db):
        self.directory, self.db = directory, db

    def cipher(self):
        if self.directory.is_symlink():
            raise ValueError("Ungültiger Tresorpfad.")
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.directory.chmod(0o700)
        key = self.directory / "provider.key"
        if key.is_symlink():
            raise ValueError("Ungültiger Tresorpfad.")
        if not key.exists() and self.db.rows(
            "SELECT key FROM records WHERE key LIKE 'provider-vault/%' LIMIT 1"
        ):
            raise ValueError(
                "Tresorschlüssel fehlt. Bitte die vollständige Sicherung wiederherstellen."
            )
        try:
            fd = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, "wb") as stream:
                stream.write(Fernet.generate_key())
                stream.flush()
                os.fsync(stream.fileno())
        key.chmod(0o600)
        return Fernet(key.read_bytes())

    def name(self, name):
        if not re.fullmatch(r"[\w-]{1,150}", name):
            raise ValueError("Ungültige Schlüsselkennung.")
        return "provider-vault/" + name

    def save(self, name, value):
        if len(value) > 100000:
            raise ValueError("Zugang zu groß.")
        with self.db.lock:
            self.db.put(self.name(name), self.cipher().encrypt(value.encode()).decode())

    def read(self, name):
        value = self.db.get(self.name(name))["value"]
        if not value:
            raise ValueError("Zugang fehlt. Bitte erneut verbinden.")
        try:
            return self.cipher().decrypt(value.encode()).decode()
        except InvalidToken:
            raise ValueError("Zugang nicht lesbar. Bitte erneut verbinden.") from None

    def has(self, name):
        return self.db.get(self.name(name))["found"]

    def remove(self, name):
        with self.db.transaction() as cx:
            cx.execute("DELETE FROM records WHERE key=?", (self.name(name),))
