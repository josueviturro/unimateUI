"""Generation runs (tandas): metadata, manifest reading, variants and favorites."""

import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import HTTPException

from app_settings import RUN_METADATA_FILE, SAMPLES_DIR
from asset_library import build_file_url
from job_manager import FINISHED_STATUSES, job_manager
from validation import read_json_file, require_safe_name, write_json_file

MODE_SUBDIRECTORIES = ("motion_expand", "inbetween", "motion_edit")
SAMPLE_STEM_PATTERN = re.compile(r"^(?P<case>.+)-rep_(?P<repetition>\d+)-(?P<object_index>\d+)$")
ORIGINAL_SCALE_FOLDER = "animated_original"
CANONICAL_FOLDER = "animated"

RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_NOT_ANIMATED = "not_animated"
RUN_STATUS_FAILED = "failed"
RUN_STATUS_CANCELLED = "cancelled"


def new_run_name() -> str:
    """Timestamped run folder name, e.g. run_20261008_153012."""
    return datetime.now().strftime("run_%Y%m%d_%H%M%S")


def find_run_dir(run_name: str) -> Path:
    """Folder of a run (404 if missing)."""
    require_safe_name(run_name, "tanda")
    run_dir = SAMPLES_DIR / run_name
    if not run_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Tanda '{run_name}' no encontrada")
    return run_dir


def find_manifest_dir(run_dir: Path) -> Optional[Path]:
    """Where manifest.json lives: the run folder, or its mode subfolder (motion_expand/...)."""
    if (run_dir / "manifest.json").is_file():
        return run_dir
    for mode_subdirectory in MODE_SUBDIRECTORIES:
        if (run_dir / mode_subdirectory / "manifest.json").is_file():
            return run_dir / mode_subdirectory
    return None


def read_run_metadata(run_dir: Path) -> dict:
    """UI-side info about a run (parameters, status, favorites)."""
    return read_json_file(run_dir / RUN_METADATA_FILE, {}) or {}


def write_run_metadata(run_dir: Path, metadata: dict) -> None:
    """Persist UI-side info about a run."""
    run_dir.mkdir(parents=True, exist_ok=True)
    write_json_file(run_dir / RUN_METADATA_FILE, metadata)


def update_run_metadata(run_dir: Path, **changed_fields) -> dict:
    """Merge fields into a run's metadata and save it."""
    metadata = read_run_metadata(run_dir)
    metadata.update(changed_fields)
    write_run_metadata(run_dir, metadata)
    return metadata


def folder_size_bytes(folder_path: Path) -> int:
    """Total size of all files under a folder."""
    return sum(file_path.stat().st_size for file_path in folder_path.rglob("*") if file_path.is_file())


def prompt_to_text(prompt_value) -> str:
    """Manifest prompts are strings ("a | b" for chained runs) or lists; chains are shown as "a → b"."""
    if isinstance(prompt_value, list):
        return " → ".join(str(prompt_part) for prompt_part in prompt_value)
    return str(prompt_value or "").replace(" | ", " → ")


def resolve_run_status(run_dir: Path, metadata: dict, manifest_dir: Optional[Path]) -> str:
    """Single status word for the history table."""
    if job_manager.is_related_busy("run", run_dir.name):
        return RUN_STATUS_RUNNING
    if metadata.get("status") in (RUN_STATUS_FAILED, RUN_STATUS_CANCELLED):
        return metadata["status"]
    if manifest_dir is None:
        return RUN_STATUS_FAILED
    if any((manifest_dir / CANONICAL_FOLDER).glob("*.glb")):
        return RUN_STATUS_COMPLETED
    return RUN_STATUS_NOT_ANIMATED


def describe_run(run_dir: Path) -> dict:
    """Summary row of one run for the history table."""
    metadata = read_run_metadata(run_dir)
    manifest_dir = find_manifest_dir(run_dir)
    manifest = read_json_file(manifest_dir / "manifest.json", {}) if manifest_dir else {}
    manifest_samples: Dict[str, dict] = (manifest or {}).get("samples", {})
    manifest_runs = (manifest or {}).get("runs") or [{}]
    prompts = metadata.get("prompts") or sorted({prompt_to_text(sample_info.get("prompt"))
                                                 for sample_info in manifest_samples.values()})
    assets = metadata.get("assets") or sorted({sample_info.get("asset", "") for sample_info in manifest_samples.values()})
    created_timestamp = metadata.get("created_at") or run_dir.stat().st_mtime
    return {
        "run_name": run_dir.name,
        "created_at": created_timestamp,
        "assets": assets,
        "prompts": prompts,
        "mode": metadata.get("mode") or ("expand" if manifest_runs[-1].get("mode") == "motion_expand" else "text"),
        "repetitions": metadata.get("repetitions"),
        "cfg_scale": metadata.get("cfg_scale", manifest_runs[-1].get("cfg_scale")),
        "seed": metadata.get("seed", manifest_runs[-1].get("seed")),
        "status": resolve_run_status(run_dir, metadata, manifest_dir),
        "sample_count": len(manifest_samples),
        "favorite_count": len(metadata.get("favorites", [])),
        "job_id": metadata.get("job_id"),
        "error_message": metadata.get("error_message"),
    }


def list_runs() -> List[dict]:
    """All runs, newest first."""
    if not SAMPLES_DIR.is_dir():
        return []
    run_rows = [describe_run(run_dir) for run_dir in SAMPLES_DIR.iterdir() if run_dir.is_dir()]
    return sorted(run_rows, key=lambda run_row: run_row["created_at"], reverse=True)


