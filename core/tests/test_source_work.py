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
