import json
from pathlib import Path
import subprocess

import pytest

from core.source_work import SourceWork, environment, git


class LocalQueue(SourceWork):
    def dependencies(self, root, repository, log):
        return Path("python3")

    def verify(self, root, repository, log):
        assert not git(root, "status", "--porcelain")
        if (root / "invalid.txt").exists():
            raise ValueError("Regression erkannt")


@pytest.fixture
def queue(tmp_path):
    repo = tmp_path / "development"
    repo.mkdir()
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.name", "Test")
    git(repo, "config", "user.email", "test@example.invalid")
    (repo / "scripts").mkdir()
    (repo / ".githooks").mkdir()
    (repo / ".gitignore").write_text(".verify/\n")
    (repo / "package.json").write_text(json.dumps({"scripts": {"source:setup": "git config core.hooksPath .githooks"}}))
    (repo / "scripts/security-scan.py").write_text("# fixture\n")
    (repo / "scripts/verify-modules.py").write_text("# fixture\n")
    (repo / "scripts/source-sync.py").write_text("import subprocess,sys\nsubprocess.run(['git','merge','--no-edit',sys.argv[1]],check=True)\n")
    hook = repo / ".githooks/pre-commit"
    hook.write_text("#!/bin/sh\nif test -f rejected.txt; then exit 1; fi\n")
    hook.chmod(0o755)
    (repo / "existing.txt").write_text("initial\n")
    git(repo, "add", ".")
    git(repo, "commit", "-m", "Initial fixture")
    service = LocalQueue(tmp_path / "data")
    service.configure(repo, tmp_path / "runtime")
    return service, repo


def test_explicit_completion_commits_and_integrates_once(queue):
    service, repo = queue
    row = service.begin("change", "chat-1")
    (Path(row["path"]) / "new.txt").write_text("new feature\n")
    assert service.tick()["entries"][0]["status"] == "working"
    service.ready(row["id"])
    assert service.tick(idle=False)["entries"][0]["status"] == "queued"
    result = service.tick()["entries"][0]
    assert result["status"] == "integrated"
    assert (repo / "new.txt").read_text() == "new feature\n"
    head = git(repo, "rev-parse", "HEAD")
    service.ready(row["id"])
    service.tick()
    assert git(repo, "rev-parse", "HEAD") == head
    assert result["commit"] == result["candidateCommit"]


def test_late_changes_do_not_get_committed(queue):
    service, repo = queue
    row = service.begin("late")
    p = Path(row["path"]) / "new.txt"
    p.write_text("first")
    service.ready(row["id"])
    p.write_text("still working")
    assert service.tick()["entries"][0]["status"] == "blocked"
    assert not (repo / "new.txt").exists()
    assert git(Path(row["path"]), "rev-parse", "HEAD") == row["base"]


def test_hook_failure_and_failed_regression_never_promote(queue):
    service, repo = queue
    initial = git(repo, "rev-parse", "HEAD")
    row = service.begin("reject")
    (Path(row["path"]) / "rejected.txt").write_text("fixture")
    service.ready(row["id"])
    assert service.tick()["entries"][0]["status"] == "blocked"
    assert git(repo, "rev-parse", "HEAD") == initial
    row = service.begin("regression")
    (Path(row["path"]) / "invalid.txt").write_text("fixture")
    service.ready(row["id"])
    result = service.tick()["entries"][1]
    assert result["status"] == "blocked" and result["commit"]
    assert git(repo, "rev-parse", "HEAD") == initial


def test_conflicting_completed_sessions_keep_first_integration(queue):
    service, repo = queue
    first, second = service.begin("first"), service.begin("second")
    for row in [first, second]:
        (Path(row["path"]) / "existing.txt").write_text(row["name"] + "\n")
        service.ready(row["id"])
    service.tick()
    result = service.tick()
    assert [x["status"] for x in result["entries"]] == ["integrated", "blocked"]
    assert (repo / "existing.txt").read_text() == "first\n"
    assert result["entries"][1]["commit"]


def test_resume_withdraws_handoff_and_crash_is_visible(queue):
    service, repo = queue
    row = service.begin("resume", "chat-2")
    service.ready(row["id"])
    service.session_started("chat-2")
    assert service.tick()["entries"][0]["status"] == "working"
    with service.locked() as state:
        state["entries"][0]["status"] = "checking"
        service.save(state)
    assert service.tick()["entries"][0]["status"] == "blocked"