def find_preview_video(manifest_dir: Path, sample_stem: str) -> Optional[Path]:
    """Skeleton mp4 of a sample: '<case>-rep_<r>-<i>' → '<case>-rep_<r>-sample<i>_fk.mp4'."""
    stem_match = SAMPLE_STEM_PATTERN.match(sample_stem)
    if stem_match:
        expected_video = (manifest_dir / "animations" /
                          f"{stem_match['case']}-rep_{stem_match['repetition']}-sample{stem_match['object_index']}_fk.mp4")
        if expected_video.is_file():
            return expected_video
    prefix_without_index = sample_stem.rsplit("-", 1)[0]
    return next(iter(sorted((manifest_dir / "animations").glob(f"{prefix_without_index}*_fk.mp4"))), None)


def describe_run_detail(run_name: str) -> dict:
    """One run with its cases (asset × prompt) and every variant's files."""
    run_dir = find_run_dir(run_name)
    run_summary = describe_run(run_dir)
    metadata = read_run_metadata(run_dir)
    favorite_stems = set(metadata.get("favorites", []))
    manifest_dir = find_manifest_dir(run_dir)
    manifest = read_json_file(manifest_dir / "manifest.json", {}) if manifest_dir else {}
    manifest_runs = (manifest or {}).get("runs") or [{}]

    cases_by_id: Dict[str, dict] = {}
    for sample_file_name, sample_info in sorted((manifest or {}).get("samples", {}).items()):
        if sample_info.get("kind", "sample") != "sample":
            continue  # ground-truth clips of in-betweening / editing are not variants
        sample_stem = Path(sample_file_name).stem
        stem_match = SAMPLE_STEM_PATTERN.match(sample_stem)
        case_id = sample_info.get("case_id") or (stem_match["case"] if stem_match else sample_stem)
        run_index = sample_info.get("run", 0)
        sample_run = manifest_runs[run_index] if run_index < len(manifest_runs) else {}
        case_entry = cases_by_id.setdefault(case_id, {
            "case_id": case_id,
            "asset": sample_info.get("asset"),
            "prompt": prompt_to_text(sample_info.get("prompt")),
            "variants": [],
        })
        preview_video = find_preview_video(manifest_dir, sample_stem)
        case_entry["variants"].append({
            "sample_stem": sample_stem,
            "repetition_index": int(stem_match["repetition"]) if stem_match else len(case_entry["variants"]),
            "seed": sample_run.get("seed"),
            "cfg_scale": sample_run.get("cfg_scale"),
            "preview_video_url": build_file_url(preview_video) if preview_video else None,
            "canonical_glb_url": build_file_url(manifest_dir / CANONICAL_FOLDER / f"{sample_stem}.glb"),
            "canonical_fbx_url": build_file_url(manifest_dir / CANONICAL_FOLDER / f"{sample_stem}.fbx"),
            "original_glb_url": build_file_url(manifest_dir / ORIGINAL_SCALE_FOLDER / f"{sample_stem}.glb"),
            "original_fbx_url": build_file_url(manifest_dir / ORIGINAL_SCALE_FOLDER / f"{sample_stem}.fbx"),
            "favorite": sample_stem in favorite_stems,
        })
    for case_entry in cases_by_id.values():
        case_entry["variants"].sort(key=lambda variant_entry: variant_entry["repetition_index"])
    return {**run_summary, "cases": list(cases_by_id.values())}


def toggle_favorite(run_name: str, sample_stem: str, favorite: bool) -> List[str]:
    """Add or remove a variant from the run's favorites."""
    run_dir = find_run_dir(run_name)
    favorite_stems = set(read_run_metadata(run_dir).get("favorites", []))
    if favorite:
        favorite_stems.add(sample_stem)
    else:
        favorite_stems.discard(sample_stem)
    update_run_metadata(run_dir, favorites=sorted(favorite_stems))
    return sorted(favorite_stems)


def delete_run(run_name: str) -> None:
    """Remove a run folder from disk (refused while a job uses it)."""
    run_dir = find_run_dir(run_name)
    if job_manager.is_related_busy("run", run_name):
        raise HTTPException(status_code=409, detail="La tanda está en uso por un trabajo activo")
    shutil.rmtree(run_dir)


def storage_summary() -> dict:
    """Disk usage of all runs and how many exported files exist."""
    if not SAMPLES_DIR.is_dir():
        return {"total_bytes": 0, "run_count": 0, "exported_file_count": 0}
    exported_files = [file_path for file_path in SAMPLES_DIR.rglob("*")
                      if file_path.suffix in (".glb", ".fbx") and file_path.parent.name in
                      (CANONICAL_FOLDER, ORIGINAL_SCALE_FOLDER)]
    return {
        "total_bytes": folder_size_bytes(SAMPLES_DIR),
        "run_count": sum(1 for run_dir in SAMPLES_DIR.iterdir() if run_dir.is_dir()),
        "exported_file_count": len(exported_files),
    }


def record_job_result(run_dir: Path, finished_status: str, error_message: Optional[str]) -> None:
    """Callback target: store how a run's job ended."""
    if finished_status not in FINISHED_STATUSES:
        return
    update_run_metadata(run_dir, status=finished_status, error_message=error_message, finished_at=datetime.now().timestamp())
