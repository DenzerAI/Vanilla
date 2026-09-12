import json
from datetime import datetime, timezone
from types import SimpleNamespace as NS
import pytest
from core.telegram_bridge import TelegramBridge

class Vault:
    def __init__(self): self.values = {}
    def has(self, key): return key in self.values
    def read(self, key): return self.values[key]
    def save(self, key, value): self.values[key] = value
    def remove(self, key): del self.values[key]

class SessionPasswordNeededError(Exception): pass

class Client:
    def __init__(self, values):
        self.authorized = bool(values.get('session'))
        self.session = NS(save=lambda: 'synthetic-session')
        self.sent = []
    async def connect(self): pass
    async def disconnect(self): pass
    async def is_user_authorized(self): return self.authorized
    async def get_me(self): return NS(id=123, first_name='Fixture', bot=False)
    async def send_code_request(self, phone): return NS(phone_code_hash='private-hash')
    async def sign_in(self, **kwargs):
        if 'password' not in kwargs: raise SessionPasswordNeededError()
        self.authorized = True
    async def iter_dialogs(self, **kwargs):
        yield NS(id=42, name='Agent', unread_count=2, date=datetime.now(timezone.utc), is_group=False,
                 input_entity='peer-with-access-hash', message=message())
    async def get_messages(self, peer, **kwargs):
        assert peer == 'peer-with-access-hash'
        return [message()]
    async def send_message(self, peer, text, **kwargs):
        self.sent.append((peer, text, kwargs)); return message()

def message():
    return NS(id=7, message='hello', date=datetime.now(timezone.utc), out=True, sender_id=123,
              reply_to_msg_id=None, edit_date=None, media=None, file=None, chat_id=42)

@pytest.fixture
def bridge():
    b = TelegramBridge.__new__(TelegramBridge)
    b.vault, b.factory, b.clients, b.pending, b.locks = Vault(), Client, {}, {}, {}
    return b

@pytest.mark.asyncio
async def test_login_two_factor_and_reopen_without_leaking_credentials(bridge):
    assert (await bridge.status('a'))['state'] == 'app_required'
    await bridge.configure('a', 123, 'a'*32)
    assert await bridge.auth_start('a', '+49123456789') == {'state':'code_required','authorized':False}
    result = await bridge.auth_finish('a', '12345')
    assert result['state'] == 'password_required'
    assert 'private-hash' not in json.dumps(await bridge.status('a'))
    await bridge.auth_finish('a', password='synthetic-password')
    assert 'synthetic-password' not in json.dumps(bridge.vault.values)
    assert '12345' not in json.dumps(bridge.vault.values)
    await bridge.close()
    assert (await bridge.status('a'))['authorized']
    await bridge.disconnect('a')
    assert (await bridge.status('a'))['state'] == 'app_required'

@pytest.mark.asyncio
async def test_history_and_explicit_plain_text_send_resolve_peer_after_restart(bridge):
    await bridge.configure('a', 123, 'a'*32)
    bridge.vault.save(bridge.key('a'), json.dumps({'api_id':123,'api_hash':'a'*32,'session':'synthetic-session'}))
    threads = await bridge.threads('a')
    assert threads[0]['external'] == '42'
    messages = await bridge.messages('a', '42')
    assert messages[0]['external'] == '7'
    assert not bridge.clients['a'].sent
    sent = await bridge.send('a','42','**literal**', reply_to='7')
    assert sent['id'] == '7'
    assert bridge.clients['a'].sent == [('peer-with-access-hash','**literal**',{'reply_to':7,'parse_mode':None})]
    with pytest.raises(ValueError): await bridge.send('a', '42', '')
    with pytest.raises(ValueError): await bridge.messages('a','@unexpected')
    with pytest.raises(ValueError): await bridge.messages('a','999')

@pytest.mark.asyncio
async def test_validation_and_missing_login(bridge):
    with pytest.raises(ValueError): await bridge.configure('../escape', 123, 'a'*32)
    with pytest.raises(ValueError): await bridge.configure('a', 0, 'a'*32)
    await bridge.configure('a', 123, 'a'*32)
    with pytest.raises(ValueError): await bridge.threads('a')
    with pytest.raises(ValueError): await bridge.auth_start('a', '123')
    with pytest.raises(ValueError): await bridge.auth_finish('a', '12345')

