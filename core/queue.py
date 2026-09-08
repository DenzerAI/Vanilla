from __future__ import annotations

from datetime import datetime, timezone
from time import time
from uuid import uuid4
from zoneinfo import ZoneInfo

from .database import dump
from .notifications import record_completion
from .routines import instant


class JobQueue:
    def __init__(self, db, storage, timezone="Europe/Berlin"):
        self.db, self.storage = db, storage
        self.timezone = ZoneInfo(timezone)

    def enqueue(self, job_id, slot=None):
        job = self.storage.job(job_id)
        id = uuid4().hex
        with self.db.transaction() as cx:
            if slot:
                existing = cx.execute(
                    "SELECT * FROM executions WHERE slot=?", (slot,)
                ).fetchone()
                if existing:
                    return dict(existing)
            active = cx.execute(
                "SELECT * FROM executions WHERE job_id=? AND status IN ('queued','dispatching','running')",
                (job_id,),
            ).fetchone()
            if active:
                return dict(active)
            cx.execute(
                "INSERT INTO executions(id,job_id,status,slot,created_at,job_snapshot) VALUES(?,?,'queued',?,?,?)",
                (id, job_id, slot, time(), dump(job)),
            )
            cx.execute(
                "INSERT INTO events(kind,entity_id,payload,created_at) VALUES('job.queued',?,?,?)",
                (id, dump({"jobId": job_id}), time()),
            )
        return self.get(id)

    def get(self, id):
        rows = self.db.rows("SELECT * FROM executions WHERE id=?", (id,))
        if not rows:
            raise ValueError("Lauf nicht gefunden.")
        return rows[0]

    def claim(self):
        with self.db.transaction() as cx:
            # The runtime dispatches one new job at a time. LLM turns remain asynchronous.
            row = cx.execute(
                "SELECT * FROM executions WHERE status='queued' AND not_before<=? ORDER BY created_at,id LIMIT 1", (time(),)
            ).fetchone()
            if not row:
                return None
            cx.execute(
                "UPDATE executions SET status='dispatching',started_at=?,lease_until=? WHERE id=? AND status='queued'",
                (time(), time() + 120, row["id"]),
            )
            return self.get(row["id"])

    def dispatched(self, id, result):
        self.get(id)
        with self.db.transaction() as cx:
            cx.execute(
                "UPDATE executions SET status=CASE WHEN status='dispatching' THEN 'running' ELSE status END,adapter_run_id=?,thread_id=? WHERE id=?",
                (result.get("runId"), result.get("threadId"), id),
            )
        return self.get(id)

    def finish(self, id, status, result=None, error=None):
        status = {"inProgress": "running", "complete": "completed"}.get(status, status)
        if status not in {"completed", "failed", "interrupted", "cancelled"}:
            raise ValueError("Ungültiger Abschlussstatus.")
        with self.db.transaction() as cx:
            row = cx.execute(
                "SELECT * FROM executions WHERE id=?", (id,)
            ).fetchone()
            if not row:
                raise ValueError("Lauf nicht gefunden.")
            if row["status"] in {"completed", "failed", "interrupted", "cancelled"}:
                return self.get(id)
            cx.execute(
                "UPDATE executions SET status=?,finished_at=?,result=?,error=?,lease_until=NULL WHERE id=?",
                (status, time(), dump(result or {}), error, id),
            )
            cx.execute(
                "INSERT INTO events(kind,entity_id,payload,created_at) VALUES('job.finished',?,?,?)",
                (id, dump({"status": status, "error": error}), time()),
            )
            record_completion(cx, row, status, result, error)
        return self.get(id)

    def renew(self, id, progress=None):
        with self.db.transaction() as cx:
            cx.execute("UPDATE executions SET lease_until=?,progress=coalesce(?,progress) WHERE id=? AND status IN ('dispatching','running')", (time() + 120, progress, id))

    def defer(self, id, seconds):
        with self.db.transaction() as cx:
            cx.execute("UPDATE executions SET status='queued',started_at=NULL,lease_until=NULL,not_before=?,progress='Wartet auf ruhende Arbeit' WHERE id=?", (time()+seconds,id))

    def retry(self, id):
        previous = self.get(id)
        job = self.storage.job(previous["job_id"])
        policy = job.get("retry", {})
        if previous["status"] not in {"failed", "interrupted"} or not policy.get("idempotent") or previous["attempt"] > min(int(policy.get("count", 0)), 3):
            return None
        run = self.enqueue(previous["job_id"], slot="retry:" + id)
        if run["slot"] != "retry:" + id or run["parent_id"]:
            return run
        with self.db.transaction() as cx:
            cx.execute("UPDATE executions SET attempt=?,parent_id=?,not_before=? WHERE id=?", (previous["attempt"] + 1, id, time() + min(300, 10 * 2 ** previous["attempt"]), run["id"]))
        return self.get(run["id"])

    def recover(self):
        # Only explicitly idempotent tasks may be retried after an interrupted run.
        interrupted = self.db.rows(
            "SELECT id FROM executions WHERE status IN ('dispatching','running')"
        )
        for row in interrupted:
            self.finish(
                row["id"],
                "interrupted",
                error="Server wurde neu gestartet. Ergebnis prüfen und bei Bedarf erneut ausführen.",
            )
            try:
                self.retry(row['id'])
            except ValueError as error:
                # A removed or edited manifest must not prevent the server from starting.
                self.db.event("job.retry_skipped", row['id'], {"error": str(error)})
        return len(interrupted)

    def schedule(self, now=None):
        now = now or datetime.now(self.timezone)
        for job in self.storage.sync_jobs():
            schedule = job.get("schedule", {})
            if job.get("status") != "active":
                continue
            local = now.astimezone(ZoneInfo(schedule.get('timezone', str(self.timezone)))) if now.tzinfo else now.replace(tzinfo=self.timezone)
            start = instant(schedule['startAt']) if schedule.get('startAt') else None
            if start and local < start:
                continue
            if schedule.get('type') == 'once':
                if local >= instant(schedule['at']):
                    self.enqueue(job['id'], f"{job['id']}:once:{instant(schedule['at']).astimezone(timezone.utc).isoformat()}")
                continue
            if schedule.get("type") == "interval":
                slot = int((local.timestamp() - (start.timestamp() if start else 0)) // (schedule["minutes"] * 60))
                if start and slot < 1:
                    continue
                anchor = f":{schedule['startAt']}" if start else ''
                self.enqueue(job["id"], f"{job['id']}:interval{anchor}:{slot}")
                continue
            if schedule.get("type") == "event":
                key = "job/cursor/" + job["id"]
                current = self.db.get(key)["value"]
                newest = self.db.rows("SELECT coalesce(max(id),0) n FROM events")[0]["n"]
                if current is not None:
                    events = self.db.rows("SELECT id,entity_id FROM events WHERE id>? AND kind=? ORDER BY id DESC LIMIT 100", (current, schedule["event"]))
                    for event in events:
                        own = self.db.rows("SELECT id FROM executions WHERE id=? AND job_id=?", (event["entity_id"], job["id"]))
                        if not own:
                            slot = f"{job['id']}:event:{event['id']}"
                            run = self.enqueue(job["id"], slot)
                            if run['slot'] != slot:
                                newest = current  # Preserve the pending event while this job is busy.
                            break
                if current != newest:
                    self.db.put(key, newest)
                continue
            if schedule.get("type") not in {
                "daily",
                "weekdays",
                "weekly",
            }:
                continue
            if schedule["type"] == "weekdays" and local.weekday() >= 5:
                continue
            if schedule['type'] == 'weekly' and local.weekday() not in schedule['days']:
                continue
            scheduled = schedule.get("time", "")
            if len(scheduled) != 5 or local.strftime("%H:%M") < scheduled:
                continue
            hour, minute = map(int, scheduled.split(':'))
            due = local.replace(hour=hour, minute=minute, second=0, microsecond=0, fold=0)
            if local.timestamp() < due.timestamp() or (start and due.timestamp() < start.timestamp()):
                continue
            slot = f"{job['id']}:{local.date()}:{scheduled}"
            # Catch up today's due slot once, never replay a backlog of old days.
            self.enqueue(job["id"], slot)
