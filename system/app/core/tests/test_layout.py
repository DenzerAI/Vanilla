import json
from pathlib import Path

import pytest

from core.config import Config
from core.database import Database
from core.layout import SOURCE, prepare_layout, rename_workspace, valid_name
from core.knowledge import Knowledge
from core.storage import Storage, safe_path


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    for key in ['COMPANY_BASE','SYSTEM_BASE','UWE_WORKSPACE','UWE_DATA_ROOT','VANILLA_ROOT','VANILLA_LAYOUT']:
        monkeypatch.delenv(key,raising=False)


def old_installation(tmp_path):
    import shutil
    root = tmp_path/'installation'
    root.mkdir()
    shutil.copytree(SOURCE/'templates',root/'templates')
    config = Config(root=root,start_adapter=False)
    workspace = config.workspace
    for folder in ['soul','input','output','brain','jobs','chats/chat-a','projects/project-b/input']:
        (workspace/folder).mkdir(parents=True,exist_ok=True)
    (workspace/'soul/IDENTITY.md').write_text('# Identität\nAnzeigename: Muster\n')
    (workspace/'input/Angebot.txt').write_text('Unveränderte Eingabe')
    (workspace/'projects/project-b/input/Plan.md').write_text('Vorhandener Projektplan')
    thread = {'id':'chat-a','cwd':str(workspace/'projects/project-b'),'turns':[]}
    (workspace/'chats/chat-a/transcript.json').write_text(json.dumps(thread))
    db = Database(config.data/'agent.sqlite3')
    state = {'settings':{'name':'Muster','workspaceName':'Allgemein'},'connections':[],'secrets':[],
      'projects':[{'id':'default','name':'Allgemein','path':''},{'id':'project-b','name':'Website überarbeiten','path':'projects/project-b'}],
      'chats':[{'id':'chat-a','projectId':'project-b','cwd':str(workspace/'projects/project-b'),'title':'Plan'}]}
    db.put('control/state.json',state)
    db.put('workspace/chats/chat-a/transcript.json',thread)
    db.put('control/library.json',{'entries':{'stable-favorite':{'id':'stable-favorite','path':'projects/project-b/input/Plan.md','favorite':True}}})
    db.close()
    return config


def test_migration_preserves_names_identity_chats_and_old_links(tmp_path):
    config = old_installation(tmp_path)
    prepare_layout(config)
    root = config.root
    assert (root/'IDENTITY.md').read_text().endswith('Anzeigename: Muster\n')
    assert (root/'workspaces/Website überarbeiten/input/Plan.md').read_text() == 'Vorhandener Projektplan'
    assert (root/'workspaces/Website überarbeiten/chats/chat-a/transcript.json').is_file()
    assert safe_path(root,'workspaces/default/projects/project-b/input/Plan.md') == root/'workspaces/Website überarbeiten/input/Plan.md'
    assert safe_path(root,'workspaces/default/input/Angebot.txt').read_text() == 'Unveränderte Eingabe'
    assert not (root/'workspaces/default').exists()
    db = Database(config.data/'agent.sqlite3')
    state = db.get('control/state.json')['value']
    assert state['chats'][0]['id'] == 'chat-a'
    assert state['projects'][1]['path'] == 'workspaces/Website überarbeiten'
    assert db.get('control/library.json')['value']['entries']['stable-favorite']['favorite']
    assert db.get('workspace/chats/chat-a/transcript.json')['value']['cwd'] == str(root/'workspaces/Website überarbeiten')
    db.close()
    prepare_layout(config)
    assert (root/'system/migrations/layout-v2/completed.json').is_file()


def test_workspace_rename_preserves_ids_history_and_source_scope(tmp_path):
    config = old_installation(tmp_path)
    prepare_layout(config)
    db = Database(config.data/'agent.sqlite3')
    result = rename_workspace(db,config,'project-b','Kundenportal')
    assert result['state']['projects'][1]['id'] == 'project-b'
    assert result['state']['projects'][1]['path'] == 'workspaces/Kundenportal'
    assert safe_path(config.root,'workspaces/default/projects/project-b/input/Plan.md').is_file()
    knowledge = Knowledge(db,config)
    (config.root/'knowledge/company/Produkt.md').write_text('Sachliche Produktangaben')
    (config.root/'knowledge/personal/Privat.md').write_text('Persönlicher Eintrag')
    knowledge.scan()
    results = knowledge.search('', 'project-b')
    assert any(r['path'].startswith('knowledge/company/') for r in results)
    assert not any(r['path'].startswith('knowledge/personal/') for r in results)
    with pytest.raises(ValueError): rename_workspace(db,config,'project-b','allgemein')
    db.close()


def test_migration_rejects_live_owner_and_duplicate_name_without_moving_files(tmp_path):
    config = old_installation(tmp_path)
    db = Database(config.data/'agent.sqlite3')
    with pytest.raises(ValueError,match='gestoppten'): prepare_layout(config)
    state = db.get('control/state.json')['value']
    state['projects'][1]['name'] = 'Allgemein'
    db.put('control/state.json',state); db.close()
    with pytest.raises(ValueError,match='eindeutig'): prepare_layout(config)
    assert (config.workspace/'soul/IDENTITY.md').is_file()
    assert (config.workspace/'projects/project-b/input/Plan.md').is_file()


@pytest.mark.parametrize('value',['../Other','A/B','NUL','CON.txt','A:B','.hidden'])
def test_names_cannot_escape_or_hide_workspaces(value):
    with pytest.raises(ValueError): valid_name(value)


def test_failed_migration_restores_files_and_retries(tmp_path, monkeypatch):
    import core.layout as layout
    config = old_installation(tmp_path)
    before = {p.relative_to(config.workspace):p.read_bytes() for p in config.workspace.rglob('*') if p.is_file()}
    original = layout.remap_database
    def fail(*args, **kwargs): raise RuntimeError('Interrupted fixture')
    monkeypatch.setattr(layout,'remap_database',fail)
    with pytest.raises(RuntimeError,match='Interrupted'): prepare_layout(config)
    assert {p.relative_to(config.workspace):p.read_bytes() for p in config.workspace.rglob('*') if p.is_file()} == before
    assert not (config.root/'workspaces/Website überarbeiten').exists()
    monkeypatch.setattr(layout,'remap_database',original)
    prepare_layout(config)
    assert (config.root/'workspaces/Website überarbeiten/input/Plan.md').is_file()


def test_layout_resolves_previous_configuration_and_rejects_wrong_roots(tmp_path):
    config = old_installation(tmp_path)
    old_workspace,old_data = config.workspace,config.data
    prepare_layout(config)
    loaded = Config(root=config.root,workspace=old_workspace,data=old_data)
    assert loaded.workspace == config.root
    assert loaded.data == config.data
    with pytest.raises(ValueError,match='UWE_WORKSPACE'):
        Config(root=config.root,workspace='workspaces/Missing')
    with pytest.raises(ValueError,match='UWE_DATA_ROOT'):
        Config(root=config.root,data='data/other')
