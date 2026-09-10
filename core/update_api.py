"""Authenticated app routes; all writes use the core's session and CSRF boundary."""
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated, Literal


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Revision(Input):
    revision: int = Field(ge=0)


class AppInput(Revision):
    clientId: str = Field(min_length=8, max_length=100)


class PollInput(Input):
    id: str = Field(min_length=10, max_length=100)


class RepositoryInput(Revision):
    repositoryId: int = Field(gt=0)


class UpdateSettings(Revision):
    automatic: bool
    notifications: bool
    worker: str = Field(default="", max_length=100)
    model: str = Field(default="", max_length=100)
    budgetMinutes: int = Field(default=30, ge=5, le=120)


class PrepareInput(Input):
    releaseId: int = Field(gt=0)
    requestKey: str = Field(pattern=r"^[a-zA-Z0-9_-]{16,100}$")


class RunInput(Revision):
    id: str = Field(pattern=r"^[a-f0-9]{32}$")


class ContributionSettings(Revision):
    role: Literal["origin", "customer"]
    agreed: bool = False


class Decision(Revision):
    id: str = Field(pattern=r"^[a-f0-9]{64}$")
    state: Literal["deferred", "declined"]


class ContributionRun(Revision):
    id: str = Field(pattern=r"^[a-f0-9]{64}$")


class Publication(Input):
    version: str = Field(pattern=r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$", max_length=60)
    summary: str = Field(min_length=1, max_length=500)
    changes: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(min_length=1, max_length=100)
    fromVersions: list[Annotated[str, Field(pattern=r"^(development|(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$", max_length=60)]] = Field(min_length=1, max_length=100)
    compatibleData: Literal[True]


def routes(github, updates, contributions):
    router = APIRouter()

    @router.get("/api/github/status")
    async def github_status():
        return github.status()

    @router.post("/api/github/configure")
    async def configure(body: AppInput):
        return await github.configure(body.clientId, body.revision)

    @router.post("/api/github/connect")
    async def connect():
        return await github.begin()

    @router.post("/api/github/poll")
    async def poll(body: PollInput):
        return await github.poll(body.id)

    @router.get("/api/github/repositories")
    async def repositories():
        return await github.repositories()

    @router.post("/api/github/repository")
    async def repository(body: RepositoryInput):
        return await github.select(body.repositoryId, body.revision)

    @router.post("/api/github/check")
    async def check_github():
        async with github.oauth_lock:
            await github.check()
        return github.status()

    @router.post("/api/github/disconnect")
    async def disconnect():
        return await github.disconnect()

    @router.get("/api/system/updates")
    async def status():
        return updates.status()

    @router.post("/api/system/updates/settings")
    async def settings(body: UpdateSettings):
        return updates.configure(body.model_dump(exclude={"revision"}), body.revision)

    @router.post("/api/system/updates/check")
    async def check():
        queued = updates.runtime.queue.enqueue("system-update-check")
        return {"runId": queued["id"], "status": updates.status()}

    @router.post("/api/system/updates/prepare")
    async def prepare(body: PrepareInput):
        return await updates.prepare(body.releaseId, body.requestKey)

    @router.post("/api/system/updates/cancel")
    async def cancel(body: RunInput):
        return await updates.cancel(body.id, body.revision)

    @router.post("/api/system/updates/install")
    async def install(body: RunInput):
        return await updates.install(body.id, body.revision)

    @router.get("/api/system/contributions")
    async def contribution_list():
        return contributions.list()

    @router.post("/api/system/contributions/settings")
    async def contribution_settings(body: ContributionSettings):
        return await contributions.configure(body.role, body.agreed, body.revision)

    @router.post("/api/system/contributions/share")
    async def share():
        return await contributions.share()

    @router.post("/api/system/contributions/check")
    async def check_contributions():
        for item in await contributions.inbox():
            updates.notice(item["id"], "Neuer Beitrag", item["repository"]["name"], kind="contribution", subject=item["id"])
        return contributions.list()

    @router.get("/api/system/contributions/preview")
    async def preview(id: str):
        if len(id) != 64 or any(c not in "abcdef0123456789" for c in id):
            raise ValueError("Ungültiger Beitrag.")
        return await contributions.preview(id)

    @router.post("/api/system/contributions/decide")
    async def decide(body: Decision):
        return await contributions.decide(body.id, body.state, body.revision)

    @router.post("/api/system/contributions/review")
    async def review(body: ContributionRun):
        return await contributions.review(body.id, body.revision, updates)

    @router.post("/api/system/contributions/adopt")
    async def adopt(body: ContributionRun):
        return await contributions.adopt(body.id, body.revision)

    @router.post("/api/system/updates/publish")
    async def publish(body: Publication):
        from .update_publish import publish as publish_release
        return await publish_release(updates, body.version, body.summary, body.changes, body.fromVersions)

    return router
