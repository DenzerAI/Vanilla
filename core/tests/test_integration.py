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
from datetime import datetime, timedelta, timezone


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
        + (Path(__file__).parent / "worker_fixture.cjs").read_text().replace("process.env.FIXTURE_PROMPT_FILE", json.dumps(str(tmp_path / "prompts.jsonl")))
    )
    fixture_text=binary.read_text()
    fixture_text=fixture_text.replace("\n", "\nif (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.HOME === "+json.dumps(str(tmp_path))+" || process.env.CODEX_HOME === "+json.dumps(str(tmp_path/'foreign-profile'))+") throw Error('Host environment crossed worker boundary');\n",1)
    binary.write_text(fixture_text)
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
        "CODEX_HOME":str(tmp_path/'foreign-profile'),
        "OPENAI_API_KEY":"synthetic-foreign-host-key",
        "ANTHROPIC_API_KEY":"synthetic-foreign-host-key",
    }
    foreign=tmp_path/'foreign-profile';foreign.mkdir()
    (foreign/'auth.json').write_text('{"sentinel":"synthetic-foreign-host-login"}')
    (foreign/'AGENTS.md').write_text('Synthetic foreign instructions must not be imported.')
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
        receipt=next(n for n in call('/notifications')['items'] if n['id']==runs[0]['id'])
        assert receipt['body']=='Testantwort aus dem Worker'
        call('/notifications/read',{'id':receipt['id']})
        capability=call('/routines/tool',{'name':'routine_capabilities','arguments':{'projectId':'default'}})
        assert 'once' in capability['schedules']
        args={'projectId':'default','requestKey':'integration-chat-routine','name':'Fiktive Erinnerung','instructions':'Prüfnotiz lesen und kurz zusammenfassen.','schedule':{'type':'once','at':(datetime.now(timezone.utc)+timedelta(seconds=4)).isoformat()}}
        routine=call('/routines/tool',{'name':'routine_create','arguments':args})
        assert routine['created'] and routine['job']['status']=='active'
        assert not call('/routines/tool',{'name':'routine_create','arguments':args})['created']
        for _ in range(150):
            matching=[n for n in call('/notifications')['items'] if n['job_id']==routine['job']['id']]
            if matching:break
            time.sleep(0.1)
        assert len(matching)==1 and matching[0]['status']=='completed', matching
        assert matching[0]['body']=='Testantwort aus dem Worker'
        child.terminate()
        child.wait(timeout=15)
        start()
        assert next(n for n in call('/notifications')['items'] if n['id']==receipt['id'])['read_at']
        assert len([n for n in call('/notifications')['items'] if n['job_id']==routine['job']['id']])==1
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


def test_restart_button_with_idle_listener_and_rollback(integration_root):
    """Exercise the real core/adapter HTTP loop with a synthetic local listener."""
    root = Path(__file__).resolve().parents[2]
    folder = integration_root
    company = folder/'company'
    company.mkdir()
    (company/'AGENTS.md').write_text('# Test')
    (company/'FIRMA.md').write_text('# Synthetic')
    port, adapter_port, listener_port = free_port(), free_port(), free_port()
    env = {'PATH':os.environ['PATH'], 'HOME':str(folder), 'UWE_PORT':str(port),
           'AGENT_ADAPTER_PORT':str(adapter_port), 'UWE_WORKSPACE':str(folder/'workspace'),
           'UWE_DATA_ROOT':str(folder/'data'), 'COMPANY_BASE':str(company),
           'UWE_CODEX_BINARY':'/usr/bin/false', 'UWE_HERMES_BINARY':'/usr/bin/false'}
    with (folder/'restart.log').open('w+') as log:
        child = subprocess.Popen([sys.executable,'-m','core'],cwd=root,env=env,stdout=log,stderr=log)
        client = httpx.Client(base_url=f'http://127.0.0.1:{port}/api',trust_env=False,timeout=20)
        def ready(previous=None):
            for _ in range(200):
                try:
                    status = client.get('/updates').json()
                    if status.get('instanceId') and status['instanceId'] != previous:
                        client.headers['x-uwe-token'] = client.get('/auth/session').json()['token']
                        return status
                except (httpx.HTTPError,ValueError): pass
                time.sleep(.1)
            log.flush()
            raise AssertionError((folder/'restart.log').read_text()[-8000:])
        def post(path, body):
            response=client.post(path,json=body)
            assert response.status_code == 200, response.text
            return response.json()
        try:
            first=ready()
            connection=post('/services/save',{'provider':'a2a','worker':'auto','projectId':'default',
                'config':{'mode':'server','host':'127.0.0.1','port':listener_port},
                'credentials':{'token':'synthetic-token-at-least-24-chars'}})
            # save returns the public connection directly.
            id=connection['id']
            post('/services/start',{'id':id})
            # Restore/backup remains strict even though ordinary restart pauses listeners.
            strict=client.post('/system/backup-hold',json={'hold':True})
            assert strict.status_code == 400, strict.text
            presence='00000000-0000-0000-0000-000000000001'
            post('/updates/presence',{'id':presence,'active':True})
            busy=client.post('/system/restart',json={})
            assert busy.status_code == 400, busy.text
            post('/updates/presence',{'id':presence,'active':False})
            held=post('/system/update-hold',{'hold':True})
            rejected=client.post('/system/restart',json={})
            assert rejected.status_code == 400, rejected.text
            post('/system/update-hold',{'hold':False,'channels':held['channels']})
            # The actual banner calls the adapter, which calls back into the core.
            assert post('/updates/restart',{})['restarting']
            second=ready(first['instanceId'])
            assert not second['restartRequired']
            for _ in range(100):
                connections=client.get('/services').json()['connections']
                if any(c['id']==id and c.get('runtimeActive') for c in connections):break
                time.sleep(.1)
            else: raise AssertionError('Listener was not restored')
            assert post('/system/restart',{})['restarting']
            third=ready(second['instanceId'])
            assert not third['restartRequired']
        finally:
            client.close()
            child.terminate()
            try: child.wait(timeout=20)
            except subprocess.TimeoutExpired:
                child.kill();child.wait(timeout=5)
