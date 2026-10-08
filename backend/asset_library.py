"""Characters (assets): listing, status, annotation editing and source files."""

from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException

from app_settings import ASSET_METADATA_FILE, EXAMPLE_ASSETS_DIR, MAX_JOINTS, REPO_ROOT, RIG_ASSETS_DIR
from command_builder import to_repo_relative
from job_manager import job_manager
from validation import read_json_file, require_safe_name, write_json_file

ASSET_STATUS_PROCESSING = "processing"
ASSET_STATUS_REVIEW = "review"
ASSET_STATUS_READY = "ready"
ASSET_STATUS_TOO_MANY_JOINTS = "too_many_joints"
ASSET_STATUS_FAILED = "failed"
ASSET_STATUS_EMPTY = "empty"


def build_file_url(file_path: Path) -> Optional[str]:
    """Browser URL of a repo file, with its modification time to bust caches."""
    if not file_path.is_file():
        return None
    return f"/files/{to_repo_relative(file_path)}?v={int(file_path.stat().st_mtime)}"


def find_asset_dir(asset_name: str) -> Path:
    """Directory of a user asset or an example asset (404 if neither exists)."""
    require_safe_name(asset_name, "personaje")
    for candidate_dir in (RIG_ASSETS_DIR / asset_name, EXAMPLE_ASSETS_DIR / asset_name):
        if candidate_dir.is_dir():
            return candidate_dir
    raise HTTPException(status_code=404, detail=f"Personaje '{asset_name}' no encontrado")


def is_example_asset(asset_dir: Path) -> bool:
    """Example assets ship with the repo and are read-only in the UI."""
    return asset_dir.parent.resolve() == EXAMPLE_ASSETS_DIR.resolve()


def read_asset_metadata(asset_dir: Path) -> dict:
    """UI-side info about an asset (source file, rest rotation, last error)."""
    return read_json_file(asset_dir / ASSET_METADATA_FILE, {}) or {}


def write_asset_metadata(asset_dir: Path, metadata: dict) -> None:
    """Persist UI-side info about an asset."""
    asset_dir.mkdir(parents=True, exist_ok=True)
    write_json_file(asset_dir / ASSET_METADATA_FILE, metadata)


def find_source_file(asset_dir: Path) -> Optional[Path]:
    """The uploaded GLB/FBX of a user asset, if still on disk."""
    source_relative = read_asset_metadata(asset_dir).get("source_file")
    if not source_relative:
        return None
    source_path = REPO_ROOT / source_relative
    return source_path if source_path.is_file() else None


def find_canonical_glb(asset_dir: Path, summary: dict) -> Optional[Path]:
    """The canonical (re-centred) GLB written by rig_preprocess."""
    named_glb = asset_dir / f"{summary.get('name', asset_dir.name)}.glb"
    if named_glb.is_file():
        return named_glb
    return next(iter(sorted(asset_dir.glob("*.glb"))), None)


def count_joints(summary: dict, annotation: Optional[dict]) -> Optional[int]:
    """Joint count from summary.json, falling back to the annotation."""
    if summary.get("n_joints"):
        return int(summary["n_joints"])
    if annotation and annotation.get("joints"):
        return len(annotation["joints"])
    return None


def resolve_asset_status(asset_dir: Path, summary: dict, joint_count: Optional[int], fits_model: bool) -> str:
    """Single status word the UI shows for an asset."""
    if job_manager.is_related_busy("asset", asset_dir.name):
        return ASSET_STATUS_PROCESSING
    if joint_count is not None and not fits_model:
        return ASSET_STATUS_TOO_MANY_JOINTS
    if summary.get("stage") == "review":
        return ASSET_STATUS_REVIEW
    if (asset_dir / "cond.npy").is_file():
        return ASSET_STATUS_READY
    if read_asset_metadata(asset_dir).get("last_error"):
        return ASSET_STATUS_FAILED
    return ASSET_STATUS_EMPTY


