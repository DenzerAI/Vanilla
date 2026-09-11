"""Apply staged restores offline; a durable journal rolls back interrupted swaps."""
import fcntl
import json
import os
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path
from time import time
from uuid import uuid4

from .backups import verify_apply, snapshot_paths, ADAPTER_FILES
from .files import atomic_write, read_json, sync_directory, sha256


def durable_replace(source, target):
    os.replace(source, target)
    sync_directory(Path(target).parent)
    if Path(source).parent != Path(target).parent:
        sync_directory(Path(source).parent)


def sync_copy(path):
    files = list(path.rglob('*')) if path.is_dir() else [path]
    for file in files:
        if file.is_file():
            with file.open('rb') as handle: os.fsync(handle.fileno())
    for folder in reversed(files):
        if folder.is_dir(): sync_directory(folder)
    if path.is_dir(): sync_directory(path)
    sync_directory(path.parent)


def remove(path):
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def recover(config, journal):
    state = read_json(journal)
    if not state:
        return
    if state.get('committed'):
        receipt(config, state)
        (config.data / 'restore-pending.json').unlink(missing_ok=True)
        sync_directory(config.data)
        journal.unlink()
        sync_directory(config.data)
        return
    allowed = {*(target for _,target in snapshot_paths(config)), config.root/'.env',config.data/'host.json',config.data/'restore-hold.json',*(config.data/name for name in ADAPTER_FILES),config.data/'agent.sqlite3', *[Path(str(config.data/'agent.sqlite3')+s) for s in ('-wal','-shm')]}
    for step in reversed(state['steps']):
        target, old, prepared = (Path(step[k]) if step.get(k) else None for k in ('target','old','prepared'))
        if target not in allowed or old.parent != target.parent or not old.name.startswith('.agent-restore-'):
            raise ValueError('Ungültiges Wiederherstellungsjournal.')
        if old.exists():
            remove(target)
            durable_replace(old,target)
        elif not step['existed'] and step.get('started'):
            remove(target)
        if prepared and prepared.parent == target.parent and prepared.name.startswith('.agent-restore-'):
            remove(prepared)
    # Do not automatically repeat the failed replacement on every service restart.
    pending=config.data/'restore-pending.json'
    if pending.exists(): durable_replace(pending,config.data/'restore-failed.json')
    atomic_write(config.data/'restore-last.json',json.dumps({'ok':False,'rolled_back':True,'at':time()}))
    journal.unlink()
    sync_directory(config.data)


def receipt(config, state):
    atomic_write(config.data/'restore-last.json',json.dumps({'ok':True,'snapshot':state['snapshot'],'safety':[s['old'] for s in state['steps'] if s['existed']],'restored_at':state.get('committed_at',time()),'review_required':True}))


def quarantine_database(file):
    # The archive remains untouched. Ambiguous past work is never retried,
    # including formerly queued work that might have run since the snapshot.
    with closing(sqlite3.connect(file)) as cx:
        cx.execute("UPDATE executions SET status='interrupted',finished_at=?,lease_until=NULL,error='Aus Sicherung übernommen. Ergebnis vor einem neuen Auftrag prüfen.' WHERE status IN ('queued','dispatching','running')", (time(),))
        cx.execute("UPDATE job_notifications SET delivery='unknown',delivery_error='Aus Sicherung übernommen; kein automatischer Versand.' WHERE delivery IN ('pending','sending')")
        if cx.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mail_sends'").fetchone():
            cx.execute("UPDATE mail_sends SET state='unknown',error='Aus Sicherung übernommen. Versand im Postfach prüfen.' WHERE state='sending'")
        row = cx.execute("SELECT value FROM records WHERE key='control/message-delivery.json'").fetchone()
        if row:
            delivery = quarantine_delivery_state(json.loads(row[0]))
            cx.execute("UPDATE records SET value=?,updated_at=? WHERE key='control/message-delivery.json'", (json.dumps(delivery),time()))
        newest = cx.execute('SELECT coalesce(max(id),0) FROM events').fetchone()[0]
        cx.execute("UPDATE records SET value=?,updated_at=? WHERE key LIKE 'job/cursor/%'", (json.dumps(newest),time()))
        cx.execute("INSERT OR REPLACE INTO records VALUES('recovery/not-before',?,?)", (json.dumps(time()),time()))
        cx.execute('DELETE FROM sessions')
        cx.commit()


def quarantine_delivery_state(state):
    if state.get('version') != 1:
        raise ValueError('Unbekannte Nachrichtenablage.')
    for message in state['messages']:
        if message['status'] in {'waiting','dispatching'}:
            message.update(status='unknown', detail='Aus Sicherung übernommen. Keine automatische Wiederholung.', revision=message['revision']+1)
            message.pop('reviewedAt',None)
    for gate in state['gates'].values(): gate['blocked'] = True
    return state


def quarantine_deliveries(file):
    atomic_write(file,json.dumps(quarantine_delivery_state(json.loads(file.read_text()))))


