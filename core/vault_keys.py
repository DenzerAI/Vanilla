"""Only our installation key; never discover or import existing host accounts."""
import hashlib
import sys


def os_store():
    # Bypass user-configured plugins and plaintext fallback backends.
    try:
        if sys.platform == 'darwin':
            from keyring.backends.macOS import Keyring
            store = Keyring()
            store.keychain = None
        elif sys.platform.startswith('linux'):
            from keyring.backends.SecretService import Keyring
            store = Keyring()
        else:
            raise ValueError('Unsupported platform')
        if store.priority <= 0:
            raise ValueError('Unavailable backend')
        return store
    except Exception:
        raise ValueError('Geschützte Schlüsselablage nicht verfügbar. Betriebssystem-Schlüsselverwaltung einrichten und entsperren.') from None


class InstallationKey:
    def __init__(self, directory, identity):
        scope = hashlib.sha256(str(directory.resolve()).encode()).hexdigest()
        self.service = 'org.vanilla.installation-vault.' + scope
        self.account = identity

    def read(self):
        try:
            value = os_store().get_password(self.service, self.account)
            if value is not None:
                return value.encode('ascii')
        except Exception:
            raise ValueError('Tresor gesperrt oder Schlüsselverwaltung nicht erreichbar. Betriebssystem-Schlüsselverwaltung entsperren.') from None
        raise ValueError('Tresorschlüssel fehlt. Die vollständige verschlüsselte Sicherung wiederherstellen.')

    def create(self, value):
        try:
            store = os_store()
            if store.get_password(self.service, self.account) is not None:
                raise ValueError('Already exists')
            store.set_password(self.service, self.account, value.decode('ascii'))
            if store.get_password(self.service, self.account) != value.decode('ascii'):
                raise ValueError('Readback failed')
        except Exception:
            raise ValueError('Tresorschlüssel konnte nicht geschützt gespeichert und geprüft werden. Bisherige Zugänge bleiben erhalten.') from None
