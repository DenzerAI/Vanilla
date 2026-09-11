"""One versioned configuration for settings, scheduled jobs and maintenance."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Options(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SystemOptions(Options):
    heartbeat: bool = True
    frontend_check: bool = True
    auto_restart: bool = True
    notifications: bool = True
    quiet_hours: bool = False
    quiet_start: str = Field(default="22:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    quiet_end: str = Field(default="07:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    parallel_jobs: int = Field(default=2, ge=1, le=4)


class MemoryOptions(Options):
    capture: bool = True
    dreaming: bool = True
    dream_time: str = Field(default="03:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    context_characters: int = Field(default=8000, ge=1000, le=16000)
    excluded_chats: list[str] = Field(default_factory=list, max_length=1000)
    shared_notes: bool = False
    history: bool = True


class BackupOptions(Options):
    enabled: bool = False
    target: str = Field(default="", max_length=1000)
    time: str = Field(default="03:30", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    daily: int = Field(default=7, ge=1, le=90)
    weekly: int = Field(default=4, ge=0, le=52)
    monthly: int = Field(default=3, ge=0, le=24)


class RetentionOptions(Options):
    logs_days: int = Field(default=7, ge=1, le=90)
    events_days: int = Field(default=30, ge=1, le=365)
    runs_days: int = Field(default=90, ge=7, le=730)
    minimum_free_mb: int = Field(default=1024, ge=100, le=100000)


class SettingsValues(Options):
    system: SystemOptions = Field(default_factory=SystemOptions)
    memory: MemoryOptions = Field(default_factory=MemoryOptions)
    backup: BackupOptions = Field(default_factory=BackupOptions)
    retention: RetentionOptions = Field(default_factory=RetentionOptions)


class SettingsUpdate(Options):
    version: int = Field(ge=0)
    values: SettingsValues


class Settings:
    def __init__(self, db):
        self.db = db

    def read(self):
        value = self.db.get("system/settings")["value"] or {}
        return {"version": value.get("version", 0), "values": SettingsValues.model_validate(value.get("values", {})).model_dump()}

    @property
    def values(self):
        return self.read()["values"]

    def save(self, update: SettingsUpdate):
        with self.db.lock:
            current = self.read()
            if current["version"] != update.version:
                raise FileExistsError("Einstellungen wurden inzwischen geändert. Bitte neu laden; dein Entwurf bleibt erhalten.")
            result = {"version": current["version"] + 1, "values": update.values.model_dump()}
            self.db.put("system/settings", result)
            self.db.event("system.settings", None, {})
            return result

    def set_group(self, group, **changes):
        current = self.read()
        current["values"][group].update(changes)
        return self.save(SettingsUpdate.model_validate(current))
