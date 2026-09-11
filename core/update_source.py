"""Neutral source snapshots. No history, credentials or workspace contents leave here."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import subprocess
from pathlib import Path

from .files import atomic_write


def module_at(root, filename, name):
    spec = importlib.util.spec_from_file_location(name, root / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(root, *args, input=None, timeout=120):
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(root),
           "LANG": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
           "GIT_TERMINAL_PROMPT": "0", "GIT_LFS_SKIP_SMUDGE": "1"}
    try:
        r = subprocess.run(["git", "-c", "core.hooksPath=" + os.devnull, "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "protocol.ext.allow=never", "-c", "protocol.file.allow=never", "-C", str(root), *args],
                           input=input, capture_output=True, env=env, timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        raise ValueError("Codeprüfung konnte nicht abgeschlossen werden.") from None
    if r.returncode:
        raise ValueError("Codeabgleich benötigt Klärung. Die Arbeitskopie bleibt erhalten.")
    return r.stdout


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class Source:
    def __init__(self, config, trusted_root=None, policy=None):
        self.config, self.root = config, config.root
        self.guard = module_at(trusted_root or self.root, "scripts/security-scan.py", "update_privacy")
        self.modules = module_at(trusted_root or self.root, "scripts/verify-modules.py", "update_modules")
        self.policy = policy

    def candidate_source(self, directory, release_commit):
        # Candidate Python is never imported into the production process.
        policy = json.loads(git(directory, "show", release_commit + ":system/source-policy.json"))
        policy["reviewedBinaryAssets"] = {**self.guard.Scanner(self.root).policy["reviewedBinaryAssets"], **policy["reviewedBinaryAssets"]}
        return Source(type("CandidateConfig", (), {"root": directory})(), trusted_root=self.root, policy=policy)

    def read(self):
        if Path(git(self.root, "rev-parse", "--show-toplevel").decode().strip()).resolve() != self.root:
            raise ValueError("Der Installationsordner ist kein vollständiger Quellclone.")
        names = sorted(set(filter(None, git(self.root, "ls-files", "--cached", "--others", "--exclude-standard", "-z").decode().split("\0"))))
        scanner = self.guard.Scanner(self.root, policy=self.policy)
        files, inventory = {}, {}
        total = 0
        for name in names:
            p = self.root / name
            if not self.guard.source_path(name):
                raise ValueError("Im Codebestand liegen Dateien außerhalb des freigegebenen Codeumfangs. Lokal bereinigen.")
            if not p.exists() and not p.is_symlink():
                continue  # A local deletion is part of the snapshot, never reversed here.
            if any(q.is_symlink() for q in [p, *p.parents] if q != self.root and q.is_relative_to(self.root)):
                raise ValueError("Verknüpfungen im Codebestand müssen vor dem Austausch geklärt werden.")
            if not p.is_file() or p.stat().st_size > 20_000_000:
                raise ValueError("Der Codebestand enthält eine ungeeignete Datei.")
            raw = p.read_bytes()
            total += len(raw)
            if total > 200_000_000 or len(files) > 10000:
                raise ValueError("Der Codebestand überschreitet den eingerichteten Austauschumfang.")
            mode = "100755" if p.stat().st_mode & 0o111 else "100644"
            scanner.entry(name, raw, mode)
            files[name] = raw
            inventory[name] = {"sha256": hashlib.sha256(raw).hexdigest(), "mode": mode}
        if scanner.findings:
            raise ValueError("Codebereitstellung gestoppt: Die Datenschutzprüfung meldet geschützten Inhalt oder ungeprüfte Dateien.")
        if self.modules.verify(files):
            raise ValueError("Codebereitstellung gestoppt: Eigene Module oder Schnittstellen sind noch nicht vollständig registriert.")
        return {"head": git(self.root, "rev-parse", "HEAD").decode().strip(), "hash": digest(inventory),
                "files": files, "inventory": inventory, "modules": json.loads(files["system/modules.json"])["modules"]}

    def save(self, snapshot, directory):
        directory.mkdir(parents=True, exist_ok=False, mode=0o700)
        for name, raw in snapshot["files"].items():
            p = directory / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(raw)
            p.chmod(0o755 if snapshot["inventory"][name]["mode"] == "100755" else 0o644)
        return directory

    def inventory(self, db):
        # Only hashes enter the journal/model context. Private instructions stay local.
        files = {}
        workspaces = self.root / "workspaces"
        if workspaces.is_symlink():
            raise ValueError("Externe Arbeitsbereiche benötigen einen ausdrücklich geprüften Sicherungsweg.")
        for workspace in sorted(workspaces.iterdir()) if workspaces.exists() else []:
            if workspace.is_symlink():
                raise ValueError("Externer Arbeitsbereich muss vor dem Update zugeordnet werden.")
            for pattern in ("jobs/*/job.yaml", "jobs/*/SKILL.md", "jobs/*/*.py", "projects/*/project.json"):
                for p in sorted(workspace.glob(pattern)):
                    if p.is_symlink() or not p.resolve().is_relative_to(workspaces):
                        raise ValueError("Externe Auftragsdateien müssen vor dem Update zugeordnet werden.")
                    files[p.relative_to(self.root).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
        # Preserve module/connection configuration without exporting its contents.
        records = db.rows("SELECT key,value FROM records WHERE key IN ('control/channels.json','control/workers.json','control/local-workers.json') ORDER BY key")
        state = db.get("control/state.json")["value"] or {}
        configs = {"records": records, "connections": state.get("connections", []), "settings": state.get("settings", {})}
        return {"hash": digest({"files": files, "config": configs}), "files": files,
                "configHash": digest(configs), "jobs": len([n for n in files if n.endswith("/job.yaml")])}

    def candidate(self, snapshot, target, directory):
        # Git history stays local. The exported snapshot is a separate, parentless commit.
        directory.mkdir(parents=True, exist_ok=False, mode=0o700)
        git(directory, "init", "-q")
        git(directory, "-c", "protocol.file.allow=always", "fetch", "--no-tags", str(self.root), snapshot["head"])
        git(directory, "fetch", "--no-tags", "https://github.com/DenzerAI/Vanilla.git", target)
        entries = bytearray()
        for name, raw in snapshot["files"].items():
            oid = git(directory, "hash-object", "-w", "--stdin", input=raw).decode().strip()
            entries.extend(f"{snapshot['inventory'][name]['mode']} {oid}\t{name}\0".encode())
        git(directory, "update-index", "-z", "--index-info", input=bytes(entries))
        tree = git(directory, "write-tree").decode().strip()
        local = git(directory, "-c", "user.name=Vanilla", "-c", "user.email=source@example.invalid", "commit-tree", tree, "-p", snapshot["head"], "-m", "Local neutral source snapshot").decode().strip()
        merged = git(directory, "merge-tree", "--write-tree", local, target).splitlines()[0].decode()
        scan = self.guard.Scanner(directory)
        # The verified public release may legitimately introduce reviewed assets.
        scan.policy_snapshot(target)
        scan.policy["reviewedBinaryAssets"] = {**self.guard.Scanner(self.root).policy["reviewedBinaryAssets"], **scan.policy["reviewedBinaryAssets"]}
        scan.private_terms = self.guard.Scanner(self.root).private_terms
        scan.tree(merged)
        if scan.findings or self.modules.verify(self.modules.tree(directory, merged), self.modules.tree(directory, local)):
            raise ValueError("Zusammengeführter Code besteht Datenschutz- oder Modulprüfung noch nicht.")
        commit = git(directory, "-c", "user.name=Vanilla", "-c", "user.email=source@example.invalid", "commit-tree", merged, "-p", local, "-p", target, "-m", "Prepared Vanilla integration").decode().strip()
        git(directory, "update-ref", "refs/heads/vanilla-update", commit)
        git(directory, "symbolic-ref", "HEAD", "refs/heads/vanilla-update")
        # No checkout filters or hooks from the installation are used.
        git(directory, "read-tree", "--reset", "-u", commit)
        return {"commit": commit, "tree": merged, "sourceCommit": local}

    def public_base(self, snapshot, target, directory):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        git(directory, "init", "--bare", "-q")
        git(directory, "-c", "protocol.file.allow=always", "fetch", "--no-tags", str(self.root), snapshot["head"])
        git(directory, "fetch", "--no-tags", "https://github.com/DenzerAI/Vanilla.git", target)
        return git(directory, "merge-base", snapshot["head"], target).decode().strip()

    def contribution(self, snapshot, base, files, modes, directory):
        directory.mkdir(parents=True, exist_ok=False, mode=0o700)
        git(directory, "init", "-q")
        git(directory, "-c", "protocol.file.allow=always", "fetch", "--no-tags", str(self.root), snapshot["head"])
        git(directory, "fetch", "--no-tags", "https://github.com/DenzerAI/Vanilla.git", base)
        def commit(contents, permissions, parent):
            git(directory, "read-tree", "--empty")
            entries = bytearray()
            for name, raw in contents.items():
                oid = git(directory, "hash-object", "-w", "--stdin", input=raw).decode().strip()
                entries.extend(f"{permissions[name]} {oid}\t{name}\0".encode())
            git(directory, "update-index", "-z", "--index-info", input=bytes(entries))
            tree = git(directory, "write-tree").decode().strip()
            return git(directory, "-c", "user.name=Vanilla", "-c", "user.email=source@example.invalid", "commit-tree", tree, "-p", parent, "-m", "Neutral contribution integration").decode().strip()
        local = commit(snapshot["files"], {name: info["mode"] for name, info in snapshot["inventory"].items()}, snapshot["head"])
        incoming = commit(files, modes, base)
        tree = git(directory, "merge-tree", "--write-tree", local, incoming).splitlines()[0].decode()
        scanner = self.guard.Scanner(directory)
        scanner.tree(tree)
        if scanner.findings or self.modules.verify(self.modules.tree(directory, tree), self.modules.tree(directory, local)):
            raise ValueError("Beitrag benötigt noch Datenschutz- oder Modulanpassungen.")
        merged = git(directory, "-c", "user.name=Vanilla", "-c", "user.email=source@example.invalid", "commit-tree", tree, "-p", local, "-p", incoming, "-m", "Prepared private contribution").decode().strip()
        git(directory, "update-ref", "refs/heads/vanilla-contribution", merged)
        git(directory, "symbolic-ref", "HEAD", "refs/heads/vanilla-contribution")
        git(directory, "read-tree", "--reset", "-u", merged)
        return {"commit": merged, "tree": tree, "sourceCommit": local}
