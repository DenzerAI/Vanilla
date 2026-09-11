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
