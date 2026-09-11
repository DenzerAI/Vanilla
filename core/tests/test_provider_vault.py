import json
import shutil
from concurrent.futures import ThreadPoolExecutor
import pytest
from cryptography.fernet import Fernet
from core.database import Database
from core.provider_vault import ProviderVault
from core.secrets import read_secret
from core.tests.test_core import config, db
from core.tests.test_operations import services


def test_restart_separation_and_no_plaintext_key(config, db, native_keys):
    vault = ProviderVault(config.data / 'provider-vault', db)
    assert vault.status()['state'] == 'unconfigured'
    assert not native_keys.values
    vault.save('synthetic', 'synthetic-private-value')
    key = vault.key()
    assert len(native_keys.values) == 1
    assert not (vault.directory/'provider.key').exists()
    assert vault.read('synthetic') == 'synthetic-private-value'
    for file in config.data.rglob('*'):
        if file.is_file():
            assert key not in file.read_bytes()
            assert b'synthetic-private-value' not in file.read_bytes()
    db.close()
    reopened = Database(config.data/'agent.sqlite3')
    try:
        assert read_secret('synthetic', config, reopened) == 'synthetic-private-value'
        assert read_secret('synthetic', config) == 'synthetic-private-value'
        other = config.data/'another-vault'
        shutil.copytree(vault.directory, other)
        with pytest.raises(ValueError, match='Tresorschlüssel fehlt'):
            ProviderVault(other, reopened).read('synthetic')
    finally:
        reopened.close()


def test_locked_missing_key_and_failed_replace_preserve_records(config, db, native_keys):
    vault = ProviderVault(config.data/'provider-vault', db)
    vault.save('synthetic', 'original')
    before = db.get(vault.name('synthetic'))
    native_keys.locked = True
    for action in [lambda: vault.read('synthetic'), lambda: vault.save('synthetic','replacement'), lambda: vault.remove('synthetic')]:
        with pytest.raises(ValueError, match='gesperrt') as error: action()
        assert 'synthetic backend diagnostic' not in str(error.value)
    assert db.get(vault.name('synthetic')) == before
    # Status polling stays available without triggering an OS prompt.
    assert vault.status()['state'] == 'configured'
    native_keys.locked = False
    native_keys.values.clear()
    with pytest.raises(ValueError, match='Tresorschlüssel fehlt'): vault.save('new','value')
    assert not native_keys.values
    assert db.get(vault.name('synthetic')) == before


def test_concurrent_first_writes_share_one_key(config, db, native_keys):
    def save(i): ProviderVault(config.data/'provider-vault',db).save('entry-'+str(i),str(i))
    with ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(save, range(12)))
    vault = ProviderVault(config.data/'provider-vault',db)
    assert len(native_keys.values) == 1
    assert [vault.read('entry-'+str(i)) for i in range(12)] == [str(i) for i in range(12)]


def test_explicit_migration_validates_before_removing_old_key(config, db, native_keys):
    directory = config.data/'provider-vault'; directory.mkdir()
    key = Fernet.generate_key(); (directory/'provider.key').write_bytes(key)
    db.put('provider-vault/legacy',Fernet(key).encrypt(b'legacy-value').decode())
    vault = ProviderVault(directory,db)
    assert vault.status()['state'] == 'migration-required'
    with pytest.raises(ValueError,match='Migration'): vault.read('legacy')
    native_keys.locked = True
    with pytest.raises(ValueError): vault.migrate()
    assert (directory/'provider.key').read_bytes() == key
    assert not (directory/'vault.json').exists()
    native_keys.locked = False
    assert vault.migrate() == {'changed': True}
    assert not (directory/'provider.key').exists()
    assert vault.read('legacy') == 'legacy-value'
    assert vault.migrate() == {'changed': False}


def test_wrong_migration_key_and_symlinks_do_not_mutate(config, db, native_keys):
    directory = config.data/'provider-vault'; directory.mkdir()
    (directory/'provider.key').write_bytes(Fernet.generate_key())
    db.put('provider-vault/legacy',Fernet(Fernet.generate_key()).encrypt(b'value').decode())
    with pytest.raises(ValueError,match='passen nicht'): ProviderVault(directory,db).migrate()
    assert not native_keys.values
    linked = config.data/'linked'; linked.symlink_to(directory, target_is_directory=True)
    with pytest.raises(ValueError,match='Tresorpfad'): ProviderVault(linked,db).save('test','value')
    assert not native_keys.values


def test_login_change_failure_preserves_both_keys_and_sessions(config, db, monkeypatch):
    import core.operations as module
    _,_,_,ops,_,_,runtime = services(config,db)
    ops.configure_access('original-login-value')
    previous_api = config.access_token
    db.connection.execute("INSERT INTO sessions VALUES('synthetic-session','csrf',9999999999)")
    def fail(path,text): raise OSError('synthetic write failure')
    monkeypatch.setattr(module,'atomic_write',fail)
    with pytest.raises(OSError): ops.configure_access('replacement-login-value')
    assert read_secret('system-access',config,db) == 'original-login-value'
    assert read_secret('system-api',config,db) == previous_api
    assert config.login_password == 'original-login-value'
    assert len(db.rows('SELECT * FROM sessions')) == 1
    import asyncio
    asyncio.run(runtime.close())