def apply_pending(config):
    journal=config.data/'restore-journal.json'
    pending=config.data/'restore-pending.json'
    if not journal.exists() and not pending.exists():return
    owner=open(str(config.data/'agent.sqlite3')+'.lock','a+')
    fcntl.flock(owner,fcntl.LOCK_EX|fcntl.LOCK_NB)
    try:
        if journal.exists():
            recover(config,journal)
            return
        state=read_json(pending)
        base=Path(state['path']).resolve()
        if not base.is_relative_to((config.data/'restores').resolve()):
            raise ValueError('Wiederherstellung liegt außerhalb des geprüften Ordners.')
        manifest=verify_apply(base,config)
        id=uuid4().hex
        steps=[]
        sources=[(None,Path(str(config.data/'agent.sqlite3')+suffix)) for suffix in ('-wal','-shm')]
        sources += [(base/'database.sqlite3',config.data/'agent.sqlite3')]
        sources += [(None if name=='provider-vault' else base/name,target) for name,target in snapshot_paths(config) if manifest.get('schema',2)>=3 or name not in {'company','dictations'}]
        sources.append(('env',config.root/'.env'))
        if manifest.get('schema',2)>=3:
            sources.append((base/'host.json',config.data/'host.json'))
        for name in ADAPTER_FILES:
            source = base/'adapter-state'/name
            sources.append((source if manifest.get('schema',2)>=4 and source.is_file() else None,config.data/name))
        # The hold participates in the same rollback journal as the database.
        sources.append(('hold',config.data/'restore-hold.json'))
        record={'steps':steps,'snapshot':state['snapshot'],'created_at':time()}
        # Prepare every copy before modifying the live workspace or database.
        for source,target in sources:
            old=target.with_name('.agent-restore-'+id+'-'+target.name)
            prepared=target.with_name('.agent-restore-'+id+'-new-'+target.name) if source else None
            steps.append({'target':str(target),'old':str(old),'prepared':str(prepared) if prepared else None,'existed':target.exists(),'started':False})
            atomic_write(journal,json.dumps(record))
            if prepared:
                target.parent.mkdir(parents=True,exist_ok=True)
                if source == 'env':
                    from .env_secrets import EnvSecrets
                    EnvSecrets(config.root).check()
                    database=next(Path(s['prepared']) for s in steps if s['target']==str(config.data/'agent.sqlite3'))
                    atomic_write(prepared, restored_env(base,manifest,database,config))
                elif source == 'hold': atomic_write(prepared,json.dumps({'snapshot':state['snapshot'],'created_at':time()}))
                elif source.is_dir():shutil.copytree(source,prepared)
                elif source.is_file():shutil.copy2(source,prepared)
                else:prepared.mkdir()  # An absent old memory history must not leak into this snapshot.
                if isinstance(source,Path) and source.exists():
                    prefix=source.relative_to(base).as_posix()
                    expected={name:checksum for name,checksum in manifest['files'].items() if name==prefix or name.startswith(prefix+'/')}
                    actual={prefix:sha256(prepared)} if prepared.is_file() else {prefix+'/'+p.relative_to(prepared).as_posix():sha256(p) for p in prepared.rglob('*') if p.is_file()}
                    if actual!=expected:
                        raise ValueError('Wiederherstellungskopie hat sich während der Vorbereitung geändert.')
                if target==config.data/'agent.sqlite3': quarantine_database(prepared)
                if target==config.data/'message-delivery.json': quarantine_deliveries(prepared)
                sync_copy(prepared)
        for step in steps:
            step['started']=True
            atomic_write(journal,json.dumps(record))
            target,old=Path(step['target']),Path(step['old'])
            if target.exists():durable_replace(target,old)
            if step['prepared']:durable_replace(step['prepared'],target)
        record['committed']=True
        record['committed_at']=time()
        atomic_write(journal,json.dumps(record))
        receipt(config, record)
        pending.unlink(missing_ok=True)
        sync_directory(config.data)
        journal.unlink()
        sync_directory(config.data)
    except Exception:
        if journal.exists():recover(config,journal)
        elif pending.exists():
            durable_replace(pending,config.data/'restore-failed.json')
            atomic_write(config.data/'restore-last.json',json.dumps({'ok':False,'unchanged':True,'at':time()}))
        raise
    finally:
        owner.close()


def restored_env(base, manifest, database, config):
    from .env_secrets import EnvSecrets, parse, variable, PREFIX, ALIASES
    if manifest.get('schema',2)>=5:
        text=(base/'provider-vault/credentials.env').read_text()
        parse(text)
        return text
    # Convert old encrypted backups before swapping any live files. No native
    # keychain access is needed: the encrypted backup carries its recovery key.
    values={k:v for k,v in EnvSecrets(config.root).values().items() if not k.startswith(PREFIX) and k not in ALIASES.values()}
    from cryptography.fernet import Fernet
    with closing(sqlite3.connect(database)) as cx:
        rows=cx.execute("SELECT key,value FROM records WHERE key LIKE 'provider-vault/%'").fetchall()
        if rows:
            cipher=Fernet((base/'provider-vault/provider.key').read_bytes())
            for name,value in rows:
                key=variable(name.split('/',1)[1])
                values[key]=cipher.decrypt(json.loads(value).encode()).decode()
                cx.execute('UPDATE records SET value=? WHERE key=?',(json.dumps({'storage':'env','key':key}),name))
            cx.commit()
    return ''.join(k+'='+json.dumps(v,ensure_ascii=False)+'\n' for k,v in values.items())
