"""Apply staged restores offline; a durable journal rolls back interrupted swaps."""
import fcntl
import json
import os
import shutil
from pathlib import Path
from time import time
from uuid import uuid4

from .backups import verify_restore
from .files import atomic_write, read_json


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
    allowed = {config.workspace, config.data/'agent.sqlite3', config.data/'vault.git', config.data/'provider-vault', config.data/'codex/sessions', config.data/'codex/archived_sessions', *[Path(str(config.data/'agent.sqlite3')+s) for s in ('-wal','-shm')]}
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
        verify_restore(base)
        id=uuid4().hex
        steps=[]
        sources=[(None,Path(str(config.data/'agent.sqlite3')+suffix)) for suffix in ('-wal','-shm')]
        sources += [(base/'provider-vault',config.data/'provider-vault'),(base/'workspace',config.workspace),(base/'database.sqlite3',config.data/'agent.sqlite3'),(base/'vault.git',config.data/'vault.git'),(base/'worker-sessions',config.data/'codex/sessions'),(base/'archived-sessions',config.data/'codex/archived_sessions')]
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
