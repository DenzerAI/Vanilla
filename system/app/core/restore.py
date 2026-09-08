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

from .backups import verify_restore
from .files import atomic_write, read_json


def migrate_legacy_restore(base, config):
    """Convert a verified old snapshot in isolation; the original stays intact."""
    from .config import Config
    from .layout import prepare_layout, remap_database, alias_path
    from .backups import copy_stable
    from .files import sha256
    destination = base.parent/('layout-v2-'+uuid4().hex)
    installation = destination/'conversion'
    installation.mkdir(parents=True)
    workspace = installation/'workspaces/default'
    copy_stable(base/'workspace',workspace)
    data = installation/'data/control'
    data.mkdir(parents=True)
    shutil.copy2(base/'database.sqlite3',data/'agent.sqlite3')
    # V1 never included shared knowledge. Preserve the current shared sources.
    company = installation/'firmenbasis'
    copy_stable(config.root/'knowledge/company',company)
    copy_stable(config.root/'knowledge/personal',installation/'knowledge/personal')
    migrated = Config(root=installation,workspace=workspace,data=data,start_adapter=False)
    prepare_layout(migrated,company_base=company)
    def absolute(value):
        for prefix in [str(installation),str(config.root)]:
            if value.startswith(prefix+os.sep):
                return str(config.root/alias_path(installation,value[len(prefix)+1:]))
        return value
    with sqlite3.connect(migrated.data/'agent.sqlite3') as cx:
        remap_database(cx,lambda value:value,absolute)
    result = destination/'snapshot'
    result.mkdir()
    for name in ['workspaces','knowledge','IDENTITY.md','system/layout.json']:
        source=installation/name;target=result/'workspace'/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copytree(source,target) if source.is_dir() else shutil.copy2(source,target)
    with closing(sqlite3.connect(migrated.data/'agent.sqlite3')) as source, closing(sqlite3.connect(result/'database.sqlite3')) as target:
        source.backup(target)
        target.execute('PRAGMA journal_mode=DELETE')
    for name in ['vault.git','worker-sessions','archived-sessions']:
        if (base/name).exists():shutil.copytree(base/name,result/name)
    files={p.relative_to(result).as_posix():sha256(p) for p in result.rglob('*') if p.is_file()}
    atomic_write(result/'manifest.json',json.dumps({'format':'agent-backup-v2','installation':str(config.root),'files':files,'convertedFrom':'agent-backup-v1'}))
    verify_restore(result)
    return result


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
        (config.data / 'restore-pending.json').unlink(missing_ok=True)
        journal.unlink()
        return
    content = {config.root/name for name in ['workspaces','knowledge','IDENTITY.md','system/layout.json']} if config.layout else {config.workspace}
    allowed = {*content, config.data/'agent.sqlite3', config.data/'vault.git', config.data/'codex/sessions', config.data/'codex/archived_sessions', *[Path(str(config.data/'agent.sqlite3')+s) for s in ('-wal','-shm')]}
    for step in reversed(state['steps']):
        target, old, prepared = (Path(step[k]) if step.get(k) else None for k in ('target','old','prepared'))
        if target not in allowed or old.parent != target.parent or not old.name.startswith('.agent-restore-'):
            raise ValueError('Ungültiges Wiederherstellungsjournal.')
        if old.exists():
            remove(target)
            os.replace(old,target)
        elif not step['existed'] and step.get('started'):
            remove(target)
        if prepared and prepared.parent == target.parent and prepared.name.startswith('.agent-restore-'):
            remove(prepared)
    journal.unlink()
    # Do not automatically repeat the failed replacement on every service restart.
    pending=config.data/'restore-pending.json'
    if pending.exists(): os.replace(pending,config.data/'restore-failed.json')
    atomic_write(config.data/'restore-last.json',json.dumps({'ok':False,'rolled_back':True,'at':time()}))


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
        saved = verify_restore(base)
        if config.layout and saved['format'] == 'agent-backup-v1':
            base = migrate_legacy_restore(base,config)
            saved = verify_restore(base)
        if bool(config.layout) != (saved['format'] == 'agent-backup-v2'):
            raise ValueError('Eine Workspace-Sicherung benötigt die aktuelle Vanilla-Version.')
        id=uuid4().hex
        steps=[]
        sources=[(None,Path(str(config.data/'agent.sqlite3')+suffix)) for suffix in ('-wal','-shm')]
        sources += [(base/'workspace'/name,config.root/name) for name in ['workspaces','knowledge','IDENTITY.md','system/layout.json']] if config.layout else [(base/'workspace',config.workspace)]
        sources += [(base/'database.sqlite3',config.data/'agent.sqlite3'),(base/'vault.git',config.data/'vault.git'),(base/'worker-sessions',config.data/'codex/sessions'),(base/'archived-sessions',config.data/'codex/archived_sessions')]
        record={'steps':steps,'snapshot':state['snapshot'],'created_at':time()}
        # Prepare every copy before modifying the live workspace or database.
        for source,target in sources:
            old=target.with_name('.agent-restore-'+id+'-'+target.name)
            prepared=target.with_name('.agent-restore-'+id+'-new-'+target.name) if source else None
            steps.append({'target':str(target),'old':str(old),'prepared':str(prepared) if prepared else None,'existed':target.exists(),'started':False})
            atomic_write(journal,json.dumps(record))
            if prepared:
                target.parent.mkdir(parents=True,exist_ok=True)
                if source.is_dir():shutil.copytree(source,prepared)
                elif source.is_file():shutil.copy2(source,prepared)
                else:prepared.mkdir()  # An absent old memory history must not leak into this snapshot.
                if target == config.data/'agent.sqlite3' and saved.get('installation') and saved['installation'] != str(config.root):
                    from .layout import remap_database
                    previous = saved['installation']
                    def absolute(value):
                        return str(config.root)+value[len(previous):] if value.startswith(previous+os.sep) else value
                    with sqlite3.connect(prepared) as cx:
                        remap_database(cx,lambda value:value,absolute)
        for step in steps:
            step['started']=True
            atomic_write(journal,json.dumps(record))
            target,old=Path(step['target']),Path(step['old'])
            if target.exists():os.replace(target,old)
            if step['prepared']:os.replace(step['prepared'],target)
        record['committed']=True
        atomic_write(journal,json.dumps(record))
        atomic_write(config.data/'restore-last.json',json.dumps({'ok':True,'snapshot':state['snapshot'],'safety':[s['old'] for s in steps if s['existed']],'restored_at':time()}))
        pending.unlink(missing_ok=True)
        journal.unlink()
    except Exception:
        if journal.exists():recover(config,journal)
        raise
    finally:
        owner.close()
