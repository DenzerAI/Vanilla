"""Account-scoped messenger inbox. Provider bridges never trigger agent work."""
from __future__ import annotations
import asyncio
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from time import time
from urllib.parse import urlsplit, quote
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from .database import dump

SCHEMA = """
CREATE TABLE IF NOT EXISTS messenger_connections(id TEXT PRIMARY KEY,project TEXT NOT NULL,provider TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,bridge_url TEXT NOT NULL DEFAULT '',source_db TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'saved',error TEXT NOT NULL DEFAULT '',updated REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS messenger_threads(id TEXT PRIMARY KEY,connection_id TEXT NOT NULL REFERENCES messenger_connections(id),external TEXT NOT NULL,sender TEXT NOT NULL,updated TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,seen INTEGER NOT NULL DEFAULT 0,done INTEGER NOT NULL DEFAULT 0,UNIQUE(connection_id,external));
CREATE TABLE IF NOT EXISTS messenger_messages(id TEXT PRIMARY KEY,thread_id TEXT NOT NULL REFERENCES messenger_threads(id),external TEXT NOT NULL,time TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(thread_id,external));
CREATE INDEX IF NOT EXISTS messenger_time ON messenger_messages(thread_id,time,id);
CREATE TABLE IF NOT EXISTS messenger_drafts(thread_id TEXT PRIMARY KEY REFERENCES messenger_threads(id),text TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS messenger_sends(request_id TEXT PRIMARY KEY,connection_id TEXT NOT NULL,thread_id TEXT NOT NULL,fingerprint TEXT NOT NULL,state TEXT NOT NULL,result TEXT NOT NULL DEFAULT '{}',created REAL NOT NULL);
"""

def ident(*parts):
    return 'msg:' + hashlib.sha256(dump(parts).encode()).hexdigest()[:32]

def iso(value):
    if isinstance(value,str) and 'T' in value:
        return value
    return datetime.fromtimestamp(float(value or 0),timezone.utc).isoformat()

# Classify by provider type, never by text or @lid: real messages can contain IDs.
WHATSAPP_INTERNAL_TYPES = frozenset({
    'e2e_notification', 'protocol', 'message_history_notice',
    'status_notification', 'debug',
})
VISIBLE_MESSAGE_SQL = "COALESCE(json_extract(data,'$.internal'),0)=0"

class Connection(BaseModel):
    id: str = ''
    projectId: str = 'default'
    provider: str = 'whatsapp'
    name: str = Field(min_length=1,max_length=150)
    role: str = 'inbox'
    bridgeUrl: str = ''
    sourceDb: str = ''
    enabled: bool = True

class Action(BaseModel):
    id: str
    projectId: str = 'default'
    revision: int = Field(default=0,ge=0)
    done: bool | None = None

class Draft(Action):
    text: str = Field(max_length=30000)
    version: int = Field(ge=0)

class Send(Action):
    version: int = Field(ge=0)
    requestId: str = Field(min_length=16,max_length=100)
    replyTo: str = Field(default='',max_length=300)
    attachmentId: str = ''

class Upload(Action):
    name: str = Field(min_length=1,max_length=200)
    mime: str = Field(max_length=100)
    base64: str = Field(max_length=28_000_000)
    voice: bool = False

class Reaction(Action):
    messageId: str
    emoji: str = Field(max_length=32)

class TelegramAuth(Action):
    apiId: str = ''
    apiHash: str = ''
    phone: str = ''
    code: str = ''
    password: str = ''

class AgentSend(BaseModel):
    projectId: str = 'default'
    connectionId: str
    recipient: str = Field(min_length=3,max_length=100)
    text: str = Field(min_length=1,max_length=30000)
    requestId: str = Field(min_length=16,max_length=100)
    confirmed: bool = False

