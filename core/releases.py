"""Public, bounded release discovery. A manifest never supplies executable commands."""
from __future__ import annotations

import hashlib
import base64
import json
import platform
import re
import sys
from datetime import datetime
from urllib.parse import quote, urlsplit

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .github import API, ORIGIN, GitHubError

SHA = r"^[0-9a-f]{40}$"
VERSION = r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$"
WORKFLOWS = {"source-privacy.yml", "functionality.yml", "design.yml"}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Requirements(Strict):
    updater: int = Field(ge=1, le=1)
    platforms: list[str] = Field(min_length=1, max_length=3)
    python: str = Field(pattern=r"^3\.[0-9]+$")
    node: int = Field(ge=22, le=99)


class Module(Strict):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,79}$")
    version: int = Field(ge=1)
    dependencies: list[str]


class Check(Strict):
    workflow: str
    runId: int = Field(gt=0)
    commit: str = Field(pattern=SHA)


class Rollback(Strict):
    compatible: bool
    fromVersions: list[str] = Field(max_length=100)


class Manifest(Strict):
    schemaVersion: int = Field(ge=1, le=1)
    releaseId: int = Field(gt=0)
    version: str = Field(pattern=VERSION, max_length=60)
    repository: str
    tag: str = Field(pattern=r"^v[0-9]+\.[0-9]+\.[0-9]+$", max_length=61)
    commit: str = Field(pattern=SHA)
    publishedAt: str = Field(max_length=40)
    summary: str = Field(min_length=1, max_length=500)
    changes: list[str] = Field(max_length=100)
    requirements: Requirements
    modules: list[Module] = Field(min_length=1, max_length=500)
    migrations: list[str] = Field(max_length=100)
    rollback: Rollback
    checks: list[Check] = Field(min_length=3, max_length=10)


def validate_manifest(data, release):
    try:
        m = Manifest.model_validate(data)
        published = datetime.fromisoformat(m.publishedAt.replace("Z", "+00:00"))
    except (ValidationError, ValueError, TypeError):
        raise ValueError("Versionsdatei ungültig oder vom Updater noch nicht unterstützt.") from None
    if m.repository != ORIGIN or m.releaseId != release.get("id") or m.tag != release.get("tag_name") or m.tag != "v" + m.version:
        raise ValueError("Version, Quelle und Veröffentlichung passen nicht zusammen.")
    if release.get("draft") or release.get("prerelease") or not release.get("published_at") or published.tzinfo is None:
        raise ValueError("Diese Version ist nicht freigegeben.")
    if any(len(c) > 1000 for c in m.changes) or len({mod.id for mod in m.modules}) != len(m.modules):
        raise ValueError("Versionsdatei enthält unklare Änderungen oder doppelte Module.")
    if (any(v != "development" and not re.fullmatch(VERSION, v) for v in m.rollback.fromVersions)
            or set(m.requirements.platforms) - {"darwin", "linux"}
            or any(set(mod.dependencies) - {entry.id for entry in m.modules} for mod in m.modules)):
        raise ValueError("Voraussetzungen und Modulabhängigkeiten der Version sind unvollständig.")
    if {c.workflow for c in m.checks} != WORKFLOWS or len(m.checks) != len(WORKFLOWS) or any(c.commit != m.commit for c in m.checks):
        raise ValueError("Pflichtprüfungen sind nicht eindeutig an den Quellstand gebunden.")
    return m.model_dump()


def compatibility(manifest, installed_version, node_major):
    r = manifest["requirements"]
    if platform.system().lower() not in r["platforms"]:
        return "Diese Version unterstützt das Betriebssystem dieser Installation nicht."
    if sys.version_info[:2] < tuple(map(int, r["python"].split("."))) or node_major < r["node"]:
        return "Die Laufzeit muss vor diesem Update aktualisiert werden."
    if manifest["migrations"] or not manifest["rollback"]["compatible"]:
        return "Diese Version benötigt eine gesondert geprüfte Datenmigration. Betreuer einbeziehen."
    if not installed_version and "development" not in manifest["rollback"]["fromVersions"]:
        return "Der bisherige Entwicklungsstand benötigt zunächst eine geprüfte Erstübernahme nach UPDATE.md."
    if installed_version and installed_version not in manifest["rollback"]["fromVersions"]:
        return "Für diesen Ausgangsstand ist ein Zwischenschritt erforderlich."
    return ""


