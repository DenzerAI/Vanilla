import json
import shutil
from concurrent.futures import ThreadPoolExecutor
import pytest
from cryptography.fernet import Fernet
from core.database import Database
from core.provider_vault import ProviderVault
from core.legacy_vault import LegacyVault
from core.env_secrets import parse, variable
from core.secrets import read_secret
from core.tests.test_core import config, db
from core.tests.test_operations import services


def test_env_restart_copy_permissions_and_no_native_dependency(config, db, native_keys):
    native_keys.locked=True
    vault=ProviderVault(config.data/'provider-vault',db,config.root)
    assert vault.status()['state']=='unconfigured'
    secret='value with "quotes" $HOME `command`\nsecond line'
    vault.save('synthetic',secret)
    assert vault.read('synthetic')==secret
    assert not native_keys.values
    assert not vault.directory.exists()
    assert (config.root/'.env').stat().st_mode & 0o777==0o600
    assert secret not in json.dumps(db.get(vault.name('synthetic')))
    db.close()
    assert read_secret('synthetic',config)==secret
    moved=config.root.parent/'moved'
    shutil.copytree(config.root,moved)
    from core.config import Config
    other=Config(root=moved,data=moved/config.data.relative_to(config.root))
    assert read_secret('synthetic',other)==secret
    (moved/'.env').unlink()
    with pytest.raises(ValueError,match='.env'):read_secret('synthetic',other)


def test_comments_manual_aliases_and_bad_env_preserve_file(config,db):
    file=config.root/'.env'
    file.write_text('# retained\nPORT=1234\nELEVENLABS_API_KEY="manual-value"\n')
    vault=ProviderVault(config.data/'provider-vault',db,config.root)
    assert vault.read('speech-elevenlabs')=='manual-value'
    vault.save('speech-elevenlabs','new-value')
    assert file.read_text().startswith('# retained\nPORT=1234\n')
    assert file.read_text().count('ELEVENLABS_API_KEY=')==1
    file.write_text('ELEVENLABS_API_KEY="bad\n')
    before=file.read_text()
    with pytest.raises(ValueError,match='Ungültiger Wert'):vault.save('synthetic','value')
    assert file.read_text()==before
    for text in ['A=1\nA=2','not-an-assignment','A="one" trailing']:
        with pytest.raises(ValueError):parse(text)


def test_concurrent_writes_and_remove_preserve_other_entries(config,db,native_keys):
    def save(i):ProviderVault(config.data/'provider-vault',db,config.root).save('entry-'+str(i),str(i))
    with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(save,range(12)))
    vault=ProviderVault(config.data/'provider-vault',db,config.root)
    assert [vault.read('entry-'+str(i)) for i in range(12)]==[str(i) for i in range(12)]
    vault.remove('entry-0')
    assert not vault.has('entry-0')
    assert variable('entry-0') not in vault.env.values()
    assert vault.read('entry-1')=='1'
    assert not native_keys.values


@pytest.mark.parametrize('native',[False,True])
def test_migration_is_explicit_complete_and_idempotent(config,db,native_keys,native):
    directory=config.data/'provider-vault'
    if native:
        LegacyVault(directory,db).save('legacy','legacy-value')
    else:
        directory.mkdir()
        key=Fernet.generate_key();(directory/'provider.key').write_bytes(key)
        db.put('provider-vault/legacy',Fernet(key).encrypt(b'legacy-value').decode())
    vault=ProviderVault(directory,db,config.root)
    assert vault.status()['state']=='migration-required'
    with pytest.raises(ValueError,match='übernehmen'):vault.save('new','value')
    if native:
        native_keys.locked=True
        with pytest.raises(ValueError):vault.migrate()
        assert not (config.root/'.env').exists()
        native_keys.locked=False
    assert vault.migrate()=={'changed':True}
    native_keys.locked=True
    assert vault.read('legacy')=='legacy-value'
    assert vault.migrate()=={'changed':False}


def test_migration_conflicts_invalid_key_and_symlinks_preserve_data(config,db,native_keys):
    directory=config.data/'provider-vault';directory.mkdir()
    key=Fernet.generate_key();(directory/'provider.key').write_bytes(key)
    db.put('provider-vault/legacy',Fernet(Fernet.generate_key()).encrypt(b'value').decode())
    with pytest.raises(ValueError,match='passen nicht'):ProviderVault(directory,db,config.root).migrate()
    assert not (config.root/'.env').exists()
    db.put('provider-vault/legacy',Fernet(key).encrypt(b'value').decode())
    env=config.root/'.env';env.write_text(variable('legacy')+'="different"\n')
    with pytest.raises(ValueError,match='widersprechen'):ProviderVault(directory,db,config.root).migrate()
    assert 'different' in env.read_text()
    env.unlink();target=config.root/'outside';target.write_text('unchanged')
    env.symlink_to(target)
    with pytest.raises(ValueError,match='Verknüpfte'):ProviderVault(directory,db,config.root).migrate()
    assert target.read_text()=='unchanged'


def test_failed_database_write_rolls_back_env(config,db,monkeypatch):
    vault=ProviderVault(config.data/'provider-vault',db,config.root)
    vault.save('synthetic','original')
    def fail(*args,**kwargs):raise OSError('synthetic')
    monkeypatch.setattr(db,'put',fail)
    with pytest.raises(OSError):vault.save('synthetic','replacement')
    assert vault.read('synthetic')=='original'


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