@pytest.mark.asyncio
async def test_wrong_code_and_password_do_not_persist_or_authorize(bridge):
    await bridge.configure('a',123,'a'*32)
    await bridge.auth_start('a','+49123456789')
    client = bridge.clients['a']
    async def invalid(**kwargs): raise ValueError('invalid login')
    original = client.sign_in
    client.sign_in = invalid
    with pytest.raises(ValueError): await bridge.auth_finish('a','98765')
    assert not bridge.credentials('a').get('session')
    assert not (await bridge.status('a'))['authorized']
    client.sign_in = original
    await bridge.auth_finish('a','12345')
    with pytest.raises(ValueError): await bridge.auth_finish('a')
    client.sign_in = invalid
    with pytest.raises(ValueError): await bridge.auth_finish('a',password='wrong-secret')
    assert not bridge.credentials('a').get('session')
    assert 'wrong-secret' not in json.dumps(bridge.vault.values)

@pytest.mark.asyncio
async def test_login_without_two_factor_and_bot_rejected(bridge):
    await bridge.configure('a',123,'a'*32)
    await bridge.auth_start('a','+49123456789')
    client = bridge.clients['a']
    async def valid(**kwargs): client.authorized = True
    client.sign_in = valid
    assert (await bridge.auth_finish('a','12345'))['authorized']
    await bridge.disconnect('a')
    await bridge.configure('a',123,'a'*32)
    await bridge.auth_start('a','+49123456789')
    client = bridge.clients['a']
    client.sign_in = valid
    async def bot(): return NS(id=333,bot=True)
    client.get_me = bot
    with pytest.raises(ValueError,match='persönliches'): await bridge.auth_finish('a','12345')
    assert not bridge.credentials('a').get('session')
    assert 'a' not in bridge.clients

async def login(bridge):
    await bridge.configure('a',123,'a'*32)
    await bridge.auth_start('a','+49123456789')
    await bridge.auth_finish('a','12345')
    await bridge.auth_finish('a',password='fixture')
    return bridge.clients['a']

@pytest.mark.asyncio
async def test_media_requires_authorized_dialog_and_checks_size_before_download(bridge):
    await bridge.configure('a',123,'a'*32)
    with pytest.raises(ValueError,match='angemeldet'): await bridge.media('a','42','7')
    client = await login(bridge)
    downloads = []
    item = message()
    item.file = NS(size=3,mime_type='image/png')
    async def get(peer,**kwargs):
        assert peer == 'peer-with-access-hash'
        assert kwargs == {'ids':7}
        return item
    async def download(item,**kwargs): downloads.append(item.id); return b'abc'
    client.get_messages, client.download_media = get, download
    with pytest.raises(ValueError,match='nicht gefunden'): await bridge.media('a','99','7')
    assert not downloads
    assert await bridge.media('a','42','7') == (b'abc','image/png')
    item.file.size = 26*1024*1024
    with pytest.raises(ValueError,match='25 MB'): await bridge.media('a','42','7')
    assert downloads == [7]

@pytest.mark.asyncio
async def test_file_send_owns_bytes_and_reactions_use_explicit_peer(bridge):
    client = await login(bridge)
    files=[]
    async def send_file(peer,stream,**kwargs):
        files.append((peer,stream.name,stream.read(),kwargs)); return message()
    client.send_file=send_file
    result=await bridge.send_file('a','42',b'abc','voice.ogg','caption',reply_to=7,voice=True)
    assert result['id']=='7'
    assert files==[('peer-with-access-hash','voice.ogg',b'abc',{'caption':'caption','parse_mode':None,'reply_to':7,'voice_note':True})]
    with pytest.raises(ValueError): await bridge.send_file('a','42','/private/file','x')
    with pytest.raises(ValueError): await bridge.send_file('a','42',b'abc','../x')
    with pytest.raises(ValueError): await bridge.send_file('a','42',b'','x')
    calls=[]
    async def call(self,request): calls.append(request)
    Client.__call__=call
    assert (await bridge.react('a','42','7','👍'))['ok']
    assert calls[-1].peer=='peer-with-access-hash'
    assert calls[-1].msg_id==7 and calls[-1].reaction[0].emoticon=='👍'
    await bridge.react('a','42','7','')
    assert calls[-1].reaction==[]
    with pytest.raises(ValueError): await bridge.react('a','42','0','👍')
