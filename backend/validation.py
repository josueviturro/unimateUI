"""Input validation and safe path helpers."""

import json
import re
from pathlib import Path

from fastapi import HTTPException

SAFE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{1,64}$")


def require_safe_name(candidate_name: str, field_label: str = "nombre") -> str:
    """Reject any name that is not letters, digits or underscores (blocks path tricks)."""
    if not SAFE_NAME_PATTERN.match(candidate_name or ""):
        raise HTTPException(status_code=400, detail=f"{field_label} inválido: usá solo letras, números y _")
    return candidate_name


def sanitize_name(raw_name: str) -> str:
    """Turn any text (e.g. a file name) into a safe asset/run name."""
    cleaned_name = re.sub(r"[^A-Za-z0-9_]+", "_", raw_name).strip("_")
    return (cleaned_name or "asset")[:64]


def require_inside(base_dir: Path, candidate_path: Path) -> Path:
    """Make sure a resolved path stays inside base_dir."""
    resolved_path = candidate_path.resolve()
    if base_dir.resolve() not in resolved_path.parents and resolved_path != base_dir.resolve():
        raise HTTPException(status_code=400, detail="Ruta fuera de la carpeta permitida")
    return resolved_path


def read_json_file(file_path: Path, default_value=None):
    """Read a JSON file, returning default_value when it is missing or broken."""
    try:
        with open(file_path, encoding="utf-8") as json_file:
            return json.load(json_file)
    except (OSError, ValueError):
        return default_value


def write_json_file(file_path: Path, json_content) -> None:
    """Write JSON atomically (temp file + replace) so readers never see half a file."""
    temporary_path = file_path.with_suffix(file_path.suffix + ".tmp")
    with open(temporary_path, "w", encoding="utf-8") as json_file:
        json.dump(json_content, json_file, indent=1, ensure_ascii=False)
    temporary_path.replace(file_path)
