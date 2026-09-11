"""Independent, installation-scoped macOS operator. Its copied entry uses stdlib only."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import plistlib
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen


def write(file, value):
    file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = file.with_suffix(file.suffix + ".new")
    with temp.open("w") as stream:
        os.chmod(temp, 0o600)
        json.dump(value, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, file)


def read(file, default=None):
    return json.loads(file.read_text()) if file.is_file() else default


def hash_file(file):
    h = hashlib.sha256()
    with file.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def matches_source(root, inventory):
    return all(not (root / name).is_symlink() and (root / name).is_file()
               and hash_file(root / name) == info["sha256"]
               and ("100755" if (root / name).stat().st_mode & 0o111 else "100644") == info["mode"]
               for name, info in inventory.items())


def build_digest(root):
    digest = hashlib.sha256()
    for name in sorted(tree_files(root / "wrapper/dist")):
        digest.update(name.encode() + b'\0' + (root / "wrapper/dist" / name).read_bytes() + b'\0')
    return digest.hexdigest()


def seal_installed(root, data, request):
    """Called only after the durable commit decision, before resuming work."""
    seal = {"revision": request["candidate"]["commit"], "build_sha256": build_digest(root)}
    write(root / ".verify/build.json", seal)
    activation = read(data / "services/host-activation.json", {})
    write(data / "services/host-activation.json", {**activation, **seal, "updateId": request["id"]})
    operator = data / "updates/operator/operator.py"
    operator.parent.mkdir(parents=True, exist_ok=True)
    temp = operator.with_suffix(".new")
    shutil.copy2(root / "core/update_operator.py", temp)
    os.replace(temp, operator)
    profile = read(data / "updates/operator.json", {})
    write(data / "updates/operator.json", {**profile, "operatorHash": hash_file(operator)})


def tree_files(root, exclude=()):
    result = {}
    if not root.exists():
        return result
    if root.is_symlink():
        raise ValueError("Externe Datenverknüpfung benötigt einen eigenen Wiederherstellungsweg.")
    for parent, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if (Path(parent) / d).resolve() not in exclude)
        for name in dirs + sorted(files):
            p = Path(parent) / name
            if p.resolve() in exclude:
                continue
            if p.is_symlink():
                raise ValueError("Datenverknüpfungen müssen vor einem automatischen Update zugeordnet werden.")
            if p.is_file():
                result[p.relative_to(root).as_posix()] = {"sha256": hash_file(p), "size": p.stat().st_size}
    return result


def validate_host(config):
    from .service import label
    if sys.platform != "darwin" or not (config.root / ".git").is_dir():
        raise ValueError("Automatische Installation benötigt den eingerichteten macOS-Dienst in einem festen Quellclone.")
    if (not config.data.is_relative_to(config.root / "data") or not config.workspace.is_relative_to(config.root / "workspaces")
            or Path(os.environ.get("COMPANY_BASE", str(config.root / "firmenbasis"))).resolve() != config.root / "firmenbasis"):
        raise ValueError("Abweichende lokale Datenablagen benötigen einen eigens geprüften Betriebsweg.")
    if not (config.data / "services/host-activation.json").is_file():
        raise ValueError("Der unabhängige Betriebsweg ist noch nicht eingerichtet. Betreuer: docs/UPDATES.md beachten.")
    file = Path.home() / "Library/LaunchAgents" / (label(config) + ".plist")
    if file.is_symlink() or not file.is_file():
        raise ValueError("Der installationsgebundene Systemdienst fehlt.")
    plist = plistlib.loads(file.read_bytes())
    if (plist.get("WorkingDirectory") != str(config.root) or plist.get("ProgramArguments") != [str(config.root / ".venv/bin/python"), "-m", "core"]
            or plist.get("EnvironmentVariables", {}).get("UWE_DATA_ROOT") != str(config.data)
            or plist.get("EnvironmentVariables", {}).get("UWE_WORKSPACE") != str(config.workspace)):
        raise ValueError("Die Dienstkonfiguration passt nicht zu dieser Installation.")
    profile = read(config.data / "updates/operator.json", {})
    if any(profile.get(k) != v for k,v in {"schemaVersion": 1, "externalState": "none", "driver": "launchd"}.items()):
        raise ValueError("Der Betreuer muss den Betriebsweg und zusätzliche Datenablagen einmalig prüfen und einrichten.")
    operator = config.data / "updates/operator/operator.py"
    operator_plist = Path.home() / "Library/LaunchAgents" / (label(config) + ".updates.plist")
    if not operator.is_file() or operator.is_symlink() or hash_file(operator) != profile.get("operatorHash") or not operator_plist.is_file() or operator_plist.is_symlink():
        raise ValueError("Der unabhängige Updateoperator fehlt oder wurde verändert. Betriebsweg prüfen.")
    definition = plistlib.loads(operator_plist.read_bytes())
    if definition.get("ProgramArguments") != [str(config.root / ".venv/bin/python"), str(operator), "--watch", str(config.data)]:
        raise ValueError("Updateoperator gehört nicht zu dieser Installation.")
    if subprocess.run(["launchctl", "print", f"gui/{os.getuid()}/{label(config)}.updates"], capture_output=True, timeout=5).returncode:
        raise ValueError("Der unabhängige Updateoperator läuft noch nicht.")
    return {"label": label(config), "plistHash": hash_file(file), "operatorPlistHash": hash_file(operator_plist), "profile": profile}


def backup_probe(config, destination, db):
    """Restore a consistent database and verify every copied standard data file."""
    destination.mkdir(parents=True, exist_ok=False, mode=0o700)
    inventories = {}
    for name in ("workspaces", "firmenbasis"):
        root = config.root / name
        files = tree_files(root)
        inventories[name] = files
        if root.exists():
            shutil.copytree(root, destination / name)
            if tree_files(destination / name) != files or tree_files(root) != files:
                raise ValueError("Der Bestand wurde während der Wiederherstellungsprobe verändert. Erneut vorbereiten.")
    db.backup(destination / "database.sqlite3")
    with sqlite3.connect(destination / "database.sqlite3") as cx:
        if cx.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Die Datenbank lässt sich nicht konsistent wiederherstellen.")
    # Copy the remaining local data, including encrypted vault files and key material.
    # The active SQLite file has its own consistent backup above.
    excluded = {(config.data / "updates").resolve()}
    excluded.update((config.data / ("agent.sqlite3" + suffix)).resolve() for suffix in ("", "-wal", "-shm", ".lock"))
    files = tree_files(config.root / "data", excluded)
    for name, info in files.items():
        source, target = config.root / "data" / name, destination / "data" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if hash_file(target) != info["sha256"] or hash_file(source) != info["sha256"]:
            raise ValueError("Lokale Daten wurden während der Wiederherstellungsprobe geändert. Erneut vorbereiten.")
    inventories["data"] = files
    return {"verifiedAt": time.time(), "databaseHash": hash_file(destination / "database.sqlite3"),
            "inventoryHash": hashlib.sha256(json.dumps(inventories, sort_keys=True).encode()).hexdigest()}


async def request_install(config, runtime, updates, run):
    import asyncio
    import secrets
    from .update_source import Source, digest, git
    host = await asyncio.to_thread(validate_host, config)
    if host != run["host"]:
        raise ValueError("Dienstkonfiguration wurde verändert. Erneut vorbereiten.")
    directory = config.data / "updates" / run["id"]
    candidate = directory / "candidate"
    if git(config.root, "status", "--porcelain"):
        raise ValueError("Der laufende Quellclone enthält ungesicherte Änderungen. Zuerst im eigenen Repository sichern.")
    if git(candidate, "rev-parse", "HEAD").decode().strip() != run["candidate"]["commit"] or git(candidate, "status", "--porcelain"):
        raise ValueError("Der geprüfte Kandidat wurde verändert. Erneut vorbereiten.")
    # This v1 operator deliberately does not replace dependency environments.
    from .update_checks import DEPENDENCIES
    if any((config.root / n).read_bytes() != (candidate / n).read_bytes() for n in DEPENDENCIES):
        raise ValueError("Laufzeitabhängigkeiten wurden verändert. Neuer Betriebsweg erforderlich.")
    before = (await asyncio.to_thread(Source(config).read))["inventory"]
    after = (await asyncio.to_thread(Source(config).candidate_source(candidate, run["release"]["manifest"]["commit"]).read))["inventory"]
    build = tree_files(candidate / "wrapper/dist")
    if digest(before) != run["sourceHash"] or digest(after) != run["candidateHash"] or digest(build) != run["buildHash"]:
        raise ValueError("Der freigegebene Code- oder Buildbestand wurde verändert.")
    if not build or not (candidate / "wrapper/dist/version.json").is_file():
        raise ValueError("Der geprüfte Oberflächenbuild fehlt.")
    free = shutil.disk_usage(config.root).free
    size = sum(v["size"] for v in tree_files(config.root / "data", ((config.data / "updates").resolve(),)).values())
    size += sum(v["size"] for v in tree_files(config.root / "workspaces").values())
    if free < size * 2 + 2 * 1024**3:
        raise ValueError("Für Sicherung und Rückkehr ist nicht genügend freier Speicher vorhanden.")
    nonce = secrets.token_urlsafe(32)
    request = {"schemaVersion": 1, "id": run["id"], "root": str(config.root), "data": str(config.data), "workspace": str(config.workspace),
               "port": config.port, "host": host, "sourceCommit": run["sourceCommit"], "candidate": run["candidate"],
               "before": before, "after": after, "build": build, "approvalHash": run["approvalHash"], "nonce": nonce,
               "state": "approved", "version": run["release"]["manifest"]["version"], "approvedAt": time.time(),
               "sourceHash": run["sourceHash"], "candidateHash": run["candidateHash"], "buildHash": run["buildHash"]}
    # Only this application is stopped. A copied stdlib operator survives source swaps.
    shutil.copy2(Path(__file__), directory / "operator.py")
    write(directory / "install.json", request)
    async with runtime.maintenance_lock:
        runtime.update_hold = runtime.frozen = True
        try:
            if await runtime.has_active_work():
                raise ValueError("Neue Arbeit ist hinzugekommen. Nach Abschluss erneut installieren.")
            if config.start_adapter:
                paused = await runtime.request("POST", "/api/system/update-hold", json={"hold": True})
                request["channels"] = paused["channels"]
                write(directory / "install.json", request)
            write(config.data / "updates/maintenance.json", {"id": run["id"], "nonce": nonce})
            updates.journal(run, state="installing", phase="Sicherung und Umstellung", approval={"hash": run["approvalHash"], "at": time.time()})
            write(config.data / "updates/pending.json", {"id": run["id"]})
        except BaseException:
            (config.data / "updates/maintenance.json").unlink(missing_ok=True)
            runtime.update_hold = runtime.frozen = False
            if config.start_adapter:
                await runtime.request("POST", "/api/system/update-hold", json={"hold": False, "channels": request.get("channels", [])})
            updates.journal(run, state="ready", approval=None, error="Der Operator konnte nicht gestartet werden. Betriebsweg prüfen.")
            raise
    return updates.status()


def command(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)


def control(request, action):
    body = json.dumps({"action": action, "id": request["id"]}).encode()
    req = Request(f"http://127.0.0.1:{request['port']}/internal/update-operator", data=body,
                  headers={"Content-Type": "application/json", "x-agent-update": request["nonce"]})
    with urlopen(req, timeout=20) as response:
        return json.load(response)


def operate(file):
    request = read(file)
    root, data = Path(request["root"]).resolve(), Path(request["data"]).resolve()
    directory = file.parent.resolve()
    if request.get("schemaVersion") != 1 or directory != data / "updates" / request["id"] or not data.is_relative_to(root) or not request.get("approvalHash"):
        raise ValueError("Ungültiger Operatorauftrag.")
    fingerprint = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if (fingerprint(request["before"]) != request["sourceHash"] or fingerprint(request["after"]) != request["candidateHash"]
            or fingerprint(request["build"]) != request["buildHash"]):
        raise ValueError("Operatorinventar wurde verändert.")
    for name in set(request["before"]) | set(request["after"]):
        p = root / name
        if Path(name).is_absolute() or ".." in Path(name).parts or not p.resolve().is_relative_to(root) or Path(name).parts[0] in {"data", "workspaces", "firmenbasis", ".git"}:
            raise ValueError("Operator enthält einen geschützten Zielpfad.")
    with sqlite3.connect(f"file:{data / 'agent.sqlite3'}?mode=ro", uri=True) as cx:
        row = cx.execute("SELECT value FROM records WHERE key=?", ("updates/run/" + request["id"],)).fetchone()
    approved = json.loads(row[0]) if row else {}
    if ((approved.get("approval") or {}).get("hash") != request["approvalHash"] or approved.get("candidateHash") != request["candidateHash"]
            or approved.get("buildHash") != request["buildHash"] or approved.get("sourceHash") != request["sourceHash"]):
        raise ValueError("Die Installation wurde für diesen Bestand nicht freigegeben.")
    owner = (data / "updates/operator.lock").open("a+")
    fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
    name = "local.vanilla.agent." + hashlib.sha256(str(data).encode()).hexdigest()[:10]
    plist = Path.home() / "Library/LaunchAgents" / (name + ".plist")
    if request["host"]["label"] != name or hash_file(plist) != request["host"]["plistHash"]:
        raise ValueError("Dienstdefinition wurde verändert.")
    domain = "gui/" + str(os.getuid())
    candidate, backup = directory / "candidate", directory / "safety"
    status = directory / "operator-state.json"
    current = read(status, {"phase": "approved"})
    def phase(value, **details):
        nonlocal current
        current = {**current, **details, "phase": value, "at": time.time()}
        write(status, current)
    def stop():
        command("launchctl", "bootout", domain + "/" + name)
        # Sole-writer lock confirms that the core and its SQLite connection exited.
        lease = Path(str(data / "agent.sqlite3") + ".lock").open("a+")
        for _ in range(120):
            try:
                fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                lease.close()
                return
            except BlockingIOError:
                time.sleep(0.5)
        raise ValueError("Dienst wurde nicht vollständig beendet.")
    def start():
        if subprocess.run(["launchctl", "print", domain + "/" + name], capture_output=True, timeout=5).returncode:
            command("launchctl", "bootstrap", domain, str(plist))
        for _ in range(90):
            try:
                result = control(request, "health")
                if result.get("ready"):
                    return
            except Exception:
                pass
            time.sleep(1)
        raise ValueError("Neuer Dienst wurde nicht bereit.")
    try:
        decision = read(directory / "decision.json", {})
        if decision.get("phase") == "completed":
            phase("installed" if decision.get("action") == "commit" else "restored")
            return
        if decision.get("phase") == "decided":
            # Forward recovery only: external channels may already have resumed.
            start()
            control(request, decision["action"])
            phase("installed" if decision["action"] == "commit" else "restored")
            return
        if current["phase"] in {"installed", "restored"}:
            return
        recovering = current["phase"] not in {"approved", "stopped", "backing-up", "backed-up"}
        if current["phase"] == "approved":
            control(request, "quiesce")
            stop()
            phase("stopped")
        if current["phase"] in {"stopped", "backing-up"}:
            phase("backing-up")
            if backup.exists():
                shutil.rmtree(backup)
            backup.mkdir(mode=0o700)
            for folder in ("data", "workspaces", "firmenbasis", ".git", "wrapper/dist"):
                source = root / folder
                if source.exists():
                    # Exclude only this update coordinator, which must survive rollback.
                    def ignore(parent, names):
                        return [n for n in names if (Path(parent) / n).resolve() == data / "updates"]
                    shutil.copytree(source, backup / folder, ignore=ignore)
            if not matches_source(root, request["before"]):
                raise ValueError("Ausgangscode wurde verändert.")
            for name in request["before"]:
                target = backup / "source" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / name, target)
            with sqlite3.connect(backup / data.relative_to(root) / "agent.sqlite3") as cx:
                if cx.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Sicherung nicht lesbar.")
            phase("backed-up", backupHash=hashlib.sha256(json.dumps(tree_files(backup), sort_keys=True).encode()).hexdigest())
        if not recovering:
            if not matches_source(candidate, request["after"]):
                raise ValueError("Kandidat wurde verändert.")
            if tree_files(candidate / "wrapper/dist") != request["build"]:
                raise ValueError("Oberflächenbuild wurde verändert.")
            phase("switching")
            for name in set(request["before"]) - set(request["after"]):
                (root / name).unlink()
            for name in request["after"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(candidate / name, target)
            shutil.rmtree(root / "wrapper/dist")
            shutil.copytree(candidate / "wrapper/dist", root / "wrapper/dist")
            command("git", "-C", str(root), "-c", "core.hooksPath=" + os.devnull, "fetch", str(candidate), request["candidate"]["commit"])
            branch = "refs/heads/vanilla-updates/" + request["id"]
            command("git", "-C", str(root), "update-ref", branch, request["candidate"]["commit"])
            command("git", "-C", str(root), "symbolic-ref", "HEAD", branch)
            command("git", "-C", str(root), "read-tree", request["candidate"]["commit"])
            phase("starting")
            start()
            phase("verified")
            control(request, "commit")
            phase("installed")
            return
        raise ValueError("Unterbrochene Umstellung wird zurückgenommen.")
    except Exception:
        decision = read(directory / "decision.json", {})
        if decision.get("action") == "commit":
            phase("installed" if decision.get("phase") == "completed" else "recovery-required",
                  error="" if decision.get("phase") == "completed" else "Freigabe wurde begonnen. Betriebszustand vor Wiederaufnahme prüfen; keine automatische Rücknahme neuer Daten.")
            return
        if current["phase"] in {"approved", "stopped", "backing-up", "backed-up"}:
            phase("not-installed", error="Umstellung vor dem Austausch angehalten.")
            try:
                start()
                control(request, "restore")
                phase("restored")
            except Exception:
                phase("recovery-required", error="Betriebsweg benötigt Wiederherstellung.")
            return
        try:
            # Stop only if loaded. A power loss may already have left it unloaded.
            loaded = subprocess.run(["launchctl", "print", domain + "/" + name], capture_output=True).returncode == 0
            if loaded:
                stop()
            if hashlib.sha256(json.dumps(tree_files(backup), sort_keys=True).encode()).hexdigest() != current["backupHash"]:
                raise ValueError("Rückkehrkopie wurde verändert.")
            phase("restoring")
            for name in set(request["after"]) - set(request["before"]):
                (root / name).unlink(missing_ok=True)
            for name in request["before"]:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup / "source" / name, root / name)
            for folder in ("workspaces", "firmenbasis", ".git", "wrapper/dist"):
                if (root / folder).exists():
                    shutil.rmtree(root / folder)
                if (backup / folder).exists():
                    shutil.copytree(backup / folder, root / folder)
            # Preserve the operator and journal while restoring application data.
            saved_updates = directory.parent
            for parent, dirs, files in os.walk(root / "data", topdown=True):
                dirs[:] = [d for d in dirs if (Path(parent) / d).resolve() != saved_updates]
                for name in files:
                    (Path(parent) / name).unlink()
            shutil.copytree(backup / "data", root / "data", dirs_exist_ok=True)
            start()
            control(request, "restore")
            phase("restored")
        except Exception:
            phase("recovery-required", error="Automatische Rückkehr nicht bestätigt. Schreibbetrieb bleibt gesperrt.")
    finally:
        owner.close()
        if current["phase"] in {"installed", "restored", "recovery-required"}:
            pending = data / "updates/pending.json"
            if read(pending, {}).get("id") == request["id"]:
                pending.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--request", type=Path)
    group.add_argument("--watch", type=Path)
    args = parser.parse_args()
    if args.request:
        operate(args.request.resolve())
    else:
        data = args.watch.resolve()
        pending = read(data / "updates/pending.json", {})
        id = pending.get("id", "")
        if len(id) == 32 and all(c in "abcdef0123456789" for c in id):
            operate(data / "updates" / id / "install.json")
