import asyncio
import json
import sqlite3
from pathlib import Path
import httpx
import pytest
from core.config import Config
from core.database import Database
from core.messenger import Messenger, Connection, Draft, Send, Action, AgentSend

@pytest.fixture
def service(tmp_path):
    config=Config(root=tmp_path,start_adapter=False)
    db=Database(config.data/'agent.sqlite3')
    s=Messenger(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'ok':True,'status':'ready','id':'sent1'}))))
    yield s
    asyncio.run(s.close());db.close()

def source(tmp_path):
    p=tmp_path/'old'/'history.db';p.parent.mkdir()
    media=p.parent/'media';media.mkdir();(media/'photo.jpg').write_bytes(b'image')
    with sqlite3.connect(p) as c:
        c.executescript('CREATE TABLE chats(id,name,last_message_ts,unread_count); CREATE TABLE messages(id,chat_id,sender_jid,from_me,ts,type,body,quoted_msg_id,has_media,media_path,media_mime,transcript,ack); CREATE TABLE reactions(msg_id,sender_jid,emoji,ts);')
        c.execute('INSERT INTO chats VALUES(?,?,?,?)',('peer@c.us','Person',100,1))
        c.execute('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',('one','peer@c.us','sender',0,100,'image','Photo',None,1,str(media/'photo.jpg'),'image/jpeg','',2))
        c.execute('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',('two','peer@c.us','me',1,101,'chat','Reply','one',0,None,None,'',3))
        c.execute('INSERT INTO reactions VALUES(?,?,?,?)',('one','me','👍',102))
    return p

def setup(s,tmp_path):
    p=source(tmp_path)
    c=s.setup(Connection(name='Personal',sourceDb=str(p),bridgeUrl='http://127.0.0.1:9988'))
    s.import_whatsapp(c)
    return c,s.threads('default')[0]

def test_migration_preserves_and_deduplicates(service,tmp_path):
    c,t=setup(service,tmp_path)
    d=service.detail(t['id'],'default')
    assert len(d['messages'])==2
    assert d['messages'][1]['quoted']['text']=='Photo'
    assert d['messages'][0]['reactions'][0]['emoji']=='👍'
    assert d['messages'][0]['media']['url'].startswith('/api/messenger/media?')
    service.import_whatsapp(c)
    assert service.thread(t['id'],'default')['revision']==2
    Path(c['source_db']).unlink()
    assert len(service.detail(t['id'],'default')['messages'])==2
    assert len(list((service.root/'media').iterdir()))==1

def test_hidden_channel_and_workspace_scope(service,tmp_path):
    c,t=setup(service,tmp_path)
    hidden=service.setup(Connection(name='Agent',role='agent-send',bridgeUrl='http://127.0.0.1:9989'))
    assert all(r['connection_id']!=hidden['id'] for r in service.threads('default'))
    with pytest.raises(ValueError):service.detail(t['id'],'another-project')
    with pytest.raises(ValueError):asyncio.run(service.agent_send(AgentSend(connectionId=hidden['id'],recipient='123@c.us',text='hello',requestId='test-request-one')))

def test_sends_saved_version_and_never_retries_unknown(service,tmp_path):
    c,t=setup(service,tmp_path)
    service.draft(Draft(id=t['id'],version=0,text='Reply'))
    calls=[]
    async def send(c,path,body):calls.append(body);raise ValueError('lost connection')
    service.bridge=send
    b=Send(id=t['id'],version=1,requestId='test-request-one')
    for _ in range(2):
        with pytest.raises(ValueError):asyncio.run(service.send(b))
    assert len(calls)==1
    assert service.detail(t['id'],'default')['draft']['text']=='Reply'
    with pytest.raises(ValueError):service.draft(Draft(id=t['id'],version=0,text='Stale'))

def test_source_paths_and_read_markers(service,tmp_path):
    c,t=setup(service,tmp_path)
    service.mark(Action(id=t['id'],revision=1))
    assert service.thread(t['id'],'default')['seen']==1
    service.mark(Action(id=t['id'],revision=0))
    assert service.thread(t['id'],'default')['seen']==1
    with pytest.raises(ValueError):service.setup(Connection(name='remote',bridgeUrl='http://example.com:9988'))
    assert service.copy_media(c,str(tmp_path/'elsewhere.txt'),'id','text/plain') is None

