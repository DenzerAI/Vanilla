"""Personal Telegram account adapter. Bot tokens never authenticate a user account.

Credentials and StringSession live in the installation provider vault. Reads do
not mark conversations as read; no polling or agent dispatch is started here.
"""
import asyncio
import json
import io
import re
from datetime import datetime, timezone
from .provider_vault import ProviderVault


class TelegramBridge:
    def __init__(self, db, config, client_factory=None):
        self.vault = ProviderVault(config.data / 'provider-vault', db, config.root)
        self.factory = client_factory
        self.clients = {}
        self.pending = {}
        self.locks = {}

    def key(self, identity):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', str(identity)):
            raise ValueError('Ungültiger Telegram-Anschluss.')
        return 'telegram-user-' + identity

    def lock(self, identity):
        self.key(identity)
        return self.locks.setdefault(identity, asyncio.Lock())

    def credentials(self, identity):
        return json.loads(self.vault.read(self.key(identity)))

    async def configure(self, identity, api_id, api_hash):
        if not str(api_id).isdigit() or not 0 < int(api_id) < 2**31 or not re.fullmatch(r'[a-fA-F0-9]{32}', str(api_hash)):
            raise ValueError('Telegram API-ID und API-Hash aus my.telegram.org erforderlich.')
        async with self.lock(identity):
            if identity in self.clients:
                await self.clients.pop(identity).disconnect()
            self.pending.pop(identity, None)
            old = self.credentials(identity) if self.vault.has(self.key(identity)) else {}
            if old and (old.get('api_id'), old.get('api_hash')) != (int(api_id), api_hash) and old.get('session'):
                raise ValueError('Telegram zuerst trennen, bevor die App gewechselt wird.')
            self.vault.save(self.key(identity), json.dumps({**old, 'api_id': int(api_id), 'api_hash': api_hash}))
        return {'configured': True, 'authorized': False}

    async def client(self, identity):
        if identity not in self.clients:
            values = self.credentials(identity)
            if self.factory:
                client = self.factory(values)
            else:
                try:
                    from telethon import TelegramClient
                    from telethon.sessions import StringSession
                except ImportError:
                    raise ValueError('Telegram-Erweiterung fehlt. Python-Paket mit Extra telegram installieren.') from None
                client = TelegramClient(StringSession(values.get('session', '')), values['api_id'], values['api_hash'],
                                        flood_sleep_threshold=0, request_retries=1, connection_retries=1)
            await client.connect()
            self.clients[identity] = client
        return self.clients[identity]

    async def status(self, identity):
        async with self.lock(identity):
            if not self.vault.has(self.key(identity)):
                return {'configured': False, 'authorized': False, 'state': 'app_required'}
            client = await self.client(identity)
            authorized = await client.is_user_authorized()
            me = await client.get_me() if authorized else None
            return {'configured': True, 'authorized': authorized,
                    'state': 'connected' if authorized else self.pending.get(identity, {}).get('state', 'login_required'),
                    'identity': str(me.id) if me else None,
                    'name': getattr(me, 'first_name', '') if me else ''}

    async def auth_start(self, identity, phone):
        if not re.fullmatch(r'\+[1-9][0-9]{6,14}', str(phone)):
            raise ValueError('Telegram-Rufnummer mit Ländervorwahl erforderlich.')
        async with self.lock(identity):
            client = await self.client(identity)
            if await client.is_user_authorized():
                return {'state': 'connected', 'authorized': True}
            sent = await client.send_code_request(phone)
            self.pending[identity] = {'phone': phone, 'hash': sent.phone_code_hash, 'state': 'code_required'}
            return {'state': 'code_required', 'authorized': False}

    async def auth_finish(self, identity, code='', password=''):
        async with self.lock(identity):
            pending = self.pending.get(identity)
            if not pending:
                raise ValueError('Telegram-Anmeldung zuerst starten.')
            client = await self.client(identity)
            try:
                if pending['state'] == 'password_required':
                    if not password:
                        raise ValueError('Telegram-Passwort für die Bestätigung in zwei Schritten erforderlich.')
                    await client.sign_in(password=password)
                else:
                    if not re.fullmatch(r'\d{4,8}', str(code)):
                        raise ValueError('Gültigen Telegram-Anmeldecode eingeben.')
                    await client.sign_in(phone=pending['phone'], code=code, phone_code_hash=pending['hash'])
            except Exception as exc:
                if type(exc).__name__ == 'SessionPasswordNeededError':
                    pending['state'] = 'password_required'
                    return {'state': 'password_required', 'authorized': False}
                raise
            me = await client.get_me()
            if getattr(me, 'bot', False):
                await client.disconnect()
                self.clients.pop(identity, None)
                raise ValueError('Für die Inbox ist ein persönliches Telegram-Konto erforderlich.')
            values = self.credentials(identity)
            values['session'] = client.session.save()
            self.vault.save(self.key(identity), json.dumps(values))
            self.pending.pop(identity, None)
            return {'state': 'connected', 'authorized': True, 'identity': str(me.id)}

    async def authorized(self, identity):
        client = await self.client(identity)
        if not await client.is_user_authorized():
            raise ValueError('Telegram-Konto noch nicht angemeldet.')
        return client

    @staticmethod
    def message(item):
        media = getattr(item, 'media', None)
        file = getattr(item, 'file', None)
        return {'id': str(item.id), 'external': str(item.id), 'chat_id': str(getattr(item, 'chat_id', '') or ''),
                'sender': str(item.sender_id or ''), 'time': item.date.isoformat() if item.date else datetime.now(timezone.utc).isoformat(),
                'replyTo': str(item.reply_to_msg_id) if item.reply_to_msg_id else None, 'ack': 1 if item.out else 0,
                'type': 'media' if media and file else 'text', 'text': item.message or '',
                'timestamp': item.date.timestamp() if item.date else 0,
                'outgoing': bool(item.out), 'sender_id': str(item.sender_id or ''),
                'reply_to': str(item.reply_to_msg_id) if item.reply_to_msg_id else None,
                'edited': bool(item.edit_date),
                'reactions': [{'emoji': getattr(r.reaction, 'emoticon', ''), 'count': r.count,
                               'chosen': getattr(r, 'chosen_order', None) is not None}
                              for r in getattr(getattr(item, 'reactions', None), 'results', [])
                              if getattr(r.reaction, 'emoticon', '')],
                'attachments': [{'id': str(item.id), 'name': getattr(file, 'name', None) or 'Telegram-Medium',
                                 'mime': getattr(file, 'mime_type', None) or 'application/octet-stream',
                                 'size': getattr(file, 'size', 0) or 0}] if media and file else []}

    @staticmethod
    def chat(chat_id):
        if not re.fullmatch(r'-?\d{1,22}', str(chat_id)):
            raise ValueError('Ungültiger Telegram-Chat.')
        return int(chat_id)

    async def entity(self, client, chat_id):
        # StringSession intentionally has no entity cache. Resolve dialogs after
        # a restart before obtaining an InputPeer (access_hash required).
        target = self.chat(chat_id)
        async for dialog in client.iter_dialogs():
            if dialog.id == target:
                return dialog.input_entity
        raise ValueError('Telegram-Chat nicht gefunden. Zuerst in Telegram öffnen.')

    async def threads(self, identity, limit=100):
        async with self.lock(identity):
            client = await self.authorized(identity)
            result = []
            async for dialog in client.iter_dialogs(limit=max(1, min(int(limit), 500))):
                result.append({'id': str(dialog.id), 'external': str(dialog.id), 'sender': dialog.name or str(dialog.id),
                               'updated': dialog.date.isoformat() if dialog.date else datetime.now(timezone.utc).isoformat(),
                               'title': dialog.name or str(dialog.id),
                               'unread': dialog.unread_count, 'timestamp': dialog.date.timestamp() if dialog.date else 0,
                               'preview': dialog.message.message or '' if dialog.message else '',
                               'is_group': bool(dialog.is_group), 'messages': [self.message(dialog.message)] if dialog.message else []})
            return result

    async def messages(self, identity, chat_id, limit=100, before=0):
        async with self.lock(identity):
            client = await self.authorized(identity)
            peer = await self.entity(client, chat_id)
            items = await client.get_messages(peer, limit=max(1, min(int(limit), 500)), offset_id=max(0, int(before)))
            return [self.message(item) for item in reversed(items)]

    async def send(self, identity, chat_id, text, reply_to=None):
        if not isinstance(text, str) or not text.strip() or len(text) > 4096:
            raise ValueError('Telegram-Nachricht muss 1 bis 4096 Zeichen enthalten.')
        async with self.lock(identity):
            client = await self.authorized(identity)
            peer = await self.entity(client, chat_id)
            item = await client.send_message(peer, text, reply_to=int(reply_to) if reply_to else None, parse_mode=None)
            return self.message(item)

    async def send_file(self, identity, chat_id, data, filename, caption='', reply_to=None, voice=False):
        # Accept owned bytes only, never a client-supplied filesystem path or URL.
        if not isinstance(data, bytes) or not 0 < len(data) <= 25 * 1024 * 1024:
            raise ValueError('Telegram-Datei muss zwischen 1 Byte und 25 MB groß sein.')
        if not isinstance(filename, str) or not filename or len(filename) > 180 or any(c in filename for c in ('/', '\\', '\0', '\r', '\n')):
            raise ValueError('Ungültiger Dateiname.')
        if not isinstance(caption, str) or len(caption) > 1024:
            raise ValueError('Telegram-Bildunterschrift darf höchstens 1024 Zeichen enthalten.')
        async with self.lock(identity):
            client = await self.authorized(identity)
            peer = await self.entity(client, chat_id)
            stream = io.BytesIO(data)
            stream.name = filename
            item = await client.send_file(peer, stream, caption=caption, parse_mode=None,
                                          reply_to=int(reply_to) if reply_to else None, voice_note=bool(voice))
            return self.message(item)

    async def react(self, identity, chat_id, message_id, emoji):
        if not isinstance(emoji, str) or len(emoji) > 16 or any(ord(c) < 32 for c in emoji):
            raise ValueError('Ungültige Telegram-Reaktion.')
        if not str(message_id).isdigit() or int(message_id) <= 0:
            raise ValueError('Ungültige Telegram-Nachricht.')
        from telethon.tl.functions.messages import SendReactionRequest
        from telethon.tl.types import ReactionEmoji
        async with self.lock(identity):
            client = await self.authorized(identity)
            peer = await self.entity(client, chat_id)
            await client(SendReactionRequest(peer=peer, msg_id=int(message_id),
                                            reaction=[ReactionEmoji(emoticon=emoji)] if emoji else []))
            return {'ok': True, 'id': str(message_id), 'emoji': emoji}

    async def media(self, identity, chat_id, message_id):
        async with self.lock(identity):
            client = await self.authorized(identity)
            peer = await self.entity(client, chat_id)
            item = await client.get_messages(peer, ids=int(message_id))
            if not item or not item.file or not isinstance(item.file.size, int) or item.file.size > 25 * 1024 * 1024:
                raise ValueError('Telegram-Medium fehlt oder ist größer als 25 MB.')
            data = await client.download_media(item, file=bytes)
            if not data or len(data) > 25 * 1024 * 1024:
                raise ValueError('Telegram-Medium konnte nicht geladen werden.')
            return data, item.file.mime_type or 'application/octet-stream'

    async def disconnect(self, identity):
        async with self.lock(identity):
            if identity in self.clients:
                await self.clients.pop(identity).disconnect()
            self.pending.pop(identity, None)
            if self.vault.has(self.key(identity)):
                self.vault.remove(self.key(identity))
        return {'state': 'disconnected'}

    async def close(self):
        for identity in list(self.clients):
            async with self.lock(identity):
                await self.clients.pop(identity).disconnect()
