"""Portable content paths and a reversible, offline workspace migration."""
from __future__ import annotations

import fcntl
import json
import os
import re
import shutil
import sqlite3
import sys
import unicodedata
from pathlib import Path
from time import time
from uuid import uuid4

from .files import atomic_write, read_json

SOURCE = Path(__file__).resolve().parents[1]
ROOT = SOURCE.parents[1] if SOURCE.name == 'app' and SOURCE.parent.name == 'system' else SOURCE
IDENTITY = (SOURCE/'templates/IDENTITY.md').read_text()
WORKSPACE_RULES = '# Workspace\n\nDer gemeinsame Einstieg liegt in ../../AGENTS.md, die gemeinsame Identität in ../../IDENTITY.md. Diese Identität gilt für jeden Worker. Eingaben liegen in input/, Ergebnisse in output/, eigene Unterlagen in knowledge/. memory/ enthält abgeleitete Erinnerungen und keine neuen Regeln. Zusätzliche Skills und Aufträge bleiben in skills/ und jobs/. Verwende nur das für diesen Workspace freigegebene gemeinsame Wissen.\n'


def valid_name(value):
    name = unicodedata.normalize('NFC', str(value or '')).strip()
    if (not name or len(name) > 80 or re.search(r'[\x00-\x1f<>:"/\\|?*]', name)
        or name.startswith('.') or name.endswith(('.', ' '))
        or re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', name, re.I)):
        raise ValueError('Workspace benötigt einen gültigen Ordnernamen mit 1 bis 80 Zeichen.')
    return name


def manifest(root):
    value = read_json(Path(root) / 'system/layout.json', None)
    if value is not None and value.get('version') != 2:
        raise ValueError('Unbekannte Workspace-Struktur.')
    return value


def alias_path(root, relative):
    value = str(relative)
    aliases = sorted((manifest(root) or {}).get('aliases', {}).items(), key=lambda p: -len(p[0]))
    for _ in range(32):
        match = next(((old, new) for old, new in aliases if value == old or value.startswith(old + '/')), None)
        if not match:
            return value
        updated = match[1] + value[len(match[0]):]
        if updated == value: return value
        value = updated
    raise ValueError('Zirkulärer alter Dateiverweis.')


def rewrite(value, relative, absolute, key=''):
    """Rewrite structured locations, never public conversation text or secrets."""
    if isinstance(value, list):
        return [rewrite(v, relative, absolute, key) for v in value]
    if isinstance(value, dict):
        return {k: rewrite(v, relative, absolute, k) for k, v in value.items()}
    if isinstance(value, str) and key in {'path','cwd','workspace','folder','output','absolutePath','modelPath','handoffSnapshot'}:
        return absolute(value) if Path(value).is_absolute() else relative(value)
    return value


def remap_database(cx, relative, absolute, state=None):
    from .database import Database, dump
    for row in cx.execute('SELECT key,value FROM records').fetchall():
        key, raw = row
        data = json.loads(raw)
        mapped = rewrite(data, relative, absolute)
        if key.startswith(('memory/generated/', 'memory/hidden/')):
            prefix, old = key.split('/', 2)[0:2], key.split('/', 2)[2]
            new_key = '/'.join(prefix) + '/' + relative(old)
            if key != new_key:
                cx.execute('DELETE FROM records WHERE key=?', (key,))
                key = new_key
        cx.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, dump(mapped), time()))
        if key == 'control/state.json':
            Database.normalize(None, cx, key, state or mapped)
            if state is not None:
                cx.execute('UPDATE records SET value=? WHERE key=?', (dump(state), key))
    for table in ['memory_sources', 'memory_changes']:
        for row in cx.execute(f'SELECT rowid,path FROM {table}').fetchall():
            cx.execute(f'UPDATE {table} SET path=? WHERE rowid=?', (relative(row[1]), row[0]))
    for row in cx.execute('SELECT id,sources FROM context_routes').fetchall():
        cx.execute('UPDATE context_routes SET sources=? WHERE id=?', (dump(rewrite(json.loads(row[1]), relative, absolute)), row[0]))
    # These are derived indexes. Preserve source and history tables, rebuild search.
    cx.execute('DELETE FROM document_fts')
    cx.execute('DELETE FROM vectors')
    cx.execute('DELETE FROM links')
    cx.execute('DELETE FROM documents')


