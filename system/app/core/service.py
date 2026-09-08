"""Install the application and independent monitor as ordinary user agents."""
from __future__ import annotations

import argparse
import hashlib
import os
import plistlib
import subprocess
import sys
from pathlib import Path

from .config import Config


def label(config):
    return "local.vanilla.agent." + hashlib.sha256(str(config.data).encode()).hexdigest()[:10]


def service_status(config):
    name = label(config)
    path = config.data / "services" / (name + ".plist")
    installed = (config.data / "services/host-activation.json").is_file()
    loaded = False
    if installed and sys.platform == "darwin":
        try:
            loaded = subprocess.run(["launchctl", "print", f"gui/{os.getuid()}/{name}"],
                                    capture_output=True, timeout=3).returncode == 0
        except (OSError, subprocess.SubprocessError):
            pass
    return {"installed": installed, "loaded": loaded, "generated": path.is_file(), "label": name,
            "starts": "launchd-keepalive" if loaded else "manual-only"}


def install(config, activate=False):
    if activate:
        raise ValueError("Vanilla erzeugt nur lokale Dienstvorlagen; globale Aktivierung ist gesperrt.")
    if sys.platform != "darwin":
        raise ValueError("launchd ist nur unter macOS verfügbar.")
    directory = config.data / "services"
    directory.mkdir(parents=True, exist_ok=True)
    logs = config.data / "logs"
    logs.mkdir(parents=True, exist_ok=True, mode=0o700)
    name = label(config)
    environment = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "UWE_WORKSPACE": str(config.workspace), "UWE_DATA_ROOT": str(config.data), "UWE_PORT": str(config.port), "AGENT_ADAPTER_PORT": str(config.adapter_port), "AGENT_TIMEZONE": config.timezone, "LANG": "de_DE.UTF-8", "PYTHONUNBUFFERED": "1"}
    for suffix, args, options in [
        ("", [sys.executable, "-m", "core"], {"KeepAlive": True, "RunAtLoad": True, "ThrottleInterval": 10, "ExitTimeOut": 180}),
        (".heartbeat", [sys.executable, "-m", "core.heartbeat", "--data", str(config.data), "--port", str(config.port)], {"StartInterval": 60, "RunAtLoad": True}),
    ]:
        definition = {"Label": name + suffix, "ProgramArguments": args, "WorkingDirectory": str(config.source), "EnvironmentVariables": environment, "StandardOutPath": str(logs / ("heartbeat.log" if suffix else "core.log")), "StandardErrorPath": str(logs / ("heartbeat.log" if suffix else "core.log")), "Umask": 0o077, **options}
        file = directory / (name + suffix + ".plist")
        file.write_bytes(plistlib.dumps(definition))
        file.chmod(0o600)
    return service_status(config)


def uninstall(config):
    for suffix in [".heartbeat", ""]:
        (config.data / "services" / (label(config) + suffix + ".plist")).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["install", "status", "uninstall"])
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    config = Config.environment()
    if args.action == "install":
        print(install(config, args.activate))
    elif args.action == "uninstall":
        uninstall(config)
    else:
        print(service_status(config))


if __name__ == "__main__":
    main()