class Messenger:
    def __init__(self,db,config,project=lambda p:None,client=None):
        self.db,self.config,self.project=db,config,project
        self.root=config.data/'messenger'
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.client=client or httpx.AsyncClient(timeout=60,trust_env=False,follow_redirects=False)
        self.locks={};self.task=None;self.telegram=None
        with db.lock: db.connection.executescript(SCHEMA)
        with db.transaction() as cx:
            cx.execute("UPDATE messenger_sends SET state='unknown' WHERE state='sending'")

    def lock(self,id):
        return self.locks.setdefault(id,asyncio.Lock())

    def connection(self,id,project):
        self.project(project)
        rows=self.db.rows('SELECT * FROM messenger_connections WHERE id=? AND project=?',(id,project))
        if not rows: raise ValueError('Messenger-Verbindung nicht gefunden.')
        return rows[0]

    def connections(self,project):
        self.project(project)
        return self.db.rows('SELECT * FROM messenger_connections WHERE project=? ORDER BY name',(project,))

    def setup(self,b):
        self.project(b.projectId)
        if b.provider not in {'whatsapp','telegram-user'} or b.role not in {'inbox','agent-send'}:
            raise ValueError('Unbekannter Messenger oder Verwendungszweck.')
        if b.provider=='whatsapp':
            u=urlsplit(b.bridgeUrl)
            if u.scheme!='http' or u.hostname not in {'127.0.0.1','localhost','::1'} or not u.port or u.username or u.path not in {'','/'} or u.query or u.fragment:
                raise ValueError('Die Bridge muss eine lokale HTTP-Adresse mit eigenem Port haben.')
            if b.role=='inbox': self.read_source(b.sourceDb)
        id=b.id or uuid4().hex
        if b.id: self.connection(id,b.projectId)
        with self.db.transaction() as cx:
            old=cx.execute('SELECT * FROM messenger_connections WHERE id=?',(id,)).fetchone()
            if old and (old['provider']!=b.provider or old['role']!=b.role or old['source_db']!=b.sourceDb):
                raise ValueError('Konto und Rolle bleiben fest. Dafür eine neue Verbindung anlegen.')
            cx.execute("INSERT INTO messenger_connections(id,project,provider,name,role,bridge_url,source_db,enabled) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,bridge_url=excluded.bridge_url,enabled=excluded.enabled,status='saved',error=''",(id,b.projectId,b.provider,b.name,b.role,b.bridgeUrl.rstrip('/'),b.sourceDb,int(b.enabled)))
        return self.connection(id,b.projectId)

    @staticmethod
    def read_source(path):
        p=Path(path).expanduser().resolve()
        if not p.is_file(): raise ValueError('Die ausgewählte WhatsApp-Datenbank fehlt.')
        try:
            with closing(sqlite3.connect(p.as_uri()+'?mode=ro',uri=True,timeout=5)) as cx:
                cx.row_factory=sqlite3.Row
                cx.execute('BEGIN')
                chats=[dict(r) for r in cx.execute('SELECT id,name,last_message_ts,unread_count FROM chats')]
                messages=[dict(r) for r in cx.execute('SELECT * FROM messages')]
                reactions=[dict(r) for r in cx.execute('SELECT msg_id,sender_jid,emoji,ts FROM reactions')]
                return p,chats,messages,reactions
        except sqlite3.Error:
            raise ValueError('Die Datei hat kein unterstütztes WhatsApp-Verlaufsformat.') from None

    async def bridge(self,c,path,body=None):
        if not c['enabled']: raise ValueError('Diese Verbindung ist getrennt.')
        try:
            r=await self.client.request('GET' if body is None else 'POST',c['bridge_url']+path,json=body)
            if r.status_code>=400: raise ValueError('Die Bridge hat den Aufruf abgelehnt. Verbindung und Verlauf prüfen.')
            result=r.json()
            if result.get('ok') is False: raise ValueError('Die Bridge konnte die Aktion nicht bestätigen. Vor erneutem Senden den Verlauf prüfen.')
            return result
        except (httpx.HTTPError,json.JSONDecodeError):
            raise ValueError('Bridge nicht erreichbar oder Antwort unklar. Vor erneutem Senden den Verlauf prüfen.') from None

    async def check(self,id,project):
        c=self.connection(id,project)
        try:
            r=await self.bridge(c,'/health') if c['provider']=='whatsapp' else await self.tg().status(id)
            ready=r.get('status') in {'ready','running','connected'} or r.get('connected') is True or r.get('authorized') is True
            status='connected' if ready else 'disconnected'
            error='' if ready else 'Beim Messenger anmelden.'
        except ValueError as e: status,error='error',str(e)
        with self.db.transaction() as cx:
            cx.execute('UPDATE messenger_connections SET status=?,error=? WHERE id=?',(status,error,id))
        return self.connection(id,project)

    def tg(self):
        if self.telegram is None:
            from .telegram_bridge import TelegramBridge
            self.telegram=TelegramBridge(self.db,self.config)
        return self.telegram

    def copy_media(self,c,path,external,mime):
        if not path:return None
        source=Path(path).resolve()
        media_root=Path(c['source_db']).resolve().parent/'media'
        if not source.is_relative_to(media_root.resolve()) or not source.is_file():return None
        if source.stat().st_size>100*1024*1024:return None
        key=hashlib.sha256((c['id']+external).encode()).hexdigest()
        target=self.root/'media'/key
        target.parent.mkdir(exist_ok=True,mode=0o700)
        if not target.exists():
            temp=target.with_suffix('.tmp');shutil.copyfile(source,temp);temp.chmod(0o600);temp.replace(target)
        return {'key':key,'mime':mime or 'application/octet-stream','name':source.name}

    def import_whatsapp(self,c):
        _,chats,messages,reactions=self.read_source(c['source_db'])
        by_reaction={}
        for r in reactions:by_reaction.setdefault(r['msg_id'],[]).append({'sender':r['sender_jid'],'emoji':r['emoji']})
        threads=[{'external':r['id'],'sender':r['name'] or r['id'].split('@')[0],'updated':iso(0),'unread':bool(r['unread_count'])} for r in chats]
        known={r['external'] for r in threads}
        normalized=[]
        for m in messages:
            if m['chat_id'] not in known:
                threads.append({'external':m['chat_id'],'sender':m['chat_id'].split('@')[0],'updated':iso(0),'unread':False});known.add(m['chat_id'])
            media=self.copy_media(c,m['media_path'],m['id'],m['media_mime'])
            normalized.append({'external':m['id'],'chat_id':m['chat_id'],'sender':m['sender_jid'] or '', 'text':m['body'] or '', 'time':iso(m['ts']),'outgoing':bool(m['from_me']),'type':m['type'],'internal':m['type'] in WHATSAPP_INTERNAL_TYPES,'replyTo':m['quoted_msg_id'],'ack':m['ack'],'media':media,'missingMedia':bool(m['has_media']) and not media,'transcript':m['transcript'] or '', 'reactions':by_reaction.get(m['id'],[]),'providerMetadata':m.get('raw_json') or ''})
        self.ingest(c,threads,normalized)
        return {'chats':len(threads),'messages':len(normalized),'media':sum(bool(m['media']) for m in normalized)}

    def ingest(self,c,threads,messages):
        with self.db.transaction() as cx:
            if c['provider']=='whatsapp':
                self.repair_whatsapp_activity(cx,c['id'])
            initial=set()
            for t in threads:
                id=ident(c['id'],t['external'])
                exists=cx.execute('SELECT 1 FROM messenger_threads WHERE id=?',(id,)).fetchone()
                if not exists and not t.get('unread'):initial.add(id)
                cx.execute('INSERT INTO messenger_threads(id,connection_id,external,sender,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sender=excluded.sender,updated=MAX(messenger_threads.updated,excluded.updated)',(id,c['id'],t['external'],t['sender'],t['updated']))
            changed=set()
            for m in messages:
                tid=ident(c['id'],m['chat_id']);mid=ident(tid,m['external']);data=dump(m)
                old=cx.execute('SELECT data FROM messenger_messages WHERE id=?',(mid,)).fetchone()
                if old and old[0]==data:continue
                cx.execute('INSERT INTO messenger_messages(id,thread_id,external,time,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,time=excluded.time',(mid,tid,m['external'],m['time'],data))
                if not old and not m.get('internal'):
                    cx.execute('UPDATE messenger_threads SET revision=revision+1,done=0,updated=MAX(updated,?) WHERE id=?',(m['time'],tid))
                changed.add(tid)
            if c['provider']=='whatsapp':
                # Source chat timestamps include encryption/protocol events. Recompute
                # from locally retained visible messages, including pending source echoes.
                cx.execute(f"UPDATE messenger_threads SET updated=COALESCE((SELECT MAX(time) FROM messenger_messages WHERE thread_id=messenger_threads.id AND {VISIBLE_MESSAGE_SQL}),?) WHERE connection_id=?",(iso(0),c['id']))
            for tid in initial:cx.execute('UPDATE messenger_threads SET seen=revision WHERE id=?',(tid,))
            cx.execute('UPDATE messenger_connections SET updated=? WHERE id=?',(time(),c['id']))
        if changed:self.db.event('messenger.changed',c['id'],{})

    @staticmethod
    def repair_whatsapp_activity(cx,connection_id):
        """Reclassify legacy imports once without deleting source/provider records.

        Revision counted inserts, so rowid order reconstructs the old seen boundary.
        Keep genuine unread contributions while removing only previously counted events.
        """
        for t in cx.execute('SELECT id,revision,seen FROM messenger_threads WHERE connection_id=?',(connection_id,)).fetchall():
            rows=cx.execute('SELECT id,data FROM messenger_messages WHERE thread_id=? ORDER BY rowid',(t['id'],)).fetchall()
            counted=[(r,json.loads(r['data'])) for r in rows if not json.loads(r['data']).get('internal')]
            removed=removed_seen=0
            for index,(r,m) in enumerate(counted):
                if m.get('type') not in WHATSAPP_INTERNAL_TYPES:continue
                m['internal']=True
                cx.execute('UPDATE messenger_messages SET data=? WHERE id=?',(dump(m),r['id']))
                removed+=1
                if index<t['seen']:removed_seen+=1
            if removed:
                cx.execute('UPDATE messenger_threads SET revision=MAX(0,revision-?),seen=MAX(0,seen-?) WHERE id=?',(removed,removed_seen,t['id']))

    async def sync(self,id,project):
        async with self.lock(id):
            c=self.connection(id,project)
            if not c['enabled']:raise ValueError('Diese Verbindung ist getrennt.')
            await self.check(id,project)
            if c['role']!='inbox':return {'messages':0}
            if c['provider']=='whatsapp':return await asyncio.to_thread(self.import_whatsapp,c)
            threads=await self.tg().threads(id)
            messages=[]
            for t in threads:
                tid=ident(id,t['external'])
                old=self.db.rows('SELECT updated FROM messenger_threads WHERE id=?',(tid,))
                if not old or old[0]['updated']!=t['updated']:
                    messages.extend([{**m,'chat_id':t['external']} for m in await self.tg().messages(id,t['external'])])
            self.ingest(c,threads,messages)
            return {'chats':len(threads),'messages':len(messages)}

    def threads(self,project):
        self.project(project)
        return self.db.rows("SELECT t.*,c.provider,c.name AS address,c.status,c.error FROM messenger_threads t JOIN messenger_connections c ON c.id=t.connection_id WHERE c.project=? AND c.role='inbox' AND t.external!='status@broadcast' ORDER BY t.updated DESC",(project,))

    def thread(self,id,project):
        rows=self.db.rows("SELECT t.*,c.project,c.provider,c.name AS address,c.enabled FROM messenger_threads t JOIN messenger_connections c ON c.id=t.connection_id WHERE t.id=? AND c.project=? AND c.role='inbox'",(id,project))
        if not rows:raise ValueError('Gespräch nicht gefunden.')
        return rows[0]

    def detail(self,id,project,before=''):
        t=self.thread(id,project)
        rows=self.db.rows(f"SELECT * FROM messenger_messages WHERE thread_id=? AND {VISIBLE_MESSAGE_SQL} AND (?='' OR (time || id) < ?) ORDER BY time DESC,id DESC LIMIT 101",(id,before,before))
        more=len(rows)>100;rows=rows[:100]
        messages=[]
        for r in reversed(rows):
            m=json.loads(r['data']);m.pop('providerMetadata',None);m['id']=r['id'];m['sender']='Du' if m['outgoing'] else (m['sender'] or t['sender'])
            if t['provider']=='telegram-user' and m.get('attachments') and not m.get('media'):
                m['media']={**m['attachments'][0]}
            if m.get('media'):m['media']['url']='/api/messenger/media?'+f'id={quote(id)}&messageId={quote(r["id"])}&projectId={quote(project)}'
            if m.get('replyTo'):
                q=self.db.rows('SELECT data FROM messenger_messages WHERE thread_id=? AND external=?',(id,m['replyTo']))
                if q:
                    quoted=json.loads(q[0]['data']);m['quoted']={'sender':'Du' if quoted['outgoing'] else quoted['sender'],'text':quoted['text'][:1000]}
            messages.append(m)
        d=self.db.rows('SELECT text,version FROM messenger_drafts WHERE thread_id=?',(id,))
        return {'thread':t,'messages':messages,'draft':{**(d[0] if d else {'text':'','version':0}),'revision':t['revision']},'nextBefore':rows[-1]['time']+rows[-1]['id'] if more else None}

    def draft(self,b):
        self.thread(b.id,b.projectId)
        with self.db.transaction() as cx:
            current=cx.execute('SELECT version FROM messenger_drafts WHERE thread_id=?',(b.id,)).fetchone()
            if (current[0] if current else 0)!=b.version:raise ValueError('Entwurf wurde anderswo geändert. Eigenen Text sichern und neu laden.')
            version=b.version+1
            cx.execute('INSERT INTO messenger_drafts(thread_id,text,version) VALUES(?,?,?) ON CONFLICT(thread_id) DO UPDATE SET text=excluded.text,version=excluded.version',(b.id,b.text,version))
        return {'version':version}

    def mark(self,b):
        t=self.thread(b.id,b.projectId)
        with self.db.transaction() as cx:
            if b.done is None:cx.execute('UPDATE messenger_threads SET seen=MAX(seen,MIN(revision,?)) WHERE id=?',(b.revision,b.id))
            else:cx.execute('UPDATE messenger_threads SET done=? WHERE id=?',(int(b.done),b.id))
        return {'ok':True}

    def upload(self,b):
        self.thread(b.id,b.projectId)
        try:data=base64.b64decode(b.base64,validate=True)
        except ValueError:raise ValueError('Ungültige Datei.') from None
        if not data or len(data)>20*1024*1024:raise ValueError('Datei darf höchstens 20 MB groß sein.')
        key=uuid4().hex;p=self.root/'uploads'/key;p.parent.mkdir(exist_ok=True,mode=0o700);p.write_bytes(data);p.chmod(0o600)
        if b.voice:
            executable=shutil.which('ffmpeg')
            if not executable:raise ValueError('Audio-Konvertierung fehlt. Die Aufnahme bleibt im Browser gespeichert.')
            target=p.with_suffix('.ogg')
            try:
                subprocess.run([executable,'-nostdin','-v','error','-i',str(p),'-vn','-c:a','libopus','-b:a','48k','-f','ogg',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=60)
                target.replace(p);p.chmod(0o600);b.mime='audio/ogg; codecs=opus';b.name='Sprachnachricht.ogg'
            except (subprocess.SubprocessError,OSError):raise ValueError('Audio-Konvertierung fehlgeschlagen. Die Aufnahme bleibt gespeichert.') from None
        self.db.put('messenger-upload/'+key,{'thread':b.id,'project':b.projectId,'name':Path(b.name).name,'mime':b.mime,'voice':b.voice})
        return {'id':key,'name':Path(b.name).name}

    async def send(self,b):
        t=self.thread(b.id,b.projectId);c=self.connection(t['connection_id'],b.projectId)
        async with self.lock(c['id']):
            c=self.connection(t['connection_id'],b.projectId)
            d=self.db.rows('SELECT text,version FROM messenger_drafts WHERE thread_id=?',(b.id,))
            if not d:d=[{'text':'','version':0}]
            if d[0]['version']!=b.version:raise ValueError('Entwurf geändert. Vor dem Senden neu prüfen.')
            text=d[0]['text'];attachment=None
            if b.attachmentId:
                if not re.fullmatch(r'[a-f0-9]{32}',b.attachmentId):raise ValueError('Ungültiger Anhang.')
                attachment=self.db.get('messenger-upload/'+b.attachmentId)['value']
                if not attachment or attachment['thread']!=b.id or attachment['project']!=b.projectId:raise ValueError('Anhang gehört zu einem anderen Gespräch.')
            if not text.strip() and not attachment:raise ValueError('Nachricht ist leer.')
            if b.replyTo and not self.db.rows('SELECT 1 FROM messenger_messages WHERE thread_id=? AND external=?',(b.id,b.replyTo)):raise ValueError('Antwortbezug gehört nicht zu diesem Gespräch.')
            result=await self.deliver(c,t['external'],text,ident('draft',b.id,b.version,b.attachmentId),b.id,b.replyTo,b.attachmentId,attachment)
            with self.db.transaction() as cx:
                cx.execute("INSERT INTO messenger_drafts(thread_id,text,version) VALUES(?,'',?) ON CONFLICT(thread_id) DO UPDATE SET text='',version=messenger_drafts.version+1 WHERE messenger_drafts.version=?",(b.id,b.version+1,b.version))
            return result

    async def deliver(self,c,recipient,text,request_id,thread_id,reply='',attachment_id='',attachment=None):
        if not c['enabled']:raise ValueError('Diese Verbindung ist getrennt.')
        fingerprint=hashlib.sha256(dump([c['id'],recipient,text,reply,attachment_id]).encode()).hexdigest()
        rows=self.db.rows('SELECT * FROM messenger_sends WHERE request_id=?',(request_id,))
        if rows:
            if rows[0]['fingerprint']!=fingerprint:raise ValueError('Sendeauftrag wurde verändert.')
            if rows[0]['state']=='sent':return json.loads(rows[0]['result'])
            raise ValueError('Sendestatus unklar. Im Verlauf prüfen; diese Nachricht wird nicht automatisch erneut gesendet.')
        pending=self.db.rows("SELECT 1 FROM messenger_sends WHERE connection_id=? AND thread_id=? AND fingerprint=? AND state IN ('sending','unknown')",(c['id'],thread_id,fingerprint))
        if pending:raise ValueError('Für diesen Inhalt ist der Versand unklar. Erst den Verlauf prüfen; kein erneuter Versand.')
        with self.db.transaction() as cx:
            cx.execute("INSERT INTO messenger_sends(request_id,connection_id,thread_id,fingerprint,state,created) VALUES(?,?,?,?,'sending',?)",(request_id,c['id'],thread_id,fingerprint,time()))
        try:
            if c['provider']=='telegram-user':
                if attachment:
                    result=await self.tg().send_file(c['id'],recipient,(self.root/'uploads'/attachment_id).read_bytes(),attachment['name'],caption=text,reply_to=reply or None,voice=attachment['voice'])
                else:result=await self.tg().send(c['id'],recipient,text,reply_to=reply or None)
            else:
                payload={'chatId':recipient,'text':text,'replyTo':reply,'clientMessageId':request_id};path='/send'
                if attachment:
                    payload.update({'base64':base64.b64encode((self.root/'uploads'/attachment_id).read_bytes()).decode(),'mime':attachment['mime'],'filename':attachment['name'],'caption':text})
                    path='/sendVoice' if attachment['voice'] else '/sendImage' if attachment['mime'].startswith('image/') else '/sendDocument'
                    if attachment['voice'] and text.strip():raise ValueError('Sprachnachricht ohne zusätzlichen Text senden.')
                result=await self.bridge(c,path,payload)
            if not result.get('id'):raise ValueError('Annahme ohne Nachrichtenkennung. Verlauf prüfen; nicht erneut senden.')
            with self.db.transaction() as cx:
                cx.execute("UPDATE messenger_sends SET state='sent',result=? WHERE request_id=?",(dump(result),request_id))
            if c['role']=='inbox':
                now=iso(time());media=None
                if attachment:
                    key=hashlib.sha256((c['id']+str(result['id'])).encode()).hexdigest();target=self.root/'media'/key;target.parent.mkdir(exist_ok=True,mode=0o700);shutil.copyfile(self.root/'uploads'/attachment_id,target);target.chmod(0o600)
                    media={'key':key,'mime':attachment['mime'],'name':attachment['name']}
                thread=self.thread(thread_id,c['project'])
                self.ingest(c,[{'external':recipient,'sender':thread['sender'],'updated':now,'unread':False}],[{'external':str(result['id']),'chat_id':recipient,'sender':'Du','text':text,'time':now,'outgoing':True,'type':'ptt' if attachment and attachment['voice'] else 'chat','replyTo':reply,'ack':1,'media':media,'reactions':[]}])
            return result
        except BaseException:
            with self.db.transaction() as cx:cx.execute("UPDATE messenger_sends SET state='unknown' WHERE request_id=? AND state='sending'",(request_id,))
            raise

    async def agent_send(self,b):
        c=self.connection(b.connectionId,b.projectId)
        if c['role']!='agent-send' or not b.confirmed:raise ValueError('Expliziter Versandauftrag für den Agentenkanal fehlt.')
        if not re.fullmatch(r'[0-9]+@(c\.us|s\.whatsapp\.net|g\.us)',b.recipient):raise ValueError('Vollständige Messenger-Empfängerkennung erforderlich.')
        async with self.lock(c['id']):
            c=self.connection(b.connectionId,b.projectId)
            return await self.deliver(c,b.recipient,b.text,b.requestId,'agent-send')

    async def react(self,b):
        t=self.thread(b.id,b.projectId)
        async with self.lock(t['connection_id']):
            c=self.connection(t['connection_id'],b.projectId)
            if not c['enabled']:raise ValueError('Diese Verbindung ist getrennt.')
            rows=self.db.rows('SELECT * FROM messenger_messages WHERE id=? AND thread_id=?',(b.messageId,b.id))
            if not rows:raise ValueError('Nachricht nicht gefunden.')
            if c['provider']=='telegram-user':
                result=await self.tg().react(c['id'],t['external'],rows[0]['external'],b.emoji)
                updated=await self.tg().messages(c['id'],t['external'],limit=1,before=int(rows[0]['external'])+1)
                self.ingest(c,[{'external':t['external'],'sender':t['sender'],'updated':t['updated']}],[{**m,'chat_id':t['external']} for m in updated])
                return result
            result=await self.bridge(c,'/react',{'msgId':rows[0]['external'],'emoji':b.emoji})
            await asyncio.to_thread(self.import_whatsapp,c)
            return result

    async def refresh_thread(self,id,project):
        t=self.thread(id,project);c=self.connection(t['connection_id'],project)
        if c['provider']=='telegram-user' and c['enabled']:
            async with self.lock(c['id']):
                messages=await self.tg().messages(c['id'],t['external'])
                self.ingest(c,[{'external':t['external'],'sender':t['sender'],'updated':t['updated']}],[{**m,'chat_id':t['external']} for m in messages])

    async def loop(self):
        while True:
            for c in self.db.rows('SELECT id,project FROM messenger_connections WHERE enabled=1'):
                try:await self.sync(c['id'],c['project'])
                except Exception:
                    with self.db.transaction() as cx:cx.execute("UPDATE messenger_connections SET status='error',error=? WHERE id=?",('Abgleich fehlgeschlagen. Verbindung prüfen und erneut versuchen.',c['id']))
            await asyncio.sleep(15)

    async def close(self):
        if self.task:self.task.cancel();await asyncio.gather(self.task,return_exceptions=True)
        if self.telegram:await self.telegram.close()
        await self.client.aclose()


def routes(service):
    router=APIRouter()
    @router.get('/api/messenger/connections')
    async def connections(projectId:str='default'):return {'connections':service.connections(projectId)}
    @router.post('/api/messenger/connections')
    async def setup(b:Connection):
        async with service.lock(b.id or 'setup'):return await asyncio.to_thread(service.setup,b)
    @router.post('/api/messenger/check')
    async def check(b:Action):return await service.check(b.id,b.projectId)
    @router.post('/api/messenger/sync')
    async def sync(b:Action):return await service.sync(b.id,b.projectId)
    @router.get('/api/messenger/threads')
    async def threads(projectId:str='default'):return {'conversations':service.threads(projectId)}
    @router.get('/api/messenger/thread')
    async def detail(id:str,projectId:str='default',before:str=''):
        if not before:await service.refresh_thread(id,projectId)
        return service.detail(id,projectId,before)
    @router.post('/api/messenger/draft')
    async def draft(b:Draft):return service.draft(b)
    @router.post('/api/messenger/mark')
    async def mark(b:Action):return service.mark(b)
    @router.post('/api/messenger/upload')
    async def upload(b:Upload):return await asyncio.to_thread(service.upload,b)
    @router.post('/api/messenger/send')
    async def send(b:Send):return await service.send(b)
    @router.post('/api/messenger/agent-send')
    async def agent_send(b:AgentSend):return await service.agent_send(b)
    @router.post('/api/messenger/react')
    async def react(b:Reaction):return await service.react(b)
    @router.get('/api/messenger/pairing')
    async def pairing(id:str,projectId:str='default'):
        c=service.connection(id,projectId)
        if c['provider']!='whatsapp':raise ValueError('Dieser Anschluss verwendet keinen WhatsApp-QR-Code.')
        result=await service.bridge(c,'/pairing')
        qr=result.get('qr')
        if not isinstance(qr,str) or not qr or len(qr)>4096:raise HTTPException(409,'Kein QR-Code verfügbar. Verbindung prüfen.')
        node=shutil.which('node')
        if not node:raise ValueError('QR-Darstellung benötigt die installierte Node-Laufzeit.')
        def render():
            script="import QRCode from 'qrcode';let s='';for await(const chunk of process.stdin)s+=chunk;process.stdout.write(await QRCode.toBuffer(s,{type:'png',width:320,margin:2}));"
            return subprocess.run([node,'--input-type=module','-e',script],input=qr.encode(),stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,cwd=service.config.root,check=True,timeout=15).stdout
        return Response(await asyncio.to_thread(render),media_type='image/png',headers={'Cache-Control':'no-store'})
    @router.get('/api/messenger/media')
    async def media(id:str,messageId:str,projectId:str='default'):
        thread=service.thread(id,projectId)
        rows=service.db.rows('SELECT data FROM messenger_messages WHERE id=? AND thread_id=?',(messageId,id))
        data=json.loads(rows[0]['data']) if rows else {}
        if thread['provider']=='telegram-user':
            c=service.connection(thread['connection_id'],projectId)
            if not c['enabled']:raise HTTPException(409,'Telegram ist getrennt.')
            if not data.get('attachments'):raise HTTPException(404,'Datei nicht vorhanden.')
            content,mime=await service.tg().media(c['id'],thread['external'],data['external'])
            return Response(content,media_type=mime if mime.startswith(('image/','audio/','video/')) and mime.lower().split(';')[0]!='image/svg+xml' else 'application/octet-stream',headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
        m=data.get('media')
        if not m or not re.fullmatch(r'[a-f0-9]{64}',m['key']):raise HTTPException(404,'Datei nicht vorhanden.')
        p=service.root/'media'/m['key']
        if not p.is_file():raise HTTPException(404,'Datei nicht vorhanden.')
        mime=m['mime']
        inline=mime.startswith(('image/','audio/','video/')) and mime.lower().split(';')[0] not in {'image/svg+xml'}
        return FileResponse(p,media_type=mime if inline else 'application/octet-stream',filename=m['name'],content_disposition_type='inline' if inline else 'attachment',headers={'Cache-Control':'no-store'})
    def telegram_connection(b):
        c=service.connection(b.id,b.projectId)
        if c['provider']!='telegram-user' or not c['enabled']:raise ValueError('Telegram-Verbindung nicht aktiv.')
        return c
    @router.post('/api/messenger/telegram/configure')
    async def telegram_configure(b:TelegramAuth):
        telegram_connection(b)
        return await service.tg().configure(b.id,b.apiId,b.apiHash)
    @router.post('/api/messenger/telegram/start')
    async def telegram_start(b:TelegramAuth):
        telegram_connection(b)
        return await service.tg().auth_start(b.id,b.phone)
    @router.post('/api/messenger/telegram/finish')
    async def telegram_finish(b:TelegramAuth):
        telegram_connection(b)
        return await service.tg().auth_finish(b.id,b.code,b.password)
    @router.post('/api/messenger/disconnect')
    async def disconnect(b:Action):
        c=service.connection(b.id,b.projectId)
        async with service.lock(b.id):
            if c['provider']=='telegram-user':await service.tg().disconnect(b.id)
            with service.db.transaction() as cx:cx.execute("UPDATE messenger_connections SET enabled=0,status='disconnected' WHERE id=?",(b.id,))
        return {'ok':True}
    return router
