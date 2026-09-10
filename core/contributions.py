"""Explicit private code exchange. Receiving a contribution never executes its code."""
from __future__ import annotations

import asyncio
import base64
import difflib
import hashlib
import json
import re
from datetime import datetime, timezone
from time import time

from .github import ORIGIN, GitHubError
from .update_source import Source, digest


class Contributions:
    def __init__(self, db, config, github):
        self.db, self.config, self.github = db, config, github
        self.lock = asyncio.Lock()

    def settings(self):
        return self.db.get("contributions/settings")["value"] or {"revision": 0, "role": "customer", "agreement": None}

    def list(self):
        rows = self.db.rows("SELECT value FROM records WHERE key LIKE 'contributions/item/%' ORDER BY updated_at DESC LIMIT 100")
        return {"settings": self.settings(), "items": [json.loads(r["value"]) for r in rows]}

    def save(self, item, **changes):
        item = {**item, **changes, "updatedAt": time(), "revision": item.get("revision", 0) + 1}
        self.db.put("contributions/item/" + item["id"], item)
        self.db.event("contribution.changed", item["id"], {})
        return item

    async def configure(self, role, agreed, revision):
        async with self.lock, self.github.oauth_lock:
            s = self.settings()
            if s["revision"] != revision:
                raise ValueError("Die Beitragseinrichtung wurde inzwischen geändert. Erneut laden.")
            repo = await self.github.check(write=True)
            if role == "origin":
                if repo["name"] != ORIGIN:
                    raise ValueError("Ursprungsrechte benötigen Schreibzugriff auf das Vanilla-Ursprungsrepository.")
                agreement = None
            elif role == "customer":
                if not repo["private"] or repo["name"] == ORIGIN:
                    raise ValueError("Beiträge benötigen ein eigenes privates Firmenrepository.")
                agreement = {"version": 1, "repositoryId": repo["id"], "accountId": self.github.settings()["account"]["id"],
                             "scope": "neutral-source-v1", "maintainer": ORIGIN.split("/")[0], "acceptedAt": time()} if agreed else None
                if agreed:
                    await self.maintainer(repo)
            else:
                raise ValueError("Unbekannte Installationsrolle.")
            value = {"revision": s["revision"] + 1, "role": role, "agreement": agreement}
            self.db.put("contributions/settings", value)
            return value

    async def maintainer(self, repo):
        access = await self.github.request("GET", f"/repositories/{repo['id']}/collaborators/{ORIGIN.split('/')[0]}/permission")
        if access.get("permission") not in {"read", "write", "admin", "maintain", "triage"}:
            raise ValueError("Der Vanilla-Betreuer benötigt Lesezugriff auf das private Firmenrepository.")

    async def authorize(self):
        s = self.settings()
        repo = await self.github.check(write=True)
        a = s["agreement"]
        if s["role"] != "customer" or not a or a["repositoryId"] != repo["id"] or a["accountId"] != self.github.settings()["account"]["id"] or not repo["private"]:
            raise ValueError("Zuerst privaten Codeaustausch unter Beiträge einrichten.")
        await self.maintainer(repo)
        return repo

    async def share(self):
        async with self.lock, self.github.oauth_lock:
            repo = await self.authorize()
            snapshot = await asyncio.to_thread(Source(self.config).read)
            id = digest({"repositoryId": repo["id"], "source": snapshot["hash"]})
            previous = self.db.get("contributions/item/" + id)["value"]
            base = previous.get("base") if previous else None
            if not base:
                upstream = await self.github.request("GET", f"/repos/{ORIGIN}/commits/main", authenticated=False)
                if not re.fullmatch(r"[a-f0-9]{40}", upstream.get("sha", "")):
                    raise ValueError("Die gemeinsame öffentliche Codebasis konnte nicht ermittelt werden.")
                base = await asyncio.to_thread(Source(self.config).public_base, snapshot, upstream["sha"], self.config.data / "updates/exchange" / id)
            if not await self.github.request("GET", f"/repositories/{repo['id']}/git/commits/{base}", missing=True):
                raise ValueError("Das private Repository benötigt zuerst die gemeinsame Vanilla-Ausgangsbasis. Einrichtung nach docs/GITHUB.md abschließen.")
            baseline = await self.github.request("GET", f"/repos/{ORIGIN}/git/trees/{base}?recursive=1", authenticated=False)
            reusable = {entry['sha'] for entry in baseline.get('tree', []) if entry.get('type') == 'blob'} if not baseline.get('truncated') else set()
            item = previous or {"id": id, "kind": "outgoing", "repository": repo, "sourceHash": snapshot["hash"],
                                "sourceCommit": snapshot["head"], "createdAt": time(), "state": "prepared", "revision": 0,
                                "ref": "heads/vanilla-share/" + snapshot["hash"], "files": len(snapshot["files"]), "base": base}
            item = self.save(item)
            try:
                existing = await self.github.request("GET", f"/repositories/{repo['id']}/git/ref/{item['ref']}", missing=True)
                if existing:
                    if not item.get("commit") or existing.get("object", {}).get("sha") != item["commit"]:
                        raise ValueError("Die Beitragsreferenz ist unerwartet belegt. Kein Überschreiben.")
                    return self.save(item, state="sent", error="", confirmedAt=time())
                if item["state"] in {"ref-pending", "unknown", "sent"}:
                    # A possibly accepted write must not be repeated automatically.
                    raise ValueError("Übermittlung noch nicht bestätigt. Repository prüfen; keine zweite Übertragung gestartet.")
                tree = []
                for name, raw in snapshot["files"].items():
                    expected = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
                    if expected not in reusable:
                        blob = await self.github.request("POST", f"/repositories/{repo['id']}/git/blobs", body={"encoding": "base64", "content": base64.b64encode(raw).decode()})
                        if blob.get("sha") != expected:
                            raise ValueError("GitHub hat einen abweichenden Codeinhalt bestätigt.")
                    tree.append({"path": name, "mode": snapshot["inventory"][name]["mode"], "type": "blob", "sha": expected})
                remote_tree = await self.github.request("POST", f"/repositories/{repo['id']}/git/trees", body={"tree": tree})
                if not re.fullmatch(r"[a-f0-9]{40}", remote_tree.get("sha", "")):
                    raise ValueError("GitHub hat den Codebaum nicht bestätigt.")
                stamp = datetime.fromtimestamp(item["createdAt"], timezone.utc).isoformat()
                author = {"name": "Vanilla code exchange", "email": "source@example.invalid", "date": stamp}
                commit = await self.github.request("POST", f"/repositories/{repo['id']}/git/commits", body={"message": "Neutral Vanilla source snapshot\n\nVanilla-Base: " + base, "tree": remote_tree["sha"], "parents": [], "author": author, "committer": author})
                if not re.fullmatch(r"[a-f0-9]{40}", commit.get("sha", "")):
                    raise ValueError("GitHub hat den Beitragsstand nicht bestätigt.")
                item = self.save(item, commit=commit["sha"], tree=remote_tree["sha"], state="ref-pending")
                await self.github.request("POST", f"/repositories/{repo['id']}/git/refs", body={"ref": "refs/" + item["ref"], "sha": item["commit"]})
                ref = await self.github.request("GET", f"/repositories/{repo['id']}/git/ref/{item['ref']}")
                if ref.get("object", {}).get("sha") != item["commit"]:
                    raise ValueError("Übermittelter Stand ist noch nicht eindeutig bestätigt.")
                return self.save(item, state="sent", error="", confirmedAt=time())
            except (ValueError, GitHubError):
                self.save(item, state="unknown" if item["state"] == "ref-pending" else item["state"], error="Die Übermittlung ist nicht bestätigt. Verbindung oder Prüfbedarf klären.")
                raise

    async def inbox(self):
        async with self.lock, self.github.oauth_lock:
            if self.settings()["role"] != "origin" or (await self.github.check(write=True))["name"] != ORIGIN:
                raise ValueError("Der Beitragseingang benötigt bestätigte Ursprungsrechte.")
            repositories = (await self.github.repositories())["repositories"]
            new = []
            for repo in repositories:
                if not repo["private"]:
                    continue
                refs = await self.github.request("GET", f"/repositories/{repo['id']}/git/matching-refs/heads/vanilla-share/", missing=True)
                if not isinstance(refs, list):
                    continue
                for ref in refs[:1000]:
                    if not re.fullmatch(r"refs/heads/vanilla-share/[a-f0-9]{64}", ref.get("ref", "")) or not re.fullmatch(r"[a-f0-9]{40}", ref.get("object", {}).get("sha", "")):
                        continue
                    sha = ref["object"]["sha"]
                    id = digest({"repositoryId": repo["id"], "commit": sha})
                    if self.db.get("contributions/item/" + id)["found"]:
                        continue
                    new.append(self.save({"id": id, "kind": "incoming", "repository": repo, "commit": sha,
                                          "ref": ref["ref"][5:], "createdAt": time(), "state": "received"}))
            return new

    async def preview(self, id, *, contents=False):
        async with self.lock, self.github.oauth_lock:
            item = self.db.get("contributions/item/" + id)["value"]
            if not item or item["kind"] != "incoming" or self.settings()["role"] != "origin":
                raise ValueError("Beitrag nicht im eigenen Eingang gefunden.")
            if (await self.github.check(write=True))["name"] != ORIGIN:
                raise ValueError("Ursprungsrechte nicht bestätigt.")
            repo = self.github.repo_summary(await self.github.request("GET", f"/repositories/{item['repository']['id']}"))
            if not repo["private"] or repo["name"] != item["repository"]["name"]:
                raise ValueError("Herkunftsrepository wurde verändert. Zugriff neu klären.")
            commit = await self.github.request("GET", f"/repositories/{repo['id']}/git/commits/{item['commit']}")
            reference = re.fullmatch(r"Neutral Vanilla source snapshot\n\nVanilla-Base: ([a-f0-9]{40})", commit.get("message", ""))
            base = reference[1] if reference and not commit.get("parents") else None
            if base:
                public = await self.github.request("GET", f"/repos/{ORIGIN}/commits/{base}", authenticated=False, missing=True)
                if not public or public.get("sha") != base:
                    base = None
            tree = await self.github.request("GET", f"/repositories/{repo['id']}/git/trees/{item['commit']}?recursive=1")
            if tree.get("truncated") or len(tree.get("tree", [])) > 10000:
                raise ValueError("Beitrag ist für diesen Prüfweg zu groß.")
            source = Source(self.config)
            local = await asyncio.to_thread(source.read)
            scanner = source.guard.Scanner(self.config.root)
            files, modes, total = {}, {}, 0
            for entry in tree.get("tree", []):
                if entry.get("type") == "tree":
                    continue
                name = entry.get("path", "")
                if not source.guard.source_path(name) or entry.get("mode") not in {"100644", "100755"} or not re.fullmatch(r"[a-f0-9]{40}", entry.get("sha", "")):
                    raise ValueError("Beitrag enthält geschützte Pfade oder Verknüpfungen.")
                if not 0 <= entry.get("size", -1) <= 20_000_000:
                    raise ValueError("Beitrag enthält eine ungeeignete Datei.")
                total += entry["size"]
                if total > 200_000_000:
                    raise ValueError("Beitrag überschreitet den Prüfrahmen.")
                blob = await self.github.request("GET", f"/repositories/{repo['id']}/git/blobs/{entry['sha']}")
                if blob.get("encoding") != "base64":
                    raise ValueError("Beitragsinhalt ist nicht eindeutig lesbar.")
                raw = base64.b64decode(blob.get("content", "").replace("\n", ""), validate=True)
                if hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() != entry["sha"]:
                    raise ValueError("Beitragsinhalt stimmt nicht mit seinem Fingerabdruck überein.")
                scanner.entry(name, raw, entry["mode"])
                files[name] = raw
                modes[name] = entry["mode"]
            if scanner.findings:
                raise ValueError("Beitrag enthält ungeprüfte oder möglicherweise vertrauliche Inhalte. Keine Anzeige oder Übernahme.")
            changes, diff, omitted = [], [], False
            for name in sorted(set(local["files"]) | set(files)):
                before, after = local["files"].get(name, b""), files.get(name, b"")
                mode_changed = local["inventory"].get(name, {}).get("mode") != modes.get(name)
                if before == after and not mode_changed:
                    continue
                changes.append(name)
                if len(before) + len(after) < 300000 and b"\0" not in before + after:
                    diff.extend(difflib.unified_diff(before.decode(errors="replace").splitlines(), after.decode(errors="replace").splitlines(), fromfile="Vanilla/" + name, tofile="Beitrag/" + name, n=3))
                else:
                    omitted = True
                if mode_changed:
                    diff.append("Dateimodus " + name + ": " + str(local["inventory"].get(name, {}).get("mode")) + " → " + str(modes.get(name)))
            text = "\n".join(diff)
            result = {"item": item, "files": changes, "diff": text[:200000], "truncated": omitted or len(text) > 200000,
                      "localHash": local["hash"], "moduleCheck": not source.modules.verify(files), "base": base}
            if contents:
                result.update(contents=files, modes=modes, local=local)
            return result

    async def adopt(self, id, revision):
        preview = await self.preview(id, contents=True)
        async with self.lock:
            item = self.db.get("contributions/item/" + id)["value"]
            if not item or item["revision"] != revision or not preview["base"] or not preview["moduleCheck"]:
                raise ValueError("Beitrag wurde geändert oder seine gemeinsame Basis und Module sind noch ungeklärt.")
            if item.get("candidate"):
                return item
            directory = self.config.data / "contributions" / id / "candidate"
            try:
                candidate = await asyncio.to_thread(Source(self.config).contribution, preview["local"], preview["base"], preview["contents"], preview["modes"], directory)
            except ValueError:
                self.save(item, state="needs-review", error="Zusammenführung benötigt Klärung. Eigener Code bleibt unverändert.")
                raise
            return self.save(item, state="adopted", candidate=candidate, localHash=preview["localHash"],
                             error="", note="In separatem Entwicklungszweig vorbereitet. Funktionstests und öffentliche Veröffentlichung bleiben eigenständige Schritte.")

    async def review(self, id, revision, updates):
        preview = await self.preview(id)
        if preview["item"]["revision"] != revision or preview["truncated"]:
            raise ValueError("Beitrag wurde geändert oder der Vergleich überschreitet das Prüfbudget.")
        settings = updates.settings()
        if not settings["worker"] or not settings["model"]:
            raise ValueError("Zuerst unter Version ein Modell für die Agentenprüfung auswählen.")
        async with self.lock:
            item = self.db.get("contributions/item/" + id)["value"]
            if item["revision"] != revision:
                raise ValueError("Beitrag wurde inzwischen geändert.")
            item = self.save(item, state="reviewing")
            try:
                result = await updates.runtime.request("POST", "/api/system/update-review/run", json={"id": id[:32], "worker": settings["worker"], "model": settings["model"],
                    "budgetSeconds": settings["budgetMinutes"] * 60, "text": "Bewerte diesen Beitrag im Vergleich zum aktuellen Vanilla-Code. Benenne nützliche Erweiterungen, Überschneidungen und Risiken. Dies ist keine Installationsfreigabe.\n" + preview["diff"]}, timeout=settings["budgetMinutes"] * 60 + 60)
                if Source(self.config).read()["hash"] != preview["localHash"]:
                    raise ValueError("Vanilla wurde während der Prüfung geändert. Vergleich erneuern.")
                return self.save(item, state="needs-review" if result["report"]["needsChanges"] else "reviewed", review=result["report"],
                                 worker=result["worker"], model=result["model"], effort=result["effort"], localHash=preview["localHash"])
            except BaseException:
                self.save(item, state="needs-review", error="Agentenprüfung nicht abgeschlossen. Vergleich erneut prüfen.")
                raise

    async def decide(self, id, state, revision):
        if state not in {"deferred", "declined"}:
            raise ValueError("Unbekannte Beitragsentscheidung.")
        async with self.lock, self.github.oauth_lock:
            if self.settings()["role"] != "origin" or (await self.github.check(write=True))["name"] != ORIGIN:
                raise ValueError("Diese Entscheidung benötigt Ursprungsrechte.")
            item = self.db.get("contributions/item/" + id)["value"]
            if not item or item.get("kind") != "incoming" or item["revision"] != revision:
                raise ValueError("Beitrag wurde inzwischen geändert. Erneut laden.")
            return self.save(item, state=state)
