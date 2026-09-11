"""GitHub App device authorization, with installation-local, rotating credentials."""
from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
from time import time

import httpx

from .database import dump
from .provider_vault import ProviderVault
from .secrets import register_secret

ORIGIN = "DenzerAI/Vanilla"
API = "https://api.github.com"
LOGIN = "https://github.com/login"
REPOSITORY = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")


class GitHubError(ValueError):
    def __init__(self, message, status=0, retry_after=0):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


class GitHub:
    def __init__(self, db, config, client=None, clock=time):
        self.db, self.config, self.clock = db, config, clock
        self.vault = ProviderVault(config.data / "provider-vault", db, config.root)
        self.client = client or httpx.AsyncClient(timeout=30, trust_env=False, follow_redirects=False)
        self.lock = asyncio.Lock()
        self.oauth_lock = asyncio.Lock()

    def settings(self):
        return self.db.get("github/settings")["value"] or {
            "revision": 0, "clientId": os.getenv("VANILLA_GITHUB_CLIENT_ID", ""),
            "account": None, "repository": None, "error": "", "checkedAt": None,
        }

    def save(self, **values):
        current = self.settings()
        current.update(values)
        current["revision"] += 1
        self.db.put("github/settings", current)
        self.db.event("github.changed", "github", {})
        return current

    def status(self):
        value = self.settings()
        return {**value, "configured": bool(value["clientId"]),
                "connected": bool(value["account"] and self.vault.has("github-account") and not value["error"])}

    async def response(self, method, url, **kwargs):
        try:
            async with self.client.stream(method, url, **kwargs) as response:
                raw = bytearray()
                async for part in response.aiter_bytes():
                    raw.extend(part)
                    if len(raw) > 8 * 1024 * 1024:
                        raise GitHubError("GitHub-Antwort zu groß.")
                try:
                    value = json.loads(raw) if raw else {}
                except ValueError:
                    raise GitHubError("GitHub hat keine gültige Antwort geliefert.") from None
                return response.status_code, value, response.headers
        except httpx.HTTPError:
            raise GitHubError("GitHub ist gerade nicht erreichbar. Später erneut versuchen.") from None

    async def configure(self, client_id, revision):
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,100}", client_id):
            raise ValueError("Bitte die öffentliche Client-ID der GitHub App eingeben.")
        async with self.oauth_lock:
            async with self.lock:
                if revision != self.settings()["revision"]:
                    raise ValueError("GitHub-Einrichtung wurde inzwischen geändert. Erneut öffnen.")
                if client_id != self.settings()["clientId"]:
                    if self.vault.has("github-account"):
                        raise ValueError("Vor einem App-Wechsel die bestehende GitHub-Verbindung trennen.")
                    self.vault.remove("github-device")
                    self.save(clientId=client_id, account=None, repository=None, error="")
        return self.status()

    async def begin(self):
        async with self.oauth_lock:
            value = self.settings()
            if not value["clientId"]:
                raise ValueError("Die GitHub App ist noch nicht eingerichtet. Client-ID hinterlegen.")
            code, data, _ = await self.response("POST", LOGIN + "/device/code",
                data={"client_id": value["clientId"]}, headers={"Accept": "application/json"})
            if code != 200 or not all(data.get(k) for k in ("device_code", "user_code", "verification_uri")):
                raise GitHubError("GitHub-Anmeldung konnte nicht gestartet werden. App und Device Flow prüfen.")
            if data["verification_uri"] != "https://github.com/login/device":
                raise GitHubError("Unerwartetes GitHub-Anmeldeziel.")
            interval = max(5, int(data.get("interval", 5)))
            pending = {"id": secrets.token_urlsafe(24), "clientId": value["clientId"],
                       "code": data["device_code"], "interval": interval,
                       "expiresAt": self.clock() + min(900, int(data.get("expires_in", 900))),
                       "nextPoll": self.clock() + interval}
            self.vault.save("github-device", dump(pending))
            return {"id": pending["id"], "userCode": data["user_code"],
                    "url": data["verification_uri"], "interval": interval, "expiresAt": pending["expiresAt"]}

    async def poll(self, session_id):
        async with self.oauth_lock:
            if not self.vault.has("github-device"):
                raise ValueError("Anmeldung nicht mehr offen. Erneut verbinden.")
            pending = json.loads(self.vault.read("github-device"))
            if not secrets.compare_digest(session_id, pending["id"]):
                raise ValueError("Diese Anmeldung ist nicht mehr aktuell.")
            if pending["expiresAt"] <= self.clock():
                self.vault.remove("github-device")
                raise ValueError("Anmeldecode abgelaufen. Erneut verbinden.")
            if pending["nextPoll"] > self.clock():
                return {"status": "pending", "interval": max(1, int(pending["nextPoll"] - self.clock()) + 1)}
            pending["nextPoll"] = self.clock() + pending["interval"]
            self.vault.save("github-device", dump(pending))
            code, data, _ = await self.response("POST", LOGIN + "/oauth/access_token", data={
                "client_id": pending["clientId"], "device_code": pending["code"],
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code"},
                headers={"Accept": "application/json"})
            error = data.get("error")
            if error in {"authorization_pending", "slow_down"}:
                if error == "slow_down":
                    pending["interval"] += 5
                    pending["nextPoll"] = self.clock() + pending["interval"]
                    self.vault.save("github-device", dump(pending))
                return {"status": "pending", "interval": pending["interval"]}
            if code != 200 or error or not data.get("access_token"):
                self.vault.remove("github-device")
                raise GitHubError("GitHub-Anmeldung abgelehnt oder abgelaufen. Erneut verbinden.")
            credential = self.credential(data, pending["clientId"])
            code, account, _ = await self.response("GET", API + "/user", headers=self.headers(credential["token"]))
            if code != 200 or not isinstance(account.get("id"), int) or not account.get("login"):
                raise GitHubError("Das GitHub-Konto konnte nicht geprüft werden.")
            async with self.lock:
                previous = self.settings().get("account")
                self.vault.save("github-account", dump(credential))
                register_secret(self.db, "github-account", "GitHub")
                self.save(account={"id": account["id"], "login": account["login"]}, error="",
                          checkedAt=self.clock(), repository=self.settings()["repository"] if previous and previous["id"] == account["id"] else None)
                self.vault.remove("github-device")
            return {"status": "connected", "connection": self.status()}

    def credential(self, data, client_id):
        return {"token": data["access_token"], "clientId": client_id,
                "refresh": data.get("refresh_token"),
                "expiresAt": self.clock() + int(data["expires_in"]) if data.get("expires_in") else None,
                "refreshExpiresAt": self.clock() + int(data["refresh_token_expires_in"]) if data.get("refresh_token_expires_in") else None}

    def headers(self, token=None):
        return {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Vanilla", **({"Authorization": "Bearer " + token} if token else {})}

    async def token(self):
        async with self.lock:
            if not self.vault.has("github-account"):
                raise GitHubError("Bitte GitHub unter Verbindungen anmelden.", 401)
            c = json.loads(self.vault.read("github-account"))
            if c.get("refreshPending"):
                self.save(error="Token-Erneuerung blieb unbestätigt. GitHub erneut verbinden.")
                raise GitHubError(self.settings()["error"], 401)
            if c.get("expiresAt") and c["expiresAt"] <= self.clock() + 60:
                if not c.get("refresh") or (c.get("refreshExpiresAt") and c["refreshExpiresAt"] <= self.clock()):
                    self.save(error="GitHub-Anmeldung abgelaufen. Erneut verbinden.")
                    raise GitHubError(self.settings()["error"], 401)
                self.vault.save("github-account", dump({**c, "refreshPending": True}))
                code, data, _ = await self.response("POST", LOGIN + "/oauth/access_token",
                    data={"client_id": c["clientId"], "grant_type": "refresh_token", "refresh_token": c["refresh"]},
                    headers={"Accept": "application/json"})
                if code != 200 or not data.get("access_token"):
                    self.save(error="GitHub-Anmeldung konnte nicht erneuert werden. Erneut verbinden.")
                    raise GitHubError(self.settings()["error"], 401)
                c = self.credential(data, c["clientId"])
                self.vault.save("github-account", dump(c))
            return c["token"]

    async def request(self, method, path, *, body=None, authenticated=True, missing=False, etag=None, cache_key=None):
        if not path.startswith("/") or path.startswith("//") or ".." in path or "\\" in path:
            raise ValueError("Ungültiger GitHub-Anschluss.")
        token = await self.token() if authenticated else None
        headers = self.headers(token)
        cached = self.db.get(cache_key)["value"] if cache_key and not authenticated and method == "GET" else None
        if cached:
            etag = cached.get("etag")
        if etag:
            headers["If-None-Match"] = etag
        code, data, headers = await self.response(method, API + path, json=body, headers=headers)
        if code == 304:
            return cached["data"] if cached else None
        if missing and code == 404:
            return None
        if code == 401 and authenticated:
            self.save(error="GitHub-Anmeldung nicht mehr gültig. Erneut verbinden.")
        if code < 200 or code >= 300:
            message = "GitHub-Anfrage fehlgeschlagen. Verbindung und Repositoryrechte prüfen."
            if code in {403, 429}:
                message = "GitHub-Zugriff gesperrt oder Abruflimit erreicht. Rechte prüfen und später erneut versuchen."
            try:
                pause = max(int(headers.get("retry-after", 0)), int(headers.get("x-ratelimit-reset", 0)) - int(self.clock()))
            except ValueError:
                pause = 3600
            raise GitHubError(message, code, max(0, min(pause, 86400)))
        if cache_key and not authenticated and method == "GET":
            self.db.put(cache_key, {"etag": headers.get("etag"), "data": data})
        return data

    async def repositories(self):
        repositories = []
        for page in range(1, 11):
            installs = await self.request("GET", f"/user/installations?per_page=100&page={page}")
            for installation in installs.get("installations", []):
                for repo_page in range(1, 11):
                    value = await self.request("GET", f"/user/installations/{int(installation['id'])}/repositories?per_page=100&page={repo_page}")
                    entries = value.get("repositories", [])
                    repositories.extend(self.repo_summary(r) for r in entries if r.get("private") or r.get("full_name") == ORIGIN)
                    if len(entries) < 100:
                        break
            if len(installs.get("installations", [])) < 100:
                break
        return {"repositories": list({r["id"]: r for r in repositories}.values())}

    def repo_summary(self, repo):
        if not isinstance(repo.get("id"), int) or not REPOSITORY.fullmatch(repo.get("full_name", "")):
            raise GitHubError("Ungültige Repositoryantwort von GitHub.")
        return {"id": repo["id"], "name": repo["full_name"], "private": bool(repo.get("private")),
                "defaultBranch": repo.get("default_branch", "main"),
                "write": bool(repo.get("permissions", {}).get("push")),
                "url": "https://github.com/" + repo["full_name"]}

    async def select(self, repository_id, revision):
        async with self.oauth_lock:
            if revision != self.settings()["revision"]:
                raise ValueError("GitHub-Verbindung wurde geändert. Erneut öffnen.")
            available = (await self.repositories())["repositories"]
            repo = next((r for r in available if r["id"] == repository_id), None)
            if not repo:
                raise ValueError("Repository ist für diese GitHub App nicht freigegeben.")
            if not repo["private"] and repo["name"] != ORIGIN:
                raise ValueError("Kundencode benötigt ein privates Repository.")
            self.save(repository=repo, checkedAt=self.clock(), error="")
            return self.status()

    async def check(self, *, write=False):
        value = self.settings()
        repo = value.get("repository")
        if not repo:
            raise ValueError("Bitte ein GitHub-Repository auswählen.")
        checked = self.repo_summary(await self.request("GET", f"/repositories/{repo['id']}"))
        if checked["name"] != repo["name"] or checked["private"] != repo["private"]:
            self.save(repository=None, error="Repository wurde umbenannt oder seine Sichtbarkeit geändert. Erneut auswählen.")
            raise ValueError(self.settings()["error"])
        if write and not checked["write"]:
            raise ValueError("GitHub-Schreibrechte für dieses Repository fehlen.")
        self.save(repository=checked, checkedAt=self.clock(), error="")
        return checked

    async def disconnect(self):
        async with self.oauth_lock:
            async with self.lock:
                self.vault.remove("github-device")
                self.vault.remove("github-account")
                self.save(account=None, repository=None, error="", checkedAt=None)
        return self.status()

    async def close(self):
        await self.client.aclose()