def prepare_layout(config, *, company_base=None):
    """Called before the server starts. Never move files while a core owns the DB."""
    root = config.root
    current = manifest(root)
    if current:
        unfinished = root/'system/migrations/layout-v2/journal.json'
        pending = read_json(unfinished,None)
        if pending:
            if pending.get('manifest') != current: raise ValueError('Workspace-Umzug und Pfadzuordnung widersprechen sich.')
            pending['committed'] = True
            atomic_write(unfinished,json.dumps(pending,ensure_ascii=False))
            os.rename(unfinished,unfinished.with_name('completed.json'))
        config.layout = current
        config.workspace = root
        config.data = root / current['data']
        return
    old_workspace, old_data = config.workspace, config.data
    if not old_workspace.is_relative_to(root) or not old_data.is_relative_to(root):
        raise ValueError('Migration benötigt lokale Installationspfade.')
    old_data.mkdir(parents=True, exist_ok=True)
    owner = open(str(old_data/'agent.sqlite3') + '.lock', 'a+')
    try:
        fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        owner.close()
        raise ValueError('Workspace-Umzug wartet auf einen vollständig gestoppten Dienst.')
    directory = root / 'system/migrations/layout-v2'
    directory.mkdir(parents=True, exist_ok=True)
    journal = directory / 'journal.json'
    moves, created = [], []
    record = {'version':2, 'moves':moves, 'created':created, 'directories':[], 'edits':[], 'oldWorkspace':str(old_workspace), 'oldData':str(old_data)}
    database = old_data / 'agent.sqlite3'
    backup = directory / 'database.sqlite3'
    had_db = database.exists()
    if journal.exists():
        owner.close()
        raise ValueError('Ein unterbrochener Workspace-Umzug muss zuerst über layout rollback wiederhergestellt werden.')
    def save(): atomic_write(journal, json.dumps(record, ensure_ascii=False, indent=2))
    def mkdir(directory):
        if directory.exists(): return
        mkdir(directory.parent)
        record['directories'].append(str(directory.relative_to(root))); save()
        directory.mkdir()
    def move(source, target):
        if not source.exists(): return
        if source == target: return
        if source.is_symlink() or target.exists() or target.is_symlink():
            raise ValueError('Workspace-Umzug würde eine vorhandene Datei oder Verknüpfung ersetzen: ' + str(target.relative_to(root)))
        mkdir(target.parent)
        moves.append({'from':str(source.relative_to(root)), 'to':str(target.relative_to(root)), 'started':True})
        save()
        os.rename(source, target)
    def create(file, text):
        if file.exists(): return
        mkdir(file.parent)
        created.append(str(file.relative_to(root))); save()
        atomic_write(file, text)
    try:
        if had_db:
            with sqlite3.connect(database) as cx, sqlite3.connect(backup) as out:
                cx.backup(out)
                row = cx.execute("SELECT value FROM records WHERE key='control/state.json'").fetchone()
                state = json.loads(row[0]) if row else None
                cx.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        else:
            state = None
        state = state or read_json(old_data/'state.json', None) or {'chats':[], 'connections':[], 'secrets':[], 'settings':{'name':'Agent','workspaceName':'Allgemein'}}
        projects = state.get('projects') or [{'id':'default','name':state['settings'].get('workspaceName') or 'Allgemein','path':''}]
        names, mapping = set(), {}
        old_prefix = old_workspace.relative_to(root).as_posix()
        aliases = {}
        for p in projects:
            name = valid_name(p['name'])
            if name.casefold() in names:
                raise ValueError('Workspace-Namen müssen auch ohne Groß-/Kleinschreibung eindeutig sein: ' + name)
            names.add(name.casefold())
            previous = p.get('path','')
            target = 'workspaces/' + name
            if (root/target).exists() and (root/target) != old_workspace/previous:
                raise ValueError('Zielordner existiert bereits: ' + target)
            mapping[previous] = target
            aliases[(Path(old_prefix)/previous).as_posix()] = target
            p.update(path=target, name=name, knowledge=p.get('knowledge',['company']))
        state['projects'] = projects
        # Specific child workspaces must move before their old parent.
        save()
        for old, new in sorted(mapping.items(), key=lambda item: -len(item[0])):
            if old:
                move(old_workspace/old, root/new)
        default = next((p for p in projects if p['id']=='default'), projects[0])
        identity = old_workspace/'soul/IDENTITY.md'
        move(identity, root/'IDENTITY.md')
        aliases[old_prefix+'/soul/IDENTITY.md'] = 'IDENTITY.md'
        if (old_workspace/'soul').is_dir() and not any((old_workspace/'soul').iterdir()):
            (old_workspace/'soul').rmdir()
        if (old_workspace/'projects').is_dir() and not any((old_workspace/'projects').iterdir()):
            (old_workspace/'projects').rmdir()
        move(old_workspace, root/default['path'])
        create(root/'IDENTITY.md', IDENTITY)
        configured_company = company_base or os.environ.get('COMPANY_BASE')
        old_company = Path(configured_company or root/'firmenbasis')
        if old_company.exists():
            if not old_company.resolve().is_relative_to(root):
                raise ValueError('Konfigurierte Firmenbasis liegt außerhalb der Installation.')
            move(old_company, root/'knowledge/company')
            aliases[old_company.relative_to(root).as_posix()] = 'knowledge/company'
        elif configured_company:
            raise ValueError('Die konfigurierte Firmenbasis fehlt.')
        else:
            for source in (config.source/'templates/firmenbasis').rglob('*'):
                if source.is_file(): create(root/'knowledge/company'/source.relative_to(config.source/'templates/firmenbasis'), source.read_text())
        create(root/'knowledge/personal/README.md', (SOURCE/'templates/personal/README.md').read_text())
        chat_paths = {}
        for chat in state.get('chats',[]):
            p = next((p for p in projects if p['id']==chat.get('projectId','default')), default)
            relative_chat = 'chats/'+chat['id']
            if p != default:
                move(root/default['path']/relative_chat, root/p['path']/relative_chat)
            chat_paths[relative_chat] = p['path']+'/'+relative_chat
            aliases[old_prefix+'/'+relative_chat] = chat_paths[relative_chat]
            aliases[relative_chat] = chat_paths[relative_chat]
        content_paths = {}
        for p in projects:
            base = root/p['path']
            mkdir(base)
            previous = next(old for old,new in mapping.items() if new == p['path'])
            for old_folder,new_folder in [('brain','memory'),('notes','knowledge')]:
                move(base/old_folder,base/new_folder)
                old_path = (Path(previous)/old_folder).as_posix()
                content_paths[old_path] = p['path']+'/'+new_folder
                aliases[p['path']+'/'+old_folder] = p['path']+'/'+new_folder
            if previous: aliases[previous] = p['path']
            for name in ['input','output','knowledge','memory','skills','jobs','chats']:
                mkdir(base/name)
            create(base/'AGENTS.md', WORKSPACE_RULES)
            move(base/'project.json',base/'workspace.json')
            aliases[p['path']+'/project.json'] = p['path']+'/workspace.json'
            create(base/'workspace.json', json.dumps(p, ensure_ascii=False, indent=2))
            metadata = base/'workspace.json'
            before = metadata.read_text()
            after = json.dumps({**json.loads(before),**p},ensure_ascii=False,indent=2)
            if before != after:
                record['edits'].append({'path':str(metadata.relative_to(root)),'before':before}); save()
                atomic_write(metadata,after)
            for file in [base/'AGENTS.md',*base.glob('jobs/*/AGENTS.md')]:
                before = file.read_text()
                identity_reference = Path(os.path.relpath(root/'IDENTITY.md',file.parent)).as_posix()
                after = re.sub(r'(?<![\w/])(?:\.\./)*soul/IDENTITY\.md',identity_reference,before)
                after = after.replace('brain/','memory/').replace('notes/','knowledge/')
                after = after.replace('../../wrapper/','../../system/app/wrapper/')
                if before != after:
                    record['edits'].append({'path':str(file.relative_to(root)),'before':before}); save()
                    atomic_write(file,after)
        for name in ['input','output','jobs','chats','skills','brain','notes']:
            aliases[name] = default['path']+'/'+{'brain':'memory','notes':'knowledge'}.get(name,name)
        for name in ['backend','core','wrapper','frontend','docs','scripts','templates','test','examples']:
            aliases[name] = 'system/app/'+name
        aliases.setdefault('data','system/data')
        aliases[old_data.relative_to(root).as_posix()] = 'system/data/control'
        def relative(value):
            for old,new in sorted({**chat_paths,**content_paths}.items(), key=lambda item:-len(item[0])):
                if value == old or value.startswith(old+'/'): return new+value[len(old):]
            for old, new in sorted(mapping.items(), key=lambda item:-len(item[0])):
                if old and (value == old or value.startswith(old+'/')):
                    return new + value[len(old):]
            return default['path'] + ('/' + value if value else '')
        def absolute(value):
            try: return str(root/relative(Path(value).relative_to(old_workspace).as_posix()))
            except ValueError:
                for old,new in sorted(aliases.items(),key=lambda item:-len(item[0])):
                    prefix = str(root/old)
                    if value == prefix or value.startswith(prefix+os.sep): return str(root/new)+value[len(prefix):]
                return value
        migrated_state = rewrite(state, relative, absolute)
        migrated_state['projects'] = projects
        for chat in migrated_state.get('chats',[]):
            p = next((p for p in projects if p['id']==chat.get('projectId','default')), default)
            chat['cwd'] = str(root/p['path']) if not chat.get('jobId') else str(root/p['path']/'jobs'/chat['jobId'])
        # Chats may remain in Allgemein: stable IDs preserve all historical exports.
        data = root/'system/data/control'
        if old_data != data: move(old_data, data)
        for name in ['orders','runs','people','messages','artifacts','whatsapp-auth']:
            move(root/'data'/name,root/'system/data/order'/name)
            aliases['data/'+name] = 'system/data/order/'+name
        move(root/'brain',root/'system/data/order/brain')
        if had_db:
            with sqlite3.connect(data/'agent.sqlite3') as cx:
                cx.execute('PRAGMA foreign_keys=ON')
                remap_database(cx, relative, absolute, migrated_state)
        elif (data/'state.json').exists():
            shutil.copy2(data/'state.json', directory/'state.json')
            record['stateBackup'] = str((directory/'state.json').relative_to(root)); save()
            atomic_write(data/'state.json', json.dumps(migrated_state, ensure_ascii=False))
        else:
            create(data/'state.json', json.dumps(migrated_state, ensure_ascii=False))
        record['manifest'] = {'version':2, 'data':'system/data/control', 'defaultWorkspace':default['id'], 'aliases':aliases, 'legacyWorkspace':old_prefix, 'legacyPaths':mapping}
        create(root/'system/layout.json', json.dumps(record['manifest'], ensure_ascii=False, indent=2))
        record['committed'] = True; save()
        os.rename(journal, directory/'completed.json')
        config.layout = record['manifest']; config.workspace = root; config.data = data
        if config.embedding_model: config.embedding_model = absolute(config.embedding_model)
    except BaseException:
        rollback_layout(root, record, backup if had_db else None)
        if journal.exists(): os.rename(journal, directory/'failed.json')
        raise
    finally:
        owner.close()


