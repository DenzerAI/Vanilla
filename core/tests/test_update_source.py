import hashlib
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from core import update_source


def command(root,*args):
    return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.DEVNULL).decode().strip()


def commit(root,message):
    command(root,'add','.');command(root,'-c','core.hooksPath=/dev/null','commit','-qm',message)
    return command(root,'rev-parse','HEAD')


@pytest.fixture
def history(tmp_path,monkeypatch):
    public=tmp_path/'public';public.mkdir();command(public,'init','-q')
    command(public,'config','user.name','Synthetic Source');command(public,'config','user.email','source@example.invalid')
    (public/'core').mkdir();(public/'core/base.py').write_text('value = 1\n')
    base=commit(public,'Synthetic baseline')
    local=tmp_path/'local';subprocess.run(['git','clone','-q',str(public),str(local)],check=True)
    command(local,'config','user.name','Synthetic Source');command(local,'config','user.email','source@example.invalid')
    (local/'core/custom.py').write_text('own_module = True\n');commit(local,'Synthetic extension')
    actual_git=update_source.git
    def bounded_git(root,*args,**kwargs):
        if 'https://github.com/DenzerAI/Vanilla.git' in args:
            args=('-c','protocol.file.allow=always',*[str(public) if a=='https://github.com/DenzerAI/Vanilla.git' else a for a in args])
        return actual_git(root,*args,**kwargs)
    monkeypatch.setattr(update_source,'git',bounded_git)
    class Scanner:
        def __init__(self,*args,**kwargs):self.findings=[];self.policy={'reviewedBinaryAssets':{}};self.private_terms=set()
        def tree(self,*args):pass
        def policy_snapshot(self,*args):pass
    source=object.__new__(update_source.Source);source.root=local;source.config=SimpleNamespace(root=local)
    source.guard=SimpleNamespace(Scanner=Scanner);source.modules=SimpleNamespace(verify=lambda *a:[],tree=lambda *a:{})
    files={n:(local/n).read_bytes() for n in command(local,'ls-files').splitlines()}
    inventory={n:{'sha256':hashlib.sha256(b).hexdigest(),'mode':'100644'} for n,b in files.items()}
    snapshot={'head':command(local,'rev-parse','HEAD'),'files':files,'inventory':inventory,'hash':update_source.digest(inventory)}
    return public,local,base,source,snapshot


def test_three_way_update_retains_customer_module_without_touching_original(history,tmp_path):
    public,local,base,source,snapshot=history
    (public/'core/base.py').write_text('value = 2\n');target=commit(public,'Synthetic public change')
    candidate=tmp_path/'candidate';source.candidate(snapshot,target,candidate)
    assert (candidate/'core/base.py').read_text()=='value = 2\n'
    assert (candidate/'core/custom.py').read_text()=='own_module = True\n'
    assert (local/'core/base.py').read_text()=='value = 1\n'
    assert command(local,'rev-parse','HEAD')==snapshot['head']


def test_contribution_preserves_newer_origin_changes_and_conflicts_stop(history,tmp_path):
    public,local,base,source,snapshot=history
    incoming={'core/base.py':b'value = 2\n'}
    candidate=tmp_path/'contribution';source.contribution(snapshot,base,incoming,{'core/base.py':'100644'},candidate)
    assert (candidate/'core/custom.py').read_text()=='own_module = True\n'
    assert (candidate/'core/base.py').read_text()=='value = 2\n'
    snapshot['files']['core/base.py']=b'value = 3\n'
    with pytest.raises(ValueError,match='Klärung'):
        source.contribution(snapshot,base,incoming,{'core/base.py':'100644'},tmp_path/'conflict')
    assert (local/'core/base.py').read_text()=='value = 1\n'


def test_candidate_inspection_never_imports_incoming_python(tmp_path):
    trusted=Path(__file__).resolve().parents[2]
    (tmp_path/'scripts').mkdir();marker=tmp_path/'executed'
    for name in ['security-scan.py','verify-modules.py']:
        (tmp_path/'scripts'/name).write_text('raise RuntimeError("Incoming code was executed")\n')
    source=update_source.Source(SimpleNamespace(root=tmp_path),trusted_root=trusted)
    assert source.guard.ROOT==trusted
    assert not marker.exists()
