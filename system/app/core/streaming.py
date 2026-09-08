"""One upstream stream for every browser; durable changes use SQLite cursors."""
import asyncio
import json
from time import time

import httpx


class StreamHub:
    def __init__(self, runtime, db):
        self.runtime, self.db = runtime, db
        self.clients = set()
        self.tasks = []
        self.connected = False
        self.ready = asyncio.Event()
        self.last_event = 0
        self.cursor = 0

    def publish(self, payload, id=None):
        frame = (f"id: {id}\n" if id else "") + "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
        for client in tuple(self.clients):
            if client.full():
                while not client.empty():
                    client.get_nowait()
                client.put_nowait('data: {"method":"wrapper/resync"}\n\n')
            client.put_nowait(frame)

    async def start(self):
        self.cursor = self.db.rows("SELECT coalesce(max(id),0) id FROM events")[0]["id"]
        self.tasks = [asyncio.create_task(self.core_events())]
        if self.runtime.config.start_adapter:
            self.tasks.append(asyncio.create_task(self.worker_events()))

    async def worker_events(self):
        while True:
            try:
                async with self.runtime.client.stream("GET", self.runtime.config.adapter_url + "/api/events", headers=self.runtime.headers, timeout=httpx.Timeout(None, connect=3, read=45)) as response:
                    response.raise_for_status()
                    self.connected = True
                    self.ready.set()
                    self.publish({"method": "wrapper/resync"})
                    frame, size = [], 0
                    async for line in response.aiter_lines():
                        self.last_event = time()
                        size += len(line)
                        if size > 2_000_000:
                            raise ValueError("Worker-Ereignis zu groß.")
                        if line.startswith("data:"):
                            frame.append(line[5:].lstrip())
                        elif not line:
                            if frame:
                                self.publish(json.loads("\n".join(frame)))
                            frame, size = [], 0
            except asyncio.CancelledError:
                raise
            except (httpx.HTTPError, ValueError):
                if self.connected:
                    self.publish({"method": "wrapper/disconnected", "params": {"message": "Verbindung wird wiederhergestellt."}})
            self.connected = False
            self.ready.clear()
            await asyncio.sleep(2)

    async def core_events(self):
        while True:
            rows = self.db.rows("SELECT id,kind,entity_id,payload,created_at FROM events WHERE id>? ORDER BY id LIMIT 100", (self.cursor,))
            for row in rows:
                self.cursor = row["id"]
                self.publish({"method": "core/event", "params": {**row, "payload": json.loads(row["payload"])}}, "core:" + str(row["id"]))
            if any(r["kind"].startswith("job.") for r in rows):
                self.publish({"method": "wrapper/jobs"})
            if any(r["kind"].startswith("memory.") for r in rows):
                self.publish({"method": "wrapper/library"})
            await asyncio.sleep(1)

    async def subscribe(self, last_id=""):
        queue = asyncio.Queue(maxsize=256)
        self.clients.add(queue)
        try:
            if self.runtime.config.start_adapter and not self.connected:
                try:
                    await asyncio.wait_for(self.ready.wait(), 10)
                except TimeoutError:
                    pass  # Core health and queue events still work without a worker.
            yield ': core connected\n\ndata: {"method":"wrapper/resync"}\n\n'
            if last_id.startswith("core:") and last_id[5:].isdigit():
                rows = self.db.rows("SELECT id,kind,entity_id,payload FROM events WHERE id>? AND id<=? ORDER BY id LIMIT 100", (int(last_id[5:]), self.cursor))
                for row in rows:
                    yield f"id: core:{row['id']}\ndata: " + json.dumps({"method": "core/event", "params": {**row, "payload": json.loads(row["payload"])}}) + "\n\n"
            while True:
                try:
                    yield await asyncio.wait_for(queue.get(), 20)
                except TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            self.clients.discard(queue)

    async def close(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
