from core.config import Config
from core.database import Database
from core.storage import Storage, valid_record_key


def test_delivery_ledger_survives_sqlite_reopen_and_backup(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    workspace = root / "workspace"
    workspace.mkdir()
    config = Config(root=root, workspace=workspace, data=root / "data", start_adapter=False)
    key = "control/message-delivery.json"
    assert valid_record_key(key)
    assert not valid_record_key("control/../message-delivery.json")
    ledger = {
        "version": 1,
        "gates": {"chat": {"turnId": "running", "blocked": True}},
        "messages": [
            {"id": "uncertain", "chatId": "chat", "status": "unknown", "revision": 3},
            {"id": "later", "chatId": "chat", "status": "waiting", "revision": 1},
        ],
    }
    file = config.data / "agent.sqlite3"
    db = Database(file)
    Storage(db, config).import_legacy()
    db.put(key, ledger)
    backup = config.data / "backup.sqlite3"
    db.backup(backup)
    db.close()
    for target in [file, backup]:
        reopened = Database(target)
        assert reopened.get(key)["value"] == ledger
        # A repeated legacy import cannot replace a newer delivery state.
        reopened.put(key, {"version": 1, "messages": []}, only_if_missing=True)
        assert reopened.get(key)["value"] == ledger
        reopened.close()
