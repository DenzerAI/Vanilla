"""Tests never read or write the developer's native key store."""
import pytest
from core import vault_keys


class MemoryKeyStore:
    def __init__(self):
        self.values = {}
        self.locked = False

    def get_password(self, service, account):
        if self.locked:
            raise RuntimeError('synthetic backend diagnostic')
        return self.values.get((service, account))

    def set_password(self, service, account, value):
        if self.locked:
            raise RuntimeError('synthetic backend diagnostic')
        self.values[service, account] = value


@pytest.fixture(autouse=True)
def native_keys(monkeypatch):
    for name in ["COMPANY_BASE", "SYSTEM_BASE", "UWE_WORKSPACE", "UWE_DATA_ROOT"]:
        monkeypatch.delenv(name, raising=False)
    backend = MemoryKeyStore()
    monkeypatch.setattr(vault_keys, 'os_store', lambda: backend)
    return backend
