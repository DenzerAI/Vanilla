from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from secrets import token_urlsafe
from .isolation import inside, port
from .layout import ROOT, manifest


@dataclass
class Config:
    root: Path = field(default_factory=lambda: ROOT)
    workspace: Path | None = None
    data: Path | None = None
    host: str = "127.0.0.1"
    port: int = 1989
    adapter_port: int = 1990
    adapter_token: str = field(default_factory=lambda: token_urlsafe(32), repr=False)
    access_token: str = field(default="", repr=False)
    login_password: str = field(default="", repr=False)
    public_origin: str = ""
    start_adapter: bool = True
    embedding_model: str = ""
    embedding_revision: str = ""
    timezone: str = "Europe/Berlin"

    def __post_init__(self):
        self.root = self.root.resolve()
        self.layout = manifest(self.root)
        if self.layout:
            from .layout import alias_path
            if self.workspace:
                requested = Path(self.workspace)
                requested = (requested if requested.is_absolute() else self.root/requested).resolve()
                configured = self.root if requested == self.root else inside(self.root,self.workspace)
                mapped = self.root if configured == self.root else inside(self.root,alias_path(self.root,configured.relative_to(self.root).as_posix()))
                allowed = {self.root,self.root/alias_path(self.root,self.layout.get('legacyWorkspace','workspaces/default'))}
                if mapped not in allowed:
                    raise ValueError('UWE_WORKSPACE widerspricht der eingerichteten Installation.')
            if self.data:
                configured = inside(self.root,self.data)
                mapped = inside(self.root,alias_path(self.root,configured.relative_to(self.root).as_posix()))
                if mapped != self.root/self.layout['data']:
                    raise ValueError('UWE_DATA_ROOT widerspricht der eingerichteten Installation.')
            self.workspace = self.root
            self.data = inside(self.root, self.layout['data'])
        else:
            self.workspace = inside(self.root, self.workspace or "workspaces/default")
            self.data = inside(self.root, self.data or ('data/control' if (self.root/'data/control').exists() or self.source == self.root else 'system/data/control'))
        self.port, self.adapter_port = port(self.port), port(self.adapter_port)
        if self.port == self.adapter_port:
            raise ValueError("Kern und Adapter benötigen verschiedene Ports.")
        if self.embedding_model:
            self.embedding_model = str(inside(self.root, self.embedding_model))
            if self.layout:
                from .layout import alias_path
                self.embedding_model = str(inside(self.root,alias_path(self.root,Path(self.embedding_model).relative_to(self.root).as_posix())))
        default_model = self.data / "models/embeddings"
        if not self.embedding_model and (default_model / "modules.json").is_file():
            self.embedding_model = str(default_model)
        if (
            self.host not in {"127.0.0.1", "localhost", "::1"}
            and len(self.access_token) < 32
        ):
            raise ValueError(
                "Fernzugriff benötigt AGENT_ACCESS_TOKEN mit mindestens 32 Zeichen."
            )
        if self.public_origin and not self.public_origin.startswith("https://"):
            raise ValueError("AGENT_PUBLIC_ORIGIN muss eine HTTPS-Adresse sein.")

    @property
    def source(self):
        candidate = self.root / 'system/app'
        return candidate if (candidate / 'core').is_dir() else self.root

    @property
    def adapter_url(self):
        return f"http://127.0.0.1:{self.adapter_port}"

    @property
    def login_required(self):
        return bool(self.access_token or self.login_password)

    @classmethod
    def environment(cls):
        config = cls(
            workspace=Path(os.environ["UWE_WORKSPACE"])
            if os.getenv("UWE_WORKSPACE")
            else None,
            data=Path(os.environ["UWE_DATA_ROOT"])
            if os.getenv("UWE_DATA_ROOT")
            else None,
            host=os.getenv("AGENT_HOST", "127.0.0.1"),
            port=int(os.getenv("UWE_PORT", "1989")),
            adapter_port=int(os.getenv("AGENT_ADAPTER_PORT", "1990")),
            access_token=os.getenv("AGENT_ACCESS_TOKEN", ""),
            public_origin=os.getenv("AGENT_PUBLIC_ORIGIN", "").rstrip("/"),
            start_adapter=os.getenv("AGENT_START_ADAPTER", "1") != "0",
            embedding_model=os.getenv("AGENT_EMBEDDING_MODEL", ""),
            embedding_revision=os.getenv("AGENT_EMBEDDING_REVISION", ""),
            timezone=os.getenv("AGENT_TIMEZONE", "Europe/Berlin"),
        )
        from .files import read_json
        from .secrets import read_secret
        host = read_json(config.data / "host.json", {})
        if host.get("access_enabled"):
            config.login_password = read_secret("system-access")
            config.access_token = read_secret("system-api")
        if not config.public_origin and host.get("public_origin"):
            origin = host["public_origin"]
            if not origin.startswith("https://"):
                raise ValueError("Ungültiger HTTPS-Ursprung in der Dienstkonfiguration.")
            config.public_origin = origin
        return config
