"""Publish an exact, CI-verified origin commit. No moving branch is an update."""
from __future__ import annotations

import asyncio
import hashlib
import json
import platform
from datetime import datetime, timezone

from .github import ORIGIN
from .releases import WORKFLOWS, validate_manifest
from .update_source import Source, git


async def publish(updates, version, summary, changes, from_versions):
    github = updates.github
    async with updates.lock, github.oauth_lock:
        if updates.contributions.settings()["role"] != "origin" or (await github.check(write=True))["name"] != ORIGIN:
            raise ValueError("Veröffentlichen benötigt eingerichtete Ursprungsrechte.")
        if git(updates.config.root, "status", "--porcelain"):
            raise ValueError("Zuerst den vollständigen Code sichern, pushen und prüfen lassen.")
        source = await asyncio.to_thread(Source(updates.config).read)
        declared = json.loads(source["files"]["system/version.json"])["version"]
        if version != declared:
            raise ValueError("Die Freigabe muss zur Produktversion in system/version.json passen. Versionsänderung zuerst sichern, pushen und prüfen lassen.")
        head = await github.request("GET", f"/repos/{ORIGIN}/commits/main", authenticated=False)
        if head.get("sha") != source["head"]:
            raise ValueError("Nur der aktuelle vollständig geprüfte Ursprungsstand kann freigegeben werden.")
        checks = []
        for workflow in sorted(WORKFLOWS):
            runs = await github.request("GET", f"/repos/{ORIGIN}/actions/workflows/{workflow}/runs?head_sha={source['head']}&per_page=100", authenticated=False)
            candidates = [r for r in runs.get("workflow_runs", []) if r.get("head_sha") == source["head"] and r.get("event") in {"push", "workflow_dispatch"}]
            current = max(candidates, key=lambda r: (r.get("run_number", 0), r.get("run_attempt", 0)), default={})
            if current.get("status") != "completed" or current.get("conclusion") != "success":
                raise ValueError("Alle Pflichtprüfungen müssen für genau diesen Commit erfolgreich abgeschlossen sein.")
            checks.append({"workflow": workflow, "runId": current["id"], "commit": source["head"]})
        tag = "v" + version
        key = "updates/publication/" + version
        existing = updates.db.get(key)["value"]
        remote = await github.request("GET", f"/repos/{ORIGIN}/releases/tags/{tag}", missing=True)
        if remote:
            if existing and existing.get("state") == "published" and existing.get("releaseId") == remote["id"] and existing.get("commit") == source["head"]:
                return existing
            raise ValueError("Diese Version existiert bereits. Veröffentlichungsstand prüfen; keine zweite Freigabe.")
        if existing:
            raise ValueError("Für diese Version besteht bereits ein Veröffentlichungsauftrag. Bestätigung vor erneutem Schreiben klären.")
        latest = await updates.releases.latest()
        if latest and tuple(map(int, version.split("."))) <= tuple(map(int, latest["manifest"]["version"].split("."))):
            raise ValueError("Die neue Produktversion muss höher als die bisherige Freigabe sein.")
        record = {"state": "publishing", "version": version, "commit": source["head"], "tag": tag}
        manifest = {"schemaVersion": 1, "releaseId": 1, "version": version, "repository": ORIGIN, "tag": tag,
                    "commit": source["head"], "publishedAt": datetime.now(timezone.utc).isoformat(), "summary": summary, "changes": changes,
                    "requirements": {"updater": 1, "platforms": ["darwin", "linux"], "python": "3.12", "node": 22},
                    "modules": [{k: m[k] for k in ("id", "version", "dependencies")} for m in source["modules"]],
                    "migrations": [], "rollback": {"compatible": True, "fromVersions": from_versions}, "checks": checks}
        validate_manifest(manifest, {"id": 1, "tag_name": tag, "published_at": manifest["publishedAt"], "draft": False})
        updates.db.put(key, record)
        try:
            ref = await github.request("GET", f"/repos/{ORIGIN}/git/ref/tags/{tag}", missing=True)
            if ref and ref.get("object", {}).get("sha") != source["head"]:
                raise ValueError("Versionsverweis zeigt auf einen anderen Commit.")
            if not ref:
                await github.request("POST", f"/repos/{ORIGIN}/git/refs", body={"ref": "refs/tags/" + tag, "sha": source["head"]})
            release = await github.request("POST", f"/repos/{ORIGIN}/releases", body={"tag_name": tag, "target_commitish": source["head"], "name": "Vanilla " + version, "body": summary + "\n\n" + "\n".join("- " + c for c in changes), "draft": True, "prerelease": False})
            record["releaseId"] = release["id"]
            updates.db.put(key, record)
            manifest["releaseId"] = release["id"]
            validate_manifest(manifest, {**release, "draft": False, "published_at": manifest["publishedAt"]})
            await updates.releases.verify(manifest)
            raw = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
            code, asset, _ = await github.response("POST", f"https://uploads.github.com/repos/{ORIGIN}/releases/{release['id']}/assets?name=vanilla-release.json",
                headers={**github.headers(await github.token()), "Content-Type": "application/json"}, content=raw)
            if code != 201 or asset.get("name") != "vanilla-release.json":
                raise ValueError("Die Versionsdatei wurde nicht bestätigt. Veröffentlichung bleibt ungeklärt.")
            record["manifestHash"] = hashlib.sha256(raw).hexdigest()
            updates.db.put(key, record)
            await github.request("PATCH", f"/repos/{ORIGIN}/releases/{release['id']}", body={"draft": False})
            confirmed = await updates.releases.latest()
            if not confirmed or confirmed["digest"] != record["manifestHash"]:
                raise ValueError("Die veröffentlichte Version ist noch nicht eindeutig bestätigt.")
            record["state"] = "published"
            updates.db.put(key, record)
            updates.save(release=confirmed, error="")
            return record
        except Exception:
            updates.db.put(key, {**record, "state": "unknown"})
            raise
