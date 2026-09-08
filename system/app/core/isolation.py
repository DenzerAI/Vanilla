"""Project-local paths for the Vanilla distribution."""
from pathlib import Path

from .layout import ROOT

def inside(root, value):
    root = Path(root).resolve()
    value = Path(value)
    resolved = (value if value.is_absolute() else root / value).resolve()
    if resolved == root or not resolved.is_relative_to(root):
        raise ValueError("Vanilla-Pfade müssen innerhalb des eigenen Projektordners liegen.")
    return resolved

def port(value):
    value = int(value)
    if not 1024 <= value <= 65535 or value in {8890, 9090}:
        raise ValueError("Unzulässiger Vanilla-Port.")
    return value