class Releases:
    def __init__(self, github):
        self.github = github

    async def asset(self, asset_id):
        url = f"{API}/repos/{ORIGIN}/releases/assets/{asset_id}"
        try:
            for _ in range(3):
                async with self.github.client.stream("GET", url, headers={"Accept": "application/octet-stream", "User-Agent": "Vanilla"}) as response:
                    if response.status_code in {301, 302, 307, 308}:
                        url = response.headers.get("location", "")
                        parsed = urlsplit(url)
                        if parsed.scheme != "https" or parsed.hostname not in {"release-assets.githubusercontent.com", "objects.githubusercontent.com"} or parsed.username or parsed.password or parsed.port not in {None, 443}:
                            raise ValueError("Versionsdatei verweist auf eine unerlaubte Quelle.")
                        continue
                    if response.status_code != 200:
                        raise GitHubError("Versionsdatei konnte nicht geladen werden.", response.status_code)
                    raw = bytearray()
                    async for part in response.aiter_bytes():
                        raw.extend(part)
                        if len(raw) > 131072:
                            raise ValueError("Versionsdatei ist zu groß.")
                    try:
                        return json.loads(raw), hashlib.sha256(raw).hexdigest()
                    except ValueError:
                        raise ValueError("Versionsdatei ist kein gültiges JSON.") from None
            raise ValueError("Versionsdatei enthält zu viele Weiterleitungen.")
        except httpx.HTTPError:
            raise GitHubError("Versionsdatei ist gerade nicht erreichbar.") from None

    async def verify(self, m):
        # Resolve lightweight and annotated tags, with a finite dereference limit.
        obj = await self.github.request("GET", f"/repos/{ORIGIN}/git/ref/tags/{quote(m['tag'], safe='')}", authenticated=False)
        obj = obj.get("object", {})
        for _ in range(5):
            if obj.get("type") != "tag":
                break
            if not re.fullmatch(SHA, obj.get("sha", "")):
                raise ValueError("GitHub hat einen ungültigen Versionsverweis geliefert.")
            tag = await self.github.request("GET", f"/repos/{ORIGIN}/git/tags/{obj['sha']}", authenticated=False)
            obj = tag.get("object", {})
        if obj.get("type") != "commit" or obj.get("sha") != m["commit"]:
            raise ValueError("Versionsverweis wurde geändert oder passt nicht zum geprüften Stand.")
        registered = await self.github.request("GET", f"/repos/{ORIGIN}/contents/system/modules.json?ref={m['commit']}", authenticated=False)
        try:
            if registered.get("encoding") != "base64":
                raise ValueError()
            modules = json.loads(base64.b64decode(registered["content"]))["modules"]
            expected = [{k: entry[k] for k in ("id", "version", "dependencies")} for entry in modules]
            if sorted(expected, key=lambda entry: entry["id"]) != sorted(m["modules"], key=lambda entry: entry["id"]):
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise ValueError("Versionsdatei und Modulregister am freigegebenen Commit stimmen nicht überein.") from None
        product = await self.github.request("GET", f"/repos/{ORIGIN}/contents/system/version.json?ref={m['commit']}", authenticated=False)
        try:
            if product.get("encoding") != "base64" or json.loads(base64.b64decode(product["content"]))["version"] != m["version"]:
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise ValueError("Freigabe und Produktversion im Quellcode stimmen nicht überein.") from None
        for check in m["checks"]:
            run = await self.github.request("GET", f"/repos/{ORIGIN}/actions/runs/{check['runId']}", authenticated=False)
            if (run.get("head_sha") != m["commit"] or run.get("conclusion") != "success" or run.get("status") != "completed"
                    or run.get("repository", {}).get("full_name") != ORIGIN
                    or run.get("head_repository", {}).get("full_name") != ORIGIN
                    or run.get("path", "").split("@")[0] != ".github/workflows/" + check["workflow"]
                    or run.get("event") not in {"push", "workflow_dispatch"}):
                raise ValueError("Die erforderlichen GitHub-Prüfungen sind für diesen Stand nicht erfolgreich bestätigt.")
            if check["workflow"] == "functionality.yml":
                jobs = await self.github.request("GET", f"/repos/{ORIGIN}/actions/runs/{check['runId']}/jobs?filter=latest&per_page=100", authenticated=False)
                verified = {j.get("name") for j in jobs.get("jobs", []) if j.get("status") == "completed" and j.get("conclusion") == "success"}
                if jobs.get("total_count", 0) > 100 or not {"customer-base (ubuntu-latest)", "customer-base (macos-latest)", "update-sandbox"} <= verified:
                    raise ValueError("Die Funktionstests auf Linux und macOS sind nicht vollständig bestätigt.")

    async def latest(self):
        release = await self.github.request("GET", f"/repos/{ORIGIN}/releases/latest", authenticated=False, missing=True, cache_key="updates/release-cache")
        if release is None:
            return None
        assets = [a for a in release.get("assets", []) if a.get("name") == "vanilla-release.json"]
        if len(assets) != 1 or not isinstance(assets[0].get("id"), int) or not 0 < assets[0].get("size", 0) <= 131072:
            raise ValueError("Die neueste Veröffentlichung hat noch keine gültige Versionsdatei.")
        data, digest = await self.asset(assets[0]["id"])
        m = validate_manifest(data, release)
        await self.verify(m)
        return {"manifest": m, "digest": digest}
