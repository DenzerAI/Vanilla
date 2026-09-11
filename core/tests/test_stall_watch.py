from core.stall_watch import stalled


def test_notice_once_after_the_limit_and_never_while_waiting_for_the_user():
    memory = {}
    entries = [{"id": "a1", "name": "chat-fix", "status": "checking"}]
    releases = [{"target": "b" * 40, "phase": "activating", "activationPhase": "waiting-for-sessions"},
                {"target": "c" * 40, "phase": "waiting-for-checks"}]
    assert stalled(1000, entries, releases, memory) == []
    assert stalled(1000 + 14 * 60, entries, releases, memory) == []
    notices = stalled(1000 + 16 * 60, entries, releases, memory)
    assert [n[0] for n in notices] == ["bau-a1-checking", "release-" + "c" * 40 + "-waiting-for-checks"]
    assert "16 Minuten" in notices[0][2] and "Prüfung" in notices[0][2]
    assert stalled(1000 + 30 * 60, entries, releases, memory) == []


def test_finished_steps_forget_their_timer():
    memory = {}
    stalled(0, [{"id": "a1", "name": "x", "status": "checking"}], [], memory)
    stalled(20 * 60, [{"id": "a1", "name": "x", "status": "integrated"}], [], memory)
    assert memory == {}
    assert stalled(21 * 60, [{"id": "a1", "name": "x", "status": "checking"}], [], memory) == []


def test_a_working_build_without_ready_is_reported_after_half_an_hour():
    memory = {}
    entries = [{"id": "w1", "name": "offen", "status": "working", "updatedAt": 1000}]
    assert stalled(1000 + 20 * 60, entries, [], memory) == []
    notices = stalled(1000 + 31 * 60, entries, [], memory)
    assert [n[0] for n in notices] == ["bau-w1-working"] and "ready" in notices[0][2]
    assert stalled(1000 + 60 * 60, entries, [], memory) == []
    assert stalled(1000 + 61 * 60, [{"id": "w1", "name": "offen", "status": "integrated"}], [], memory) == []
    assert memory == {}


def test_blocked_build_is_reported_once_per_reason_with_log_tail(tmp_path):
    from core.stall_watch import blocked
    log_dir = tmp_path
    (log_dir / "abc.log").write_text("$ git commit\n{\n  \"ok\": false,\n  \"errors\": [\"platform: Quelländerung ohne Vertrag\"]\n}\n")
    entries = [{"id": "abc", "name": "haken", "status": "blocked", "reason": "Schritt fehlgeschlagen: git commit"},
               {"id": "def", "name": "ok", "status": "integrated"}]
    memory = {}
    first = blocked(entries, memory, log_dir)
    assert len(first) == 1
    key, title, body = first[0]
    assert title == "Bauauftrag blockiert"
    assert "„haken“" in body and "git commit" in body and "Quelländerung ohne Vertrag" in body and "ready" in body
    assert blocked(entries, memory, log_dir) == []
    entries[0]["reason"] = "Schritt fehlgeschlagen: pytest"
    again = blocked(entries, memory, log_dir)
    assert len(again) == 1 and again[0][0] != key
    assert blocked([{"id": "x", "status": "blocked", "reason": "r"}], {}, log_dir / "fehlt")[0][2].endswith("übergeben.")
