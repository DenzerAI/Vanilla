"""Installation-local dotenv values. Never source this file into worker processes."""
import json
import os
import re
from contextlib import contextmanager
from pathlib import Path
from .files import atomic_write

PREFIX = 'VANILLA_SECRET_'
ALIASES = {'speech-elevenlabs': 'ELEVENLABS_API_KEY', 'dictation-groq': 'GROQ_API_KEY'}


def variable(name):
    if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,150}', name):
        raise ValueError('Ungültige Schlüsselkennung.')
    return ALIASES.get(name, PREFIX + name.encode().hex().upper())


def parse(text):
    result = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', stripped)
        if not match:
            raise ValueError('Ungültige Zeile in .env. Datei prüfen; keine Änderung vorgenommen.')
        key, raw = match.groups()
        if key in result:
            raise ValueError('Doppelte Variable in .env. Datei prüfen; keine Änderung vorgenommen.')
        try:
            if raw.startswith('"'):
                value = json.loads(raw)
            elif raw.startswith("'"):
                if not raw.endswith("'") or len(raw) < 2:
                    raise ValueError()
                value = raw[1:-1]
            else:
                value = re.split(r'\s+#', raw, maxsplit=1)[0].strip()
            if not isinstance(value, str) or '\0' in value:
                raise ValueError()
        except (ValueError, TypeError):
            raise ValueError('Ungültiger Wert in .env. Datei prüfen; keine Änderung vorgenommen.') from None
        result[key] = value
    return result


class EnvSecrets:
    def __init__(self, root):
        self.root = Path(root)
        self.path = self.root / '.env'

    def check(self):
        if any(p.is_symlink() for p in [self.path, self.root, *self.root.parents]):
            raise ValueError('Verknüpfte .env oder Installationspfade sind nicht erlaubt.')
        if self.path.exists() and not self.path.is_file():
            raise ValueError('.env muss eine reguläre Datei sein.')

    def text(self):
        self.check()
        try:
            return self.path.read_text()
        except FileNotFoundError:
            return ''

    def values(self):
        return parse(self.text())

    @contextmanager
    def updating(self, changes):
        # Caller owns the installation database lock, including across rollback.
        old = self.text()
        existed = self.path.exists()
        parse(old)
        lines = []
        for line in old.splitlines():
            match = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
            if not match or match[1] not in changes:
                lines.append(line)
        for key, value in changes.items():
            if value is not None:
                lines.append(key + '=' + json.dumps(value, ensure_ascii=False))
        self.check()
        atomic_write(self.path, '\n'.join(lines) + '\n')
        try:
            yield
        except BaseException:
            if existed:
                atomic_write(self.path, old)
            else:
                self.path.unlink(missing_ok=True)
            raise