def describe_asset(asset_dir: Path) -> dict:
    """Everything the UI shows about one asset."""
    summary = read_json_file(asset_dir / "summary.json", {}) or {}
    annotation = read_json_file(asset_dir / "annotation.json")
    metadata = read_asset_metadata(asset_dir)
    joint_count = count_joints(summary, annotation)
    joint_limit = summary.get("model_joint_limit") or {}
    fits_model = bool(joint_limit.get("fits", joint_count is not None and joint_count <= MAX_JOINTS))
    source_file = find_source_file(asset_dir)
    canonical_glb = find_canonical_glb(asset_dir, summary)
    example_asset = is_example_asset(asset_dir)
    review_info = summary.get("review") or {}
    return {
        "name": asset_dir.name,
        "display_name": metadata.get("display_name") or asset_dir.name,
        "origin": "example" if example_asset else "user",
        "editable": not example_asset,
        "status": resolve_asset_status(asset_dir, summary, joint_count, fits_model),
        "joint_count": joint_count,
        "max_joints": MAX_JOINTS,
        "fits_model": fits_model,
        "flagged_joints": review_info.get("flagged_joints", annotation.get("n_flagged") if annotation else 0),
        "notes": summary.get("notes") or [],
        "last_error": metadata.get("last_error"),
        "source_extension": (source_file.suffix.lower().lstrip(".") if source_file
                             else (canonical_glb.suffix.lstrip(".") if canonical_glb else None)),
        "has_source_file": source_file is not None,
        "rest_rotation": metadata.get("rest_rotation", ""),
        "preview_url": build_file_url(asset_dir / "preview.png"),
        "annotation_preview_url": build_file_url(asset_dir / "annotation_preview.png"),
        "canonical_glb_url": build_file_url(canonical_glb) if canonical_glb else None,
        "asset_reference": to_repo_relative(asset_dir),
    }


def list_assets() -> List[dict]:
    """User assets first (newest first), then the repo examples."""
    user_asset_dirs = sorted((listed_dir for listed_dir in RIG_ASSETS_DIR.glob("*") if listed_dir.is_dir()),
                             key=lambda listed_dir: listed_dir.stat().st_mtime, reverse=True) \
        if RIG_ASSETS_DIR.is_dir() else []
    example_asset_dirs = sorted(listed_dir for listed_dir in EXAMPLE_ASSETS_DIR.glob("*") if listed_dir.is_dir())
    return [describe_asset(asset_dir) for asset_dir in [*user_asset_dirs, *example_asset_dirs]]


def read_annotation(asset_name: str) -> dict:
    """annotation.json of an asset (joints, labels, face pair, vocabulary)."""
    asset_dir = find_asset_dir(asset_name)
    annotation = read_json_file(asset_dir / "annotation.json")
    if annotation is None:
        raise HTTPException(status_code=404, detail="Este personaje todavía no tiene annotation.json")
    return annotation


def save_annotation(asset_name: str, face_pair_update: dict, joint_label_updates: List[dict]) -> dict:
    """Write back only the editable fields: joint labels and the facing pair."""
    asset_dir = find_asset_dir(asset_name)
    if is_example_asset(asset_dir):
        raise HTTPException(status_code=403, detail="Los personajes de ejemplo no se editan")
    annotation = read_annotation(asset_name)
    known_raw_names = {joint_entry["raw"] for joint_entry in annotation["joints"]}

    new_labels_by_raw = {}
    for label_update in joint_label_updates:
        raw_name, new_label = label_update.get("raw"), str(label_update.get("label", "")).strip()
        if raw_name not in known_raw_names:
            raise HTTPException(status_code=400, detail=f"Hueso desconocido: {raw_name}")
        if not new_label:
            raise HTTPException(status_code=400, detail=f"El hueso {raw_name} necesita una etiqueta")
        new_labels_by_raw[raw_name] = new_label[:64]
    for joint_entry in annotation["joints"]:
        if joint_entry["raw"] in new_labels_by_raw and new_labels_by_raw[joint_entry["raw"]] != joint_entry["label"]:
            joint_entry["label"] = new_labels_by_raw[joint_entry["raw"]]
            joint_entry["source"] = "file"

    right_joint, left_joint = face_pair_update.get("right", ""), face_pair_update.get("left", "")
    if right_joint or left_joint:
        if right_joint not in known_raw_names or left_joint not in known_raw_names or right_joint == left_joint:
            raise HTTPException(status_code=400, detail="El par de orientación necesita dos huesos distintos")
    annotation["face_pair"]["right"] = right_joint
    annotation["face_pair"]["left"] = left_joint
    annotation["face_pair"]["body_axis"] = bool(face_pair_update.get("body_axis", False))

    write_json_file(asset_dir / "annotation.json", annotation)
    return annotation
