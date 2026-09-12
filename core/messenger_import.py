"""Explicit, additive import from an existing local WhatsApp bridge.

Provider processes and source files remain unchanged. The inbox owns its own
messages/media; continued sync reads the explicitly configured source read-only.
"""
import argparse
import asyncio
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from .config import Config
from .database import Database
from .messenger import Messenger, Connection, SCHEMA

async def migrate(root,source,bridge,agent_bridge='',project='default'):
    config=Config(root=Path(root),start_adapter=False)
    target=config.data/'agent.sqlite3'
    if not target.is_file():raise ValueError('Zielinstallation hat keine bestehende Datenbank.')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
    directory=config.data/'messenger'/'imports'/stamp
    directory.mkdir(parents=True,mode=0o700)
    with closing(sqlite3.connect(target)) as live,closing(sqlite3.connect(directory/'before.sqlite3')) as backup:live.backup(backup)
    (directory/'before.sqlite3').chmod(0o600)
    db=Database(directory/'stage.sqlite3');service=Messenger(db,config)
    try:
        # Stable per-project identities make repeated imports deduplicate.
        from hashlib import sha256
        personal_id=sha256((project+str(Path(source).resolve())+'whatsapp-inbox').encode()).hexdigest()[:32]
        personal=service.setup(Connection(projectId=project,name='WhatsApp · meine Inbox',sourceDb=str(Path(source).resolve()),bridgeUrl=bridge))
        with db.transaction() as cx:cx.execute('UPDATE messenger_connections SET id=? WHERE id=?',(personal_id,personal['id']))
        personal=service.connection(personal_id,project)
        result=await asyncio.to_thread(service.import_whatsapp,personal)
        await service.check(personal_id,project)
        if agent_bridge:
            hidden=service.setup(Connection(projectId=project,name='WhatsApp · Agent',role='agent-send',bridgeUrl=agent_bridge))
            agent_id=sha256((project+agent_bridge+'whatsapp-agent-send').encode()).hexdigest()[:32]
            with db.transaction() as cx:cx.execute('UPDATE messenger_connections SET id=? WHERE id=?',(agent_id,hidden['id']))
            await service.check(agent_id,project)
        # Database locking protects the normal runtime owner. The explicit
        # migration uses SQLite's transaction, never instantiates a second core.
        with closing(sqlite3.connect(target,timeout=30)) as live:
            live.execute('PRAGMA foreign_keys=ON');live.executescript(SCHEMA)
            live.execute('ATTACH DATABASE ? AS stage',(str(db.file),))
            live.execute('BEGIN IMMEDIATE')
            for table in ('messenger_connections','messenger_threads','messenger_messages'):
                cols=[r[1] for r in live.execute('PRAGMA table_info('+table+')')]
                names=','.join(cols)
                live.execute(f'INSERT OR IGNORE INTO {table} ({names}) SELECT {names} FROM stage.{table}')
            live.commit()
        note={'format':1,'project':project,'created':stamp,'connection':personal_id,'counts':result,'sourceMode':'read-only','backup':'before.sqlite3'}
        (directory/'migration.json').write_text(json.dumps(note,indent=2));(directory/'migration.json').chmod(0o600)
        return note
    finally:
        await service.close();db.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',required=True);p.add_argument('--source',required=True);p.add_argument('--bridge',required=True);p.add_argument('--agent-bridge',default='');p.add_argument('--project',default='default')
    args=p.parse_args();print(json.dumps(asyncio.run(migrate(args.root,args.source,args.bridge,args.agent_bridge,args.project)),ensure_ascii=False))