def test_file_only_send_and_cross_thread_attachment_rejected(service,tmp_path):
    import base64
    from core.messenger import Upload
    c,t=setup(service,tmp_path)
    attachment=service.upload(Upload(id=t['id'],name='photo.png',mime='image/png',base64=base64.b64encode(b'fixture-image').decode()))
    calls=[]
    async def bridge(c,path,body):calls.append((path,body));return {'id':'file-only-result'}
    service.bridge=bridge
    result=asyncio.run(service.send(Send(id=t['id'],version=0,requestId='file-only-request-1',attachmentId=attachment['id'])))
    assert result['id']=='file-only-result'
    assert calls[0][0]=='/sendImage' and calls[0][1]['caption']==''
    assert base64.b64decode(calls[0][1]['base64'])==b'fixture-image'
    message=service.detail(t['id'],'default')['messages'][-1]
    assert message['external']=='file-only-result' and message['media']['url']
    service.ingest(c,[{'external':'another@c.us','sender':'Other','updated':'2026-01-01T00:00:00+00:00'}],[])
    other=next(x for x in service.threads('default') if x['external']=='another@c.us')
    with pytest.raises(ValueError,match='anderen Gespräch'):
        asyncio.run(service.send(Send(id=other['id'],version=0,requestId='file-only-request-2',attachmentId=attachment['id'])))
    with pytest.raises(ValueError):
        service.upload(Upload(id=t['id'],projectId='other',name='x',mime='text/plain',base64='YQ=='))
    assert len(calls)==1


def test_telegram_upload_uses_provider_chat_reply_and_message_ids(service):
    import base64
    from core.messenger import Upload
    c=service.setup(Connection(provider='telegram-user',name='Telegram'))
    service.ingest(c,[{'external':'42','sender':'Agent','updated':'2026-01-01T00:00:00+00:00'}],
                   [{'external':'7','chat_id':'42','sender':'Agent','text':'Question','outgoing':False,'time':'2026-01-01T00:00:00+00:00'}])
    t=service.threads('default')[0]
    class Telegram:
        def __init__(self):self.calls=[]
        async def send_file(self,*args,**kwargs):self.calls.append((args,kwargs));return {'id':'88'}
        async def close(self):pass
    service.telegram=Telegram()
    attachment=service.upload(Upload(id=t['id'],name='note.txt',mime='text/plain',base64=base64.b64encode(b'contents').decode()))
    result=asyncio.run(service.send(Send(id=t['id'],version=0,requestId='telegram-file-request',attachmentId=attachment['id'],replyTo='7')))
    assert result['id']=='88'
    assert service.telegram.calls==[((c['id'],'42',b'contents','note.txt'),{'caption':'','reply_to':'7','voice':False})]
    m=service.detail(t['id'],'default')['messages'][-1]
    assert m['external']=='88' and m['replyTo']=='7' and m['quoted']['text']=='Question'
    assert m['id']!='88'  # HTTP IDs are local, provider IDs remain scoped to the chat.


def test_media_routes_enforce_thread_and_project_scope(service,tmp_path):
    from fastapi import FastAPI
    from core.messenger import routes
    c,t=setup(service,tmp_path)
    message=service.detail(t['id'],'default')['messages'][0]
    app=FastAPI()
    app.include_router(routes(service))
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,raise_app_exceptions=False),base_url='http://test') as client:
            params={'id':t['id'],'messageId':message['id'],'projectId':'default'}
            response=await client.get('/api/messenger/media',params=params)
            assert response.status_code==200 and response.content==b'image'
            assert response.headers['cache-control']=='no-store'
            for changed in ({'projectId':'other'},{'id':'missing-thread'},{'messageId':'missing-message'}):
                response=await client.get('/api/messenger/media',params={**params,**changed})
                assert response.status_code>=400 and response.content!=b'image'
    asyncio.run(check())

