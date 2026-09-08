from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from .database import dump

CONTROL_FILES = {
    "message-delivery.json",
    "state.json",
    "workers.json",
    "library.json",
    "channels.json",
    "local-workers.json",
    "speech-settings.json",
    "dictation-settings.json",
}
SAFE_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$")


class ManifestLoader(yaml.SafeLoader):
    pass


# Match the JavaScript YAML reader: ISO timestamps remain strings in job manifests.
ManifestLoader.yaml_implicit_resolvers = {
    key: [
        (tag, regexp) for tag, regexp in rules if tag != "tag:yaml.org,2002:timestamp"
    ]
    for key, rules in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def safe_path(root: Path, relative: str, *, missing=False):
    pieces = Path(relative).parts
    if (
        not pieces
        or Path(relative).is_absolute()
        or any(
            p.startswith(".") or p in {"secrets", "node_modules", "data", "codex"}
            for p in pieces
        )
    ):
        raise ValueError("Geschützter oder ungültiger Pfad.")
    result = root.joinpath(*pieces)
    for parent in [result, *result.parents]:
        if parent == root:
            break
        if parent.is_symlink():
            raise ValueError("Verknüpfungen sind für Wissen nicht freigegeben.")
    resolved = result.resolve(strict=not missing)
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError("Pfad außerhalb des Arbeitsbereichs.")
    return resolved


def valid_record_key(key):
    if key.startswith("control/") and key[8:] in CONTROL_FILES:
        return True
    return bool(
        re.fullmatch(
            r"workspace/(chats/[a-zA-Z0-9_-]+/(transcript|tools)\.json|projects/[a-zA-Z0-9_-]+/project\.json|jobs/[a-zA-Z0-9_-]+/runs/[a-zA-Z0-9_-]+/(request|result)\.json)",
            key,
        )
    )


class Storage:
    def __init__(self, db, config):
        self.db, self.config = db, config
        self.system_jobs = lambda: []

    def import_legacy(self):
        """Import once per record. Originals are never deleted or overwritten."""
        imported = 0
        sources = [
            ("control/" + name, self.config.data / name)
            for name in sorted(CONTROL_FILES)
        ]
        for pattern in (
            "chats/*/transcript.json",
            "chats/*/tools.json",
            "projects/*/project.json",
            "jobs/*/runs/*/request.json",
            "jobs/*/runs/*/result.json",
        ):
            for p in self.config.workspace.glob(pattern):
                sources.append(
                    ("workspace/" + p.relative_to(self.config.workspace).as_posix(), p)
                )
        for key, p in sources:
            if (
                p.is_file()
                and not p.is_symlink()
                and valid_record_key(key)
                and not self.db.get(key)["found"]
            ):
                value = json.loads(p.read_text())
                self.db.put(key, value, only_if_missing=True)
                imported += 1
        self.sync_jobs()
        return imported

    def sync_jobs(self):
        """YAML/Markdown are editable sources; SQLite owns execution state."""
        jobs = []
        for p in sorted(self.config.workspace.glob("jobs/*/job.yaml")):
            if not SAFE_ID.fullmatch(p.parent.name):
                continue
            try:
                manifest = safe_path(
                    self.config.workspace,
                    p.relative_to(self.config.workspace).as_posix(),
                )
                value = yaml.load(manifest.read_text(), Loader=ManifestLoader)
                if not isinstance(value, dict):
                    raise ValueError("Jobdatei muss ein YAML-Objekt enthalten.")
                instructions = safe_path(
                    self.config.workspace,
                    (p.parent / "SKILL.md")
                    .relative_to(self.config.workspace)
                    .as_posix(),
                ).read_text()
                value.update(id=p.parent.name, instructions=instructions)
                schedule = value.get("schedule", {})
                if not value.get("name") or schedule.get("type", "manual") not in {
                    "manual",
                    "daily",
                    "weekdays",
                    "interval",
                    "event",
                }:
                    raise ValueError("Name oder Zeitplan ungültig.")
                if schedule.get("type", "manual") in {"daily", "weekdays"} and not re.fullmatch(
                    r"([01]\d|2[0-3]):[0-5]\d", str(schedule.get("time", ""))
                ):
                    raise ValueError("Uhrzeit ungültig.")
                if schedule.get("type") == "interval" and (type(schedule.get("minutes")) is not int or not 1 <= schedule["minutes"] <= 525600):
                    raise ValueError("Intervall muss zwischen 1 und 525600 Minuten liegen.")
                if schedule.get("type") == "event" and schedule.get("event") not in {"memory.captured", "job.finished", "memory.changed"}:
                    raise ValueError("Unbekannter Ereignisauslöser.")
                retry = value.get("retry", {})
                if (not isinstance(retry, dict)
                    or type(retry.get("count", 0)) is not int
                    or not 0 <= retry.get("count", 0) <= 3
                    or type(retry.get("idempotent", False)) is not bool):
                    raise ValueError("Wiederholungen benötigen count zwischen 0 und 3 sowie idempotent als Wahrheitswert.")
                if value.get("worker") == "python":
                    runner = value.get("python", {})
                    if runner.get("handler", "script") not in {"script", "health", "index", "memory", "backup", "cleanup"}:
                        raise ValueError("Unbekannte Python-Funktion.")
                    if not 1 <= int(runner.get("timeout", 300)) <= 3600:
                        raise ValueError("Laufzeit muss zwischen 1 und 3600 Sekunden liegen.")
                    if not isinstance(runner.get("input", {}), dict):
                        raise ValueError("Python-Eingabe muss ein JSON-Objekt sein.")
            except (
                OSError,
                ValueError,
                TypeError,
                AttributeError,
                yaml.YAMLError,
            ) as error:
                value = {
                    "id": p.parent.name,
                    "name": p.parent.name,
                    "worker": "auto",
                    "status": "invalid",
                    "error": str(error)[:200],
                    "schedule": {"type": "manual"},
                }
            jobs.append(value)
        managed = self.system_jobs()
        jobs = [j for j in jobs if j["id"] not in {s["id"] for s in managed}] + managed
        with self.db.transaction() as cx:
            cx.execute("DELETE FROM jobs")
            for j in jobs:
                cx.execute(
                    "INSERT INTO jobs VALUES(?,?,?,?,?)",
                    (
                        j["id"],
                        j["name"],
                        j.get("worker", "auto"),
                        j.get("status", "paused"),
                        dump(j),
                    ),
                )
        return jobs

    def job(self, id):
        rows = self.db.rows("SELECT manifest FROM jobs WHERE id=?", (id,))
        if not rows:
            raise ValueError("Auftrag nicht gefunden.")
        job = json.loads(rows[0]["manifest"])
        if job["status"] == "invalid":
            raise ValueError("Auftragsdateien sind ungültig. Bitte zuerst bearbeiten.")
        return job
