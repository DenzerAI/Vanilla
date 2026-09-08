#!/usr/bin/env python3
"""Local pre-run context, Python 3.9+ / stdlib only; no arguments required.

Reads HERMES_HOME (otherwise ~/.hermes), never writes or sends anything.
stdout is one JSON object. Exit 0 deliberately preserves diagnostic context:
consumers MUST inspect status, not infer success from the process exit code.

Statuses: ok, truncated, missing, missing_response, empty, silent, stale,
error, source_failed. Only ok contains a complete, recent response.
truncated retains the beginning/end and points to the complete log in path.
run_at describes the report, or the newer failed attempt for source_failed;
log_run_at then records the older log's timestamp. Missing jobs.json is
reported separately as job_state_status=missing (not a verified job success).
"""
import json
import os
from pathlib import Path
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

SOURCE_JOB_ID = "9892cfac63a7"
BERLIN = ZoneInfo("Europe/Berlin")


def _collect_log(home, now):
    logs = home / "cron" / "output" / SOURCE_JOB_ID
    result = {"source_job_id": SOURCE_JOB_ID, "path": None, "run_at": None,
              "status": "missing", "response": "Kein Recherchelog vorhanden.", "truncated": False}
    candidates = []
    try:
        entries = list(logs.iterdir())
    except FileNotFoundError:
        return result
    except OSError as exc:
        return dict(result, status="error", response=f"Recherchelog-Verzeichnis nicht lesbar ({type(exc).__name__}).")
    for candidate in entries:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md", candidate.name):
            continue
        try:
            datetime.strptime(candidate.stem, "%Y-%m-%d_%H-%M-%S")
        except ValueError:
            continue
        candidates.append(candidate)
    if not candidates:
        return result
    path = max(candidates, key=lambda p: datetime.strptime(p.stem, "%Y-%m-%d_%H-%M-%S"))
    result["path"] = str(path)
    result["run_at"] = datetime.strptime(path.stem, "%Y-%m-%d_%H-%M-%S").replace(tzinfo=BERLIN).isoformat()
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return dict(result, status="error", response=f"Neueste Logdatei nicht lesbar ({type(exc).__name__}); kein Rückgriff auf ältere Berichte.")
    if not text.strip():
        return dict(result, status="empty", response="Neueste Logdatei ist leer; kein Rückgriff auf ältere Berichte.")
    header = re.split(r"^##[ \t]+", text, maxsplit=1, flags=re.MULTILINE)[0]
    match = re.search(r"^\*\*Run Time:\*\*\s*(.+)$", header, re.MULTILINE)
    run_at = datetime.strptime(path.stem, "%Y-%m-%d_%H-%M-%S")
    if match:
        try:
            run_at = datetime.fromisoformat(match.group(1).strip().replace("Z", "+00:00"))
        except ValueError:
            result["date_warning"] = "Run Time ungültig; Dateiname verwendet."
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=BERLIN)
    result["run_at"] = run_at.astimezone(BERLIN).isoformat()
    # Only standalone, unfenced headings count; quoted/code examples do not.
    matches = []
    fence = None
    offset = 0
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence) and stripped == token:
                fence = None
        elif fence is None and re.fullmatch(r"## Response[ \t]*", line.rstrip("\r\n")):
            matches.append(offset + len(line))
        offset += len(line)
    if not matches:
        return dict(result, status="missing_response", response="Neueste Logdatei enthält keinen Response-Block; kein Rückgriff auf ältere Berichte.")
    response = text[matches[-1]:].strip()
    now = now or datetime.now(BERLIN)
    if now.tzinfo is None:
        now = now.replace(tzinfo=BERLIN)
    age = now.astimezone(timezone.utc) - run_at.astimezone(timezone.utc)
    if age > timedelta(hours=24):
        return dict(result, status="stale", response="Neuester Recherchebericht ist älter als 24 Stunden; nicht als aktuelle Recherche verwenden.")
    if not response:
        return dict(result, status="empty", response="Neuester Response-Block ist leer; kein Rückgriff auf ältere Berichte.")
    if response in {"[SILENT]", "SILENT", "NO_REPLY"}:
        return dict(result, status="silent", response="Der neueste Recherchelauf lieferte nur einen Schweigemarker; kein Bericht verfügbar.")
    if len(response) > 14000:
        notice = f"\n\n[MITTE gekürzt; nicht vollständig. Vollständiger Bericht: {path}]\n\n"
        budget = max(0, 14000 - len(notice))
        beginning = budget // 2
        ending = budget - beginning
        shortened = response[:beginning] + notice + (response[-ending:] if ending else "")
        return dict(result, status="truncated", response=shortened[:14000],
                    truncated=True, original_response_chars=len(response))
    return dict(result, status="ok", response=response)


def collect(home=None, now=None):
    home = Path(home or os.environ.get("HERMES_HOME") or Path.home() / ".hermes").expanduser().absolute()
    result = _collect_log(home, now)
    try:
        return _apply_job_state(home, result)
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, AttributeError) as exc:
        return dict(result, status="error", job_state_status="error", truncated=False,
                    response=f"Quelljob-Status nicht zuverlässig lesbar ({type(exc).__name__}); Aktualität kann nicht bestätigt werden.")


def _apply_job_state(home, result):
    jobs_path = home / "cron" / "jobs.json"
    if not jobs_path.exists():
        return dict(result, job_state_status="missing")
    data = json.loads(jobs_path.read_text(encoding="utf-8"))
    jobs = data["jobs"] if isinstance(data, dict) else data
    source = next((job for job in jobs if job.get("id") == SOURCE_JOB_ID), None)
    if source is None:
        return dict(result, job_state_status="source_not_found")
    result["job_state_status"] = "ok"
    result["source_last_status"] = source.get("last_status")
    result["source_last_run_at"] = source.get("last_run_at")
    if str(source.get("last_status")).lower() in {"failure", "failed", "error"}:
        stamp = source.get("last_run_at")
        latest = datetime.fromisoformat(stamp.replace("Z", "+00:00")) if stamp else None
        if latest is not None and latest.tzinfo is None:
            latest = latest.replace(tzinfo=BERLIN)
        log_at = datetime.fromisoformat(result["run_at"]) if result["run_at"] else None
        if latest is None or log_at is None or latest >= log_at:
            return dict(result, status="source_failed", log_run_at=result["run_at"],
                        run_at=latest.astimezone(BERLIN).isoformat() if latest else None,
                        truncated=False,
                        response="Der letzte Quelljob-Lauf ist fehlgeschlagen; ein vorhandenes älteres Log ist kein aktueller Erfolgsbericht.")
    return result


def main():
    # A machine-readable problem is useful pre-run context, not silent failure.
    try:
        result = collect()
    except Exception as exc:
        result = {"source_job_id": SOURCE_JOB_ID, "path": None, "run_at": None,
                  "status": "error", "truncated": False,
                  "response": f"Recherche-Kontext konnte nicht gelesen werden ({type(exc).__name__})."}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