def test_typing_during_send_preserves_newer_draft(service,tmp_path):
    c,t=setup(service,tmp_path)
    service.draft(Draft(id=t['id'],version=0,text='Send this'))
    async def exercise():
        entered=asyncio.Event();release=asyncio.Event();calls=[]
        async def bridge(c,path,body):
            calls.append(body);entered.set();await release.wait();return {'id':'sent-original'}
        service.bridge=bridge
        sending=asyncio.create_task(service.send(Send(id=t['id'],version=1,requestId='draft-race-request')))
        await entered.wait()
        service.draft(Draft(id=t['id'],version=1,text='New unsent text'))
        release.set();await sending
        assert calls[0]['text']=='Send this'
        draft=service.detail(t['id'],'default')['draft']
        assert draft['text']=='New unsent text' and draft['version']==2
    asyncio.run(exercise())

def test_unknown_send_stays_blocked_after_client_reload(service,tmp_path):
    c,t=setup(service,tmp_path)
    service.draft(Draft(id=t['id'],version=0,text='Reply'))
    calls=[]
    async def broken(*args):calls.append(1);raise ValueError('lost acknowledgement')
    service.bridge=broken
    for request in ['before-reload-request','after-reload-request']:
        with pytest.raises(ValueError):asyncio.run(service.send(Send(id=t['id'],version=1,requestId=request)))
    assert len(calls)==1


def test_whatsapp_internal_events_do_not_move_or_reopen_chat(service,tmp_path):
    from core.messenger import iso
    c,t=setup(service,tmp_path)
    service.mark(Action(id=t['id'],revision=t['revision']))
    service.mark(Action(id=t['id'],done=True))
    with sqlite3.connect(c['source_db']) as cx:
        for n in range(105):
            cx.execute('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                       (f'security-{n}','peer@c.us','internal',0,200+n,'e2e_notification','123@lid',None,0,None,None,'',0))
        cx.execute('UPDATE chats SET last_message_ts=400,unread_count=105')
    for _ in range(2):
        service.import_whatsapp(c)
        current=service.thread(t['id'],'default')
        assert current['updated']==iso(101)
        assert current['revision']==current['seen']==2
        assert current['done']==1
        detail=service.detail(t['id'],'default')
        assert len(detail['messages'])==2 and detail['nextBefore'] is None
    # An actual text message containing an LID is still a message.
    with sqlite3.connect(c['source_db']) as cx:
        cx.execute('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                   ('real','peer@c.us','person@lid',0,500,'chat','123@lid',None,0,None,None,'',0))
    service.import_whatsapp(c)
    current=service.thread(t['id'],'default')
    assert current['updated']==iso(500) and current['revision']==3
    assert current['seen']==2 and current['done']==0
    assert service.detail(t['id'],'default')['messages'][-1]['text']=='123@lid'


@pytest.mark.parametrize('seen,expected_seen',[(2,2),(3,2),(4,3)])
def test_legacy_system_entries_repair_sorting_and_keep_real_unread(service,tmp_path,seen,expected_seen):
    from core.messenger import iso
    c,t=setup(service,tmp_path)
    # Simulate old importer counting an internal event followed by a real message.
    service.ingest(c,[],[
        {'external':'legacy','chat_id':'peer@c.us','type':'e2e_notification','text':'123@lid','time':iso(900),'outgoing':False,'sender':'internal'},
        {'external':'real','chat_id':'peer@c.us','type':'chat','text':'Hi','time':iso(300),'outgoing':False,'sender':'person'},
    ])
    service.mark(Action(id=t['id'],revision=seen))
    for _ in range(2):
        service.import_whatsapp(c)
        current=service.thread(t['id'],'default')
        assert current['updated']==iso(300)
        assert current['revision']==3 and current['seen']==expected_seen
        assert len(service.detail(t['id'],'default')['messages'])==3
    # The provider record survives for diagnosis; it is not a chat bubble.
    assert len(service.db.rows('SELECT id FROM messenger_messages WHERE thread_id=?',(t['id'],)))==4
