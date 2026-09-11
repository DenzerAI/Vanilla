"""Notice once when a build or release step stands still for too long (Klaus, 11.09.2026).

Waiting for the user's pause is not a stall: activation deliberately waits while chats run.
"""
STALL_SECONDS = 15 * 60

PHASES = {
    "queued": "Warteschlange", "checking": "Prüfung", "published": "Veröffentlichung",
    "waiting-for-checks": "GitHub-Prüfungen", "preparing": "Vorbereitung", "verifying": "Prüfung des neuen Stands",
    "verifying-paused": "Prüfung im Wartungsmodus", "backing-up": "Sicherung", "installing": "Installation",
}


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
    for key in [k for k in memory if k.split(":")[0] not in seen]:
        memory.pop(key, None)
    return notices