def rollback_layout(root, record, backup=None):
    for edit in reversed(record.get('edits',[])):
        file = root/edit['path']
        if file.exists(): atomic_write(file,edit['before'])
    for relative in reversed(record.get('created', [])):
        file = root/relative
        if file.is_file(): file.unlink()
    def remove_empty():
        for relative in reversed(record.get('directories', [])):
            directory = root/relative
            if directory.is_dir() and not directory.is_symlink() and not any(directory.iterdir()): directory.rmdir()
    remove_empty()
    for step in reversed(record['moves']):
        source, target = root/step['from'], root/step['to']
        if target.exists() and not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            os.rename(target, source)
    remove_empty()
    if record.get('stateBackup'):
        shutil.copy2(root/record['stateBackup'],Path(record['oldData'])/'state.json')
    if backup and backup.exists():
        database = Path(record['oldData'])/'agent.sqlite3'
        for suffix in ['-wal','-shm']: Path(str(database)+suffix).unlink(missing_ok=True)
        shutil.copy2(backup, database)


def rename_workspace(db, config, id, name):
    if not config.layout:
        raise ValueError('Die Workspace-Migration ist noch nicht abgeschlossen.')
    name = valid_name(name)
    state = db.get('control/state.json')['value']
    project = next((p for p in state['projects'] if p['id'] == id), None)
    if not project:
        raise ValueError('Workspace nicht gefunden.')
    if any(p['id'] != id and p['name'].casefold() == name.casefold() for p in state['projects']):
        raise ValueError('Ein Workspace mit diesem Namen existiert bereits.')
    old = project['path']; new = 'workspaces/' + name
    if old == new: return {'state':state}
    source, target = config.root/old, config.root/new
    if source.is_symlink() or not source.is_dir() or (target.exists() and not os.path.samefile(source,target)):
        raise ValueError('Der Workspace-Zielordner ist bereits belegt oder nicht sicher erreichbar.')
    directory = config.data/'workspace-renames'/uuid4().hex
    directory.mkdir(parents=True)
    backup = directory/'database.sqlite3'
    db.backup(backup)
    current = manifest(config.root)
    original_metadata = (source/'workspace.json').read_text()
    journal = config.data/'workspace-rename.json'
    temporary = source.with_name('.workspace-rename-'+uuid4().hex)
    record = {'old':old,'new':new,'temporary':str(temporary.relative_to(config.root)),'backup':str(backup.relative_to(config.data)),'manifest':current,'metadata':original_metadata}
    atomic_write(journal,json.dumps(record,ensure_ascii=False))
    def relative(value):
        return new+value[len(old):] if value == old or value.startswith(old+'/') else value
    def absolute(value):
        prefix = str(config.root/old)
        return str(config.root/new)+value[len(prefix):] if value == prefix or value.startswith(prefix+os.sep) else value
    try:
        os.rename(source,temporary); os.rename(temporary,target)
        state = rewrite(state,relative,absolute)
        project = next(p for p in state['projects'] if p['id']==id)
        project.update(name=name,path=new)
        if id == 'default': state['settings']['workspaceName'] = name
        aliases = {k:relative(v) for k,v in current.get('aliases',{}).items() if k != new}
        aliases[old] = new
        updated = {**current,'aliases':aliases,'legacyPaths':{k:relative(v) for k,v in current.get('legacyPaths',{}).items()}}
        atomic_write(target/'workspace.json',json.dumps(project,ensure_ascii=False,indent=2))
        atomic_write(config.root/'system/layout.json',json.dumps(updated,ensure_ascii=False,indent=2))
        with db.transaction() as cx:
            remap_database(cx,relative,absolute,state)
        record['committed'] = True
        atomic_write(journal,json.dumps(record,ensure_ascii=False))
        os.rename(journal,directory/'completed.json')
        config.layout = updated
        return {'state':state}
    except BaseException:
        if temporary.exists(): os.rename(temporary,source)
        elif target.exists() and not source.exists(): os.rename(target,source)
        atomic_write(source/'workspace.json',original_metadata)
        atomic_write(config.root/'system/layout.json',json.dumps(current,ensure_ascii=False))
        with sqlite3.connect(backup) as saved:
            saved.backup(db.connection)
        # SQLite transaction rolls back on failure. The durable backup covers a crash.
        if journal.exists(): os.rename(journal,directory/'failed.json')
        raise


