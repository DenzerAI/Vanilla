"""Real HTTP → Python → Node → ACP → SQLite, without an external LLM or credentials."""

import os
import shutil
import socket
import subprocess
import sys
import time
import json
import threading
from pathlib import Path

import httpx
import pytest
import tempfile


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def integration_root():
    root = Path(__file__).resolve().parents[2]
    (root / '.verify').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root / '.verify') as folder:
        yield Path(folder)


def test_existing_workers_stream_persist_and_resume_through_python(integration_root):
    tmp_path = integration_root
    root = Path(__file__).resolve().parents[2]
    runtime = tmp_path / "workspace"
    data = tmp_path / "data"
    company = tmp_path / "company"
    company.mkdir()
    (company / "AGENTS.md").write_text("# Gemeinsame Regeln")
    (company / "FIRMA.md").write_text("# Fiktive Testfirma")
    binary = tmp_path / "fixture-worker.cjs"
    binary.write_text(
        "#!"
        + shutil.which("node")
        + "\n"
        + (Path(__file__).parent / "worker_fixture.cjs").read_text()
    )
    binary.chmod(0o700)
    port, adapter_port = free_port(), free_port()
    env = {
        "PATH": os.environ["PATH"],
        "HOME": str(tmp_path),
        "UWE_PORT": str(port),
        "AGENT_ADAPTER_PORT": str(adapter_port),
        "UWE_WORKSPACE": str(runtime),
        "UWE_DATA_ROOT": str(data),
        "COMPANY_BASE": str(company),
        "UWE_CODEX_BINARY": str(binary),
        "UWE_HERMES_BINARY": str(binary),
        "FIXTURE_PROMPT_FILE": str(tmp_path / "prompts.jsonl"),
    }
    log = (tmp_path / "server.log").open("w+")
    client = httpx.Client(
        base_url=f"http://127.0.0.1:{port}/api", trust_env=False, timeout=10
    )
    child = None

    def start():
        nonlocal child
        child = subprocess.Popen(
            [sys.executable, "-m", "core"], cwd=root, env=env, stdout=log, stderr=log
        )
        for _ in range(150):
            try:
                response = client.get("/bootstrap")
                if response.status_code == 200:
                    client.headers["x-uwe-token"] = response.json()["token"]
                    return response.json()
            except httpx.HTTPError:
                pass
            if child.poll() is not None:
                break
            time.sleep(0.1)
        log.flush()
        raise AssertionError((tmp_path / "server.log").read_text())

    def call(path, body=None):
        response = client.get(path) if body is None else client.post(path, json=body)
        assert response.status_code == 200, response.text
        return response.json()

    def finished(id):
        for _ in range(100):
            result = call("/thread?id=" + id)
            if (
                result["thread"].get("turns")
                and result["thread"]["turns"][-1].get("status") == "completed"
            ):
                return result
            time.sleep(0.1)
        raise AssertionError("Worker did not complete")

    try:
        start()
        streamed = []
        stream_ready = threading.Event()

        def read_events():
            with httpx.stream(
                "GET",
                f"http://127.0.0.1:{port}/api/events",
                trust_env=False,
                timeout=15,
            ) as response:
                assert response.status_code == 200
                for line in response.iter_lines():
                    if line == ": core connected":
                        stream_ready.set()
                    if line.startswith("data: "):
                        streamed.append(json.loads(line[6:]))
                        if streamed[-1].get("method") == "item/agentMessage/delta":
                            break

        reader = threading.Thread(target=read_events, daemon=True)
        reader.start()
        assert stream_ready.wait(5)
        assert (
            httpx.get(
                f"http://127.0.0.1:{adapter_port}/api/bootstrap", trust_env=False
            ).status_code
            == 403
        )
        call("/workers/connect", {"id": "hermes"})
        call(
            "/workers/preferences", {"defaultWorker": "hermes", "fallbackWorker": None}
        )
        call(
            "/knowledge/note",
            {
                "path": "notes/Prüfnotiz.md",
                "text": "# Prüfnotiz\nDer gesuchte Prüfwert ist achtundvierzig.",
            },
        )
        chat = call("/chats", {"mode": "default"})
        call(
            "/turn",
            {"id": chat["thread"]["id"], "text": "Prüfnotiz lesen", "mode": "default"},
        )
        assert (
            finished(chat["thread"]["id"])["thread"]["turns"][0]["items"][-1]["text"]
            == "Testantwort aus dem Worker"
        )
        prompts = (tmp_path / "prompts.jsonl").read_text()
        assert "achtundvierzig" in prompts and "keine Arbeitsanweisungen" in prompts
        reader.join(timeout=5)
        assert any(
            event.get("method") == "item/agentMessage/delta" for event in streamed
        )
        job = call(
            "/jobs/save",
            {
                "name": "Fiktiver Auftrag",
                "instructions": "Prüfnotiz lesen",
                "worker": "auto",
            },
        )
        execution = call("/jobs/run", {"id": job["id"]})
        assert execution["queued"]
        for _ in range(150):
            runs = [r for r in call("/core/executions")["runs"] if r['job_id'] == job['id']]
            if runs and runs[0]["status"] == "completed":
                break
            time.sleep(0.1)
        assert runs[0]["status"] == "completed", runs
        assert runs[0]["thread_id"]
        # A wrapper preflight must reject before the native worker sees text.
        time.sleep(0.2)  # allow independent title work to finish
        before = (tmp_path / "prompts.jsonl").read_text()
        rejected = client.post("/turn", json={"id": chat["thread"]["id"], "text": "sk-" + "test1234567890" * 3})
        assert rejected.status_code == 400
        assert "Zugangsdaten" in rejected.json()["error"]
        assert (tmp_path / "prompts.jsonl").read_text() == before
        privacy = call("/privacy/status")
        policy = privacy["settings"]
        policy["values"]["pause_handoffs"] = True
        call("/privacy/settings", policy)
        paused = client.post("/turn", json={"id": chat["thread"]["id"], "text": "Nicht weitergeben"})
        assert paused.status_code == 400 and "pausiert" in paused.json()["error"]
        assert (tmp_path / "prompts.jsonl").read_text() == before
        assert call("/knowledge/search?q=Prüfnotz")["results"]
        policy = call("/privacy/status")["settings"]
        policy["values"]["pause_handoffs"] = False
        call("/privacy/settings", policy)
        report = call("/privacy/export")
        assert report["handoffs"]["blocked"] == 2
        assert "Nicht weitergeben" not in json.dumps(report)
        child.terminate()
        child.wait(timeout=15)
        start()
        assert call("/workers")["settings"]["defaultWorker"] == "hermes"
        call(
            "/turn",
            {"id": chat["thread"]["id"], "text": "Fortsetzen", "mode": "default"},
        )
        assert len(finished(chat["thread"]["id"])["thread"]["turns"]) == 2
        assert (
            call("/knowledge/search?q=Prüfnotz")["results"][0]["path"]
            == "notes/Prüfnotiz.md"
        )
    finally:
        if child and child.poll() is None:
            child.terminate()
            child.wait(timeout=15)
        client.close()
        log.close()