def test_disabled_and_environment_isolation(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_INTERNAL_TOKEN", "fixture-sensitive")
    monkeypatch.setenv("GIT_INDEX_FILE", "fixture-index")
    monkeypatch.setenv("UWE_WORKSPACE", "fixture-workspace")
    assert not set(environment()) & {"AGENT_INTERNAL_TOKEN", "GIT_INDEX_FILE", "UWE_WORKSPACE"}
    assert SourceWork(tmp_path).tick() == {"enabled": False, "entries": []}
    assert not (tmp_path / "source-work").exists()


def test_independent_runtime_holds_cannot_release_each_other():
    from core.runtime import Runtime
    runtime = Runtime.__new__(Runtime)
    runtime._frozen = False
    runtime.restore_hold = True
    runtime.update_hold = True
    runtime.update_hold = False
    runtime.frozen = False
    assert runtime.frozen
    runtime.update_hold = True
    runtime.restore_hold = False
    runtime.frozen = False
    assert runtime.frozen
    runtime.update_hold = False
    assert not runtime.frozen


def test_blocked_reason_names_the_failing_step_output(queue):
    service, repo = queue
    row = service.begin("hook-message")
    (Path(row["path"]) / "rejected.txt").write_text("fixture")
    (repo / ".githooks/pre-commit").write_text("#!/bin/sh\nif test -f rejected.txt; then echo 'Fixture hook rejected the tree' >&2; exit 1; fi\n")
    (Path(row["path"]) / ".githooks/pre-commit").write_text("#!/bin/sh\nif test -f rejected.txt; then echo 'Fixture hook rejected the tree' >&2; exit 1; fi\n")
    service.ready(row["id"])
    result = service.tick()["entries"][0]
    assert result["status"] == "blocked"
    assert result["reason"] == "Schritt fehlgeschlagen: git commit: Fixture hook rejected the tree"


def test_prune_closes_contained_entries_and_keeps_unintegrated_work(queue):
    service, repo = queue
    done = service.begin("done")
    (Path(done["path"]) / "done.txt").write_text("done\n")
    service.ready(done["id"])
    assert service.tick()["entries"][0]["status"] == "integrated"
    later = service.begin("later")
    (Path(later["path"]) / "later.txt").write_text("later\n")
    service.ready(later["id"])
    assert service.tick()["entries"][1]["status"] == "integrated"
    empty = service.begin("empty-blocked")
    with service.locked() as state:
        next(x for x in state["entries"] if x["id"] == empty["id"]).update(status="blocked", reason="fixture")
        service.save(state)
    unmerged = service.begin("unmerged")
    (Path(unmerged["path"]) / "keep.txt").write_text("keep\n")
    git(Path(unmerged["path"]), "add", "keep.txt")
    git(Path(unmerged["path"]), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "Local commit")
    with service.locked() as state:
        next(x for x in state["entries"] if x["id"] == unmerged["id"]).update(status="blocked", reason="fixture")
        service.save(state)
    active = service.begin("active")
    (Path(active["path"]) / "draft.txt").write_text("draft")
    orphan = repo / ".verify/source-candidates/orphan"
    git(repo, "worktree", "add", "-b", "candidate/orphan", str(orphan))
    result = service.prune()
    assert result["closed"] == ["done", "empty-blocked"]
    assert [(x["name"], x["reason"]) for x in result["open"]] == [("unmerged", "enthält nicht übernommene Commits"), ("active", "enthält offene Änderungen")]
    assert [x["name"] for x in result["entries"]] == ["later", "unmerged", "active"]
    assert not Path(done["path"]).exists() and not Path(empty["path"]).exists() and not orphan.exists()
    assert Path(unmerged["path"]).exists() and Path(active["path"]).exists()
    branches = git(repo, "branch", "--list", "work/*", "candidate/*")
    assert "work/done-" not in branches and "candidate/orphan" not in branches and "work/unmerged-" in branches
    assert (repo / "done.txt").read_text() == "done\n"
    result = service.discard(unmerged["id"])
    assert result["discarded"] == "unmerged" and [x["name"] for x in result["entries"]] == ["later", "active"]
    assert not Path(unmerged["path"]).exists()


def test_prune_keeps_the_receipt_the_release_service_still_needs(queue):
    service, repo = queue
    row = service.begin("head")
    (Path(row["path"]) / "head.txt").write_text("head\n")
    service.ready(row["id"])
    assert service.tick()["entries"][0]["status"] == "integrated"
    assert service.prune()["closed"] == []
    assert service.status()["entries"][0]["status"] == "integrated"