def recover_rename(config):
    journal = config.data/'workspace-rename.json'
    record = read_json(journal,None)
    if not record: return
    if record.get('committed'):
        os.rename(journal,journal.with_suffix('.completed.json')); return
    owner = open(str(config.data/'agent.sqlite3')+'.lock','a+')
    try:
        fcntl.flock(owner,fcntl.LOCK_EX|fcntl.LOCK_NB)
        paths = [config.root/record[k] for k in ['old','new','temporary']]
        if any(not p.resolve().is_relative_to(config.root/'workspaces') for p in paths):
            raise ValueError('Ungültiges Workspace-Umbenennungsjournal.')
        old,new,temporary = paths
        if temporary.exists() and not old.exists(): os.rename(temporary,old)
        elif new.exists() and not old.exists(): os.rename(new,old)
        backup = config.data/record['backup']
        if not backup.resolve().is_relative_to(config.data/'workspace-renames'):
            raise ValueError('Ungültige Workspace-Sicherung.')
        for suffix in ['-wal','-shm']: Path(str(config.data/'agent.sqlite3')+suffix).unlink(missing_ok=True)
        shutil.copy2(backup,config.data/'agent.sqlite3')
        atomic_write(old/'workspace.json',record['metadata'])
        atomic_write(config.root/'system/layout.json',json.dumps(record['manifest'],ensure_ascii=False))
        os.rename(journal,journal.with_suffix('.recovered.json'))
    finally:
        owner.close()


