#!/bin/zsh
set -euo pipefail
# Ordinary user services. Never change screen lock, FileVault or automatic login.
agent_root="${0:A:h}"
cd "$agent_root"
exec "$agent_root/.venv/bin/python" -m core.service install "$@"
