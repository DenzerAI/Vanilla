"""Notice once when a build or release step stands still for too long (Klaus, 11.09.2026).

Waiting for the user's pause is not a stall: activation deliberately waits while chats run.
"""
STALL_SECONDS = 15 * 60

PHASES = {
    "queued": "Warteschlange", "checking": "Prüfung", "published": "Veröffentlichung",
    "waiting-for-checks": "GitHub-Prüfungen", "preparing": "Vorbereitung", "verifying": "Prüfung des neuen Stands",
    "verifying-paused": "Prüfung im Wartungsmodus", "backing-up": "Sicherung", "installing": "Installation",
}


UNREPORTED_SECONDS = 30 * 60


def blocked(entries, memory, log_dir=None):
    """Notice once per blocked build and reason, with the tail of its log so the cause is readable in the app."""
    import hashlib
    notices = []
    for entry in entries or []:
        if entry.get("status") != "blocked":
            continue
        reason = (entry.get("reason") or "Grund unbekannt.").strip()
        key = "bau-" + entry["id"] + "-blocked-" + hashlib.sha256(reason.encode()).hexdigest()[:8]
        if memory.get(key):
            continue
        memory[key] = True
        detail = ""
        try:
            if log_dir is not None:
                lines = [x.strip() for x in (log_dir / (entry["id"] + ".log")).read_text(errors="replace").splitlines() if x.strip()]
                detail = " ".join(lines[-4:])[-400:]
        except OSError:
            detail = ""
        body = f"„{entry.get('name') or entry['id']}“ ist in der Kette stehen geblieben: {reason}"
        if detail:
            body += f" Zuletzt im Protokoll: {detail}"
        body += " Nichts davon ist gespeichert oder live. Ursache beheben und erneut mit „ready“ übergeben."
        notices.append((key, "Bauauftrag blockiert", body))
    return notices


def _watched(entries, releases):
    for entry in entries or []:
        if entry.get("status") in {"queued", "checking"}:
            yield ("bau-" + entry["id"] + "-" + entry["status"], entry.get("name") or entry["id"], entry["status"])
    for release in releases or []:
        phase, activation = release.get("phase"), release.get("activationPhase") or ""
        if phase in {"published", "waiting-for-checks"}:
            yield ("release-" + release["target"] + "-" + phase, release["target"][:8], phase)
        elif phase == "activating" and activation not in {"waiting-for-sessions", "live", ""}:
            yield ("release-" + release["target"] + "-" + activation, release["target"][:8], activation)


def stalled(now, entries, releases, memory, limit=STALL_SECONDS):
    """Return new notices as (key, title, body); memory keeps first-seen times between calls."""
    notices, seen = [], set()
    for key, name, phase in _watched(entries, releases):
        seen.add(key)
        first = memory.setdefault(key, now)
        if now - first >= limit and not memory.get(key + ":notified"):
            memory[key + ":notified"] = True
            minutes = int((now - first) // 60)
            notices.append((key, "Bauauftrag hängt",
                            f"„{name}“ steht seit {minutes} Minuten in der Phase „{PHASES.get(phase, phase)}“. Bitte die Kette prüfen."))
    # A started build that never reports ready is the other way work silently gets lost.
    for entry in entries or []:
        if entry.get("status") != "working":
            continue
        key = "bau-" + entry["id"] + "-working"
        seen.add(key)
        started = entry.get("updatedAt") or memory.setdefault(key, now)
        memory.setdefault(key, started)
        if now - memory[key] >= UNREPORTED_SECONDS and not memory.get(key + ":notified"):
            memory[key + ":notified"] = True
            minutes = int((now - memory[key]) // 60)
            notices.append((key, "Bauauftrag nicht bereitgemeldet",
                            f"„{entry.get('name') or entry['id']}“ wurde vor {minutes} Minuten begonnen und ist noch nicht mit „ready“ übergeben. Nichts davon ist gespeichert oder live."))
    for key in [k for k in memory if k.split(":")[0] not in seen]:
        memory.pop(key, None)
    return notices
