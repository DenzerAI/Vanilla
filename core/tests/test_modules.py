import copy
import importlib.util
import json
from pathlib import Path
from core.config import Config
from core.modules import Modules
from core.mcp import tools

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('module_gate',ROOT/'scripts/verify-modules.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def test_shipped_modules_and_fresh_worker_discovery():
    files = gate.tree(ROOT)
    assert gate.verify(files) == []
    modules = Modules(Config(root=ROOT,start_adapter=False))
    result=modules.find('Outlook')
    assert any(m['id']=='inbox' for m in result['modules'])
    setup=modules.read('inbox')
    assert any('OAuth' in doc['text'] for doc in setup['documents'])
    assert {'system_module','system_modules'} <= {t['name'] for t in tools()}
    assert len(tools()) == len({t['name'] for t in tools()})


def test_gate_rejects_new_router_route_file_and_missing_recipe():
    files=gate.tree(ROOT)
    files['core/mail.py'] += b'''
@router.get("/api/new-unregistered")
async def added(): pass
'''
    assert any('GET /api/new-unregistered' in e for e in gate.verify(files))
    files=gate.tree(ROOT);files['core/unregistered.py']=b'answer=42\n'
    assert any('core/unregistered.py' in e for e in gate.verify(files))
    files=gate.tree(ROOT);catalog=json.loads(files['system/modules.json']);del catalog['modules'][0]['setup']
    files['system/modules.json']=json.dumps(catalog).encode()
    assert any('setup fehlt' in e for e in gate.verify(files))


def test_gate_checks_document_updates_and_dependencies():
    before=gate.tree(ROOT);after=dict(before)
    after['core/mail.py'] += b'\n# Changed behavior\n'
    assert any('inbox: Quelländerung' in e for e in gate.verify(after,before))
    after['docs/MAIL.md'] += b'\nUpdated contract\n'
    assert not any('inbox: Quelländerung' in e for e in gate.verify(after,before))
    catalog=json.loads(after['system/modules.json'])
    next(module for module in catalog['modules'] if module['id']=='platform')['dependencies']=['inbox']
    after['system/modules.json']=json.dumps(catalog).encode()
    assert any('Zyklische' in e for e in gate.verify(after))


def test_index_gate_cannot_be_satisfied_by_an_unstaged_document(tmp_path):
    import subprocess
    def git(*args): return subprocess.check_output(['git',*args],cwd=tmp_path,text=True).strip()
    git('init','-q');git('config','user.name','Synthetic Test');git('config','user.email','test@example.invalid')
    for folder in ['core','docs','system','core/tests']:(tmp_path/folder).mkdir(exist_ok=True,parents=True)
    (tmp_path/'core/demo.py').write_text('@app.get("/api/status")\ndef status(): return {}\n')
    (tmp_path/'core/tests/test_demo.py').write_text('def test_demo(): pass\n')
    (tmp_path/'docs/demo.md').write_text('# Demo\n\n## setup\nUse local status.\n')
    module={'id':'demo','title':'Demo','purpose':'Test','version':1,'migration':'Additive','stage':'implemented','sources':['core/demo.py'],'verification':['core/tests/test_demo.py'],'data':'Local','contract':'docs/demo.md','setup':'docs/demo.md#setup','limits':'Synthetic','dependencies':[],'entrypoints':['GET /api/status'],'status':{'endpoint':'GET /api/status','meaning':'Actual local state'}}
    (tmp_path/'system/modules.json').write_text(json.dumps({'version':1,'modules':[module]}))
    git('add','.');git('commit','-qm','Synthetic baseline')
    before=gate.tree(tmp_path,'HEAD')
    (tmp_path/'core/demo.py').write_text('@app.get("/api/status")\ndef status(): return {"changed":True}\n')
    git('add','core/demo.py')
    (tmp_path/'docs/demo.md').write_text('# Demo\n\n## setup\nUpdated contract.\n')
    assert gate.verify(gate.tree(tmp_path),before)==[]
    assert any('ohne aktualisierten Vertrag' in e for e in gate.verify(gate.tree(tmp_path,git('write-tree')),before))
    git('add','docs/demo.md')
    assert gate.verify(gate.tree(tmp_path,git('write-tree')),before)==[]


def test_pure_interface_changes_need_no_new_module_version():
    before=gate.tree(ROOT);after=dict(before)
    after['wrapper/ui/app.jsx'] += b'\n// visual adjustment\n'
    assert not any('Quelländerung' in e for e in gate.verify(after,before))
    after['wrapper/server.mjs'] += b'\n// behaviour change\n'
    errors=[e for e in gate.verify(after,before) if 'Quelländerung' in e]
    assert errors and 'wrapper/server.mjs' in errors[0] and 'wrapper/ui/app.jsx' not in errors[0]