def relocate_dependencies(config):
    owner = open(str(config.data/'agent.sqlite3')+'.lock','a+')
    try:
        fcntl.flock(owner,fcntl.LOCK_EX|fcntl.LOCK_NB)
        _relocate_dependencies(config)
    finally: owner.close()


def _relocate_dependencies(config):
    """Finish a source upgrade offline, then re-exec a moved Python environment."""
    if config.source == config.root: return
    moved_python = False
    for old,new in [('.venv','.venv'),('node_modules','node_modules'),('wrapper/node_modules','wrapper/node_modules'),('.cache','.cache')]:
        source, target = config.root/old, config.source/new
        if not source.exists() or source.is_symlink(): continue
        if target.exists():
            target = config.root/'system/migrations/previous-dependencies'/old
            if target.exists(): continue
        target.parent.mkdir(parents=True,exist_ok=True)
        os.rename(source,target)
        if old == '.venv' and str(sys.executable).startswith(str(source)+os.sep):
            moved_python = True
    previous_data=config.root/'data'
    if previous_data.is_dir() and not previous_data.is_symlink():
        for file in previous_data.iterdir():
            target=config.root/'system/data'/file.name
            if target.exists(): raise ValueError('Ein bisheriger Datenordner benötigt eine eindeutige Zielzuordnung.')
            target.parent.mkdir(parents=True,exist_ok=True)
            os.rename(file,target)
    for old in ['wrapper','backend','frontend','core','scripts','docs','templates','test','examples','jobs','data']:
        directory = config.root/old
        if not directory.is_dir() or directory.is_symlink(): continue
        if not any(directory.iterdir()): directory.rmdir(); continue
        target = config.root/'system/migrations/previous-files'/old
        if target.exists(): continue
        target.parent.mkdir(parents=True,exist_ok=True)
        os.rename(directory,target)
    artifact = config.root/':memory:.ses'
    if artifact.is_file():
        target = config.root/'system/migrations/previous-files/:memory:.ses'
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists(): os.rename(artifact,target)
    # Activation/console scripts are the only venv files with executable paths.
    for runtime,old_runtime in [(config.source/'.venv',config.root/'.venv'),(config.data/'dictation-runtime',config.root/'data/control/dictation-runtime')]:
        if not (runtime/'bin').is_dir(): continue
        for file in (runtime/'bin').iterdir():
            if file.is_symlink() or not file.is_file() or file.stat().st_size > 1_000_000: continue
            try: text = file.read_text()
            except UnicodeError: continue
            updated = text.replace(str(old_runtime),str(runtime))
            if updated != text: file.write_text(updated)
    for file in (config.source/'.venv').glob('lib/python*/site-packages/__editable__*'):
        if file.is_file() and not file.is_symlink():
            text=file.read_text();updated=text.replace(str(config.root)+'/core',str(config.source)+'/core')
            for quote in ["'",'"']:
                updated=updated.replace(quote+str(config.root)+quote,quote+str(config.source)+quote)
            if updated.strip() == str(config.root): updated=str(config.source)+'\n'
            if updated != text: file.write_text(updated)
    if moved_python:
        python = str(config.source/'.venv/bin/python')
        os.environ['AGENT_PYTHON'] = python
        os.execv(python,[python,'-m','core'])


def main():
    import argparse
    from .config import Config
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['migrate','rollback'])
    args = parser.parse_args()
    config = Config.environment()
    if args.action == 'migrate': prepare_layout(config); return
    journal = config.root/'system/migrations/layout-v2/journal.json'
    record = read_json(journal,None)
    if not record: raise ValueError('Kein unterbrochener Workspace-Umzug vorhanden.')
    old_data = Path(record['oldData'])
    moved = next((config.root/s['to'] for s in record['moves'] if config.root/s['from'] == old_data),old_data)
    data = moved if moved.exists() else old_data
    owner = open(str(data/'agent.sqlite3')+'.lock','a+')
    try:
        fcntl.flock(owner,fcntl.LOCK_EX|fcntl.LOCK_NB)
        rollback_layout(config.root,record,journal.parent/'database.sqlite3')
        os.rename(journal,journal.with_suffix('.recovered.json'))
    finally: owner.close()


if __name__ == '__main__': main()
