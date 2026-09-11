from core.database import Database
from core.notifications import Notifications


def test_ai_notice_survives_restart_and_does_not_duplicate_or_reset_read_state(tmp_path):
    file = tmp_path / 'agent.sqlite3'
    db = Database(file)
    notices = Notifications(db)
    notices.system('ai-codex-updated-1.1.0', 'ai-update', 'codex', 'Codex aktualisiert', 'Version 1.1.0')
    with db.transaction() as cx:
        cx.execute("UPDATE job_notifications SET read_at=123 WHERE id='ai-codex-updated-1.1.0'")
    db.close()
    db = Database(file)
    try:
        Notifications(db).system('ai-codex-updated-1.1.0', 'ai-update', 'codex', 'Codex aktualisiert', 'Version 1.1.0')
        rows = db.rows("SELECT * FROM job_notifications WHERE kind='ai-update'")
        assert len(rows) == 1
        assert rows[0]['read_at'] == 123
        assert rows[0]['job_id'] == ''
        assert db.rows("SELECT count(*) n FROM executions")[0]['n'] == 0
    finally:
        db.close()


def test_background_delivery_is_deduplicated_and_offline_does_not_stop_other_maintenance():
    import asyncio
    from types import SimpleNamespace
    from core.runtime import Runtime
    runtime = Runtime.__new__(Runtime)
    runtime.ai_receipts, runtime.ai_error = set(), False
    notices, failures = [], []
    runtime.notifications = SimpleNamespace(system=lambda *args: notices.append(args))
    runtime.queue = SimpleNamespace(db=SimpleNamespace(event=lambda *args: failures.append(args)))

    async def request(*args, **kwargs):
        return {'events': [{'id': 'ai-new', 'subject': 'codex', 'title': 'Neu', 'body': 'Neue Version', 'status': 'completed'}]}

    async def offline(*args, **kwargs):
        raise OSError('offline')

    async def scenario():
        runtime.request = request
        await runtime.maintain_ai()
        await runtime.maintain_ai()
        assert len(notices) == 1
        runtime.request = offline
        await runtime.maintain_ai()
        await runtime.maintain_ai()
        assert len(failures) == 1
        runtime.request = request
        await runtime.maintain_ai()
        assert not runtime.ai_error

    asyncio.run(scenario())
