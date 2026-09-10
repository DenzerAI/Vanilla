import asyncio
import base64
import hashlib
import json
from types import SimpleNamespace

import pytest
from core.config import Config
from core.database import Database
from core.contributions import Contributions
from core.github import GitHubError
from core import contributions as module


@pytest.fixture
def exchange(tmp_path,monkeypatch):
    config=Config(root=tmp_path,start_adapter=False);db=Database(config.data/'agent.sqlite3')
    repo={'id':12,'name':'example/private-code','private':True,'write':True}
    db.put('contributions/settings',{'revision':1,'role':'customer','agreement':{'repositoryId':12,'accountId':3}})
    raw=b'own_module = True\n';source_hash='a'*64;base='b'*40;remote_commit='c'*40
    snapshot={'head':'d'*40,'hash':source_hash,'files':{'core/module.py':raw},'inventory':{'core/module.py':{'mode':'100644'}}}
    fake_source=SimpleNamespace(read=lambda:snapshot,public_base=lambda *args:base)
    monkeypatch.setattr(module,'Source',lambda config:fake_source)
    calls=[];remote={'ref':None,'loseReply':False}
    class Github:
        oauth_lock=asyncio.Lock()
        def settings(self):return {'account':{'id':3}}
        async def check(self,**kwargs):return repo
        async def request(self,method,path,**kwargs):
            calls.append((method,path,kwargs))
            if '/collaborators/' in path:return {'permission':'read'}
            if path.endswith('/commits/main'):return {'sha':base}
            if '/git/commits/' in path:return {'sha':base}
            if '/git/trees/' in path:return {'tree':[]}
            if '/git/ref/' in path:return {'object':{'sha':remote['ref']}} if remote['ref'] else None
            if path.endswith('/git/blobs'):
                value=base64.b64decode(kwargs['body']['content'])
                return {'sha':hashlib.sha1(b'blob '+str(len(value)).encode()+b'\0'+value).hexdigest()}
            if path.endswith('/git/trees'):return {'sha':'e'*40}
            if path.endswith('/git/commits'):return {'sha':remote_commit}
            if path.endswith('/git/refs'):
                remote['ref']=remote_commit
                if remote['loseReply']:raise GitHubError('Synthetic connection interruption')
                return {'object':{'sha':remote_commit}}
            raise AssertionError(path)
    service=Contributions(db,config,Github())
    yield service,db,calls,remote,fake_source
    db.close()


@pytest.mark.asyncio
async def test_private_share_has_no_history_and_double_click_has_one_remote_ref(exchange):
    service,db,calls,remote,source=exchange
    first,second=await asyncio.gather(service.share(),service.share())
    assert first['id']==second['id'] and first['state']==second['state']=='sent'
    commits=[kw['body'] for method,path,kw in calls if method=='POST' and path.endswith('/git/commits')]
    assert len(commits)==1 and commits[0]['parents']==[]
    assert commits[0]['message']=='Neutral Vanilla source snapshot\n\nVanilla-Base: '+'b'*40
    assert len([1 for method,path,kw in calls if method=='POST' and path.endswith('/git/refs')])==1
    assert all('main' not in kw.get('body',{}).get('ref','') for method,path,kw in calls)


@pytest.mark.asyncio
async def test_lost_reply_is_reconciled_without_a_second_push(exchange):
    service,db,calls,remote,source=exchange;remote['loseReply']=True
    with pytest.raises(GitHubError):await service.share()
    assert service.list()['items'][0]['state']=='unknown'
    assert (await service.share())['state']=='sent'
    assert len([1 for method,path,kw in calls if method=='POST' and path.endswith('/git/refs')])==1


@pytest.mark.asyncio
async def test_privacy_or_missing_agreement_blocks_every_remote_write(exchange):
    service,db,calls,remote,source=exchange
    def reject():raise ValueError('Datenschutzprüfung fehlgeschlagen')
    source.read=reject
    with pytest.raises(ValueError,match='Datenschutz'):await service.share()
    assert not [c for c in calls if c[0]=='POST']
    db.put('contributions/settings',{'revision':2,'role':'customer','agreement':None})
    with pytest.raises(ValueError,match='Codeaustausch'):await service.share()
    assert not [c for c in calls if c[0]=='POST']
