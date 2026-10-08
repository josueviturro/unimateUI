"""Builds argument lists for every UniMate CLI step (never raw shell strings)."""

from pathlib import Path
from typing import Dict, List, Optional

from app_settings import ANIMATE_SCRIPT, GIT_BASH, MODEL_EXP_DIR, REPO_ROOT, VENV_PYTHON
from job_manager import JobStep


def to_repo_relative(target_path: Path) -> str:
    """Path relative to the repo root with forward slashes (what the CLIs expect)."""
    return target_path.resolve().relative_to(REPO_ROOT).as_posix()


def build_review_step(source_file: Path, asset_dir: Path, rest_rotation: str,
                      existing_annotation: Optional[Path]) -> JobStep:
    """rig_preprocess in review mode: labels the joints and stops for checking."""
    command = [str(VENV_PYTHON), "-m", "data_process.rig_preprocess", "run",
               "--input", to_repo_relative(source_file), "--output_dir", to_repo_relative(asset_dir), "--review"]
    if existing_annotation is not None:
        # keep the reviewer's labels while re-rendering (e.g. after a rest rotation change)
        command += ["--annotation", to_repo_relative(existing_annotation)]
    else:
        command += ["--overwrite"]
    if rest_rotation:
        command += ["--rest_rotation", rest_rotation]
    return JobStep(label="Etiquetando huesos (revisión)", command=command)


def build_build_step(source_file: Path, asset_dir: Path, annotation_file: Path, rest_rotation: str) -> JobStep:
    """rig_preprocess from a reviewed annotation: writes cond.npy and the canonical GLB/FBX."""
    command = [str(VENV_PYTHON), "-m", "data_process.rig_preprocess", "run",
               "--input", to_repo_relative(source_file), "--output_dir", to_repo_relative(asset_dir),
               "--annotation", to_repo_relative(annotation_file), "--formats", "glb,fbx", "--overwrite"]
    if rest_rotation:
        command += ["--rest_rotation", rest_rotation]
    return JobStep(label="Construyendo esqueleto", command=command)


def build_sample_step(asset_references: List[str], prompts: List[str], repetitions: int, cfg_scale: float,
                      seed: int, run_dir: Path, chain_prompts: bool, expand_overlap: int) -> JobStep:
    """unimate.inference.sample: generates the motions and their preview videos."""
    command = [str(VENV_PYTHON), "-m", "unimate.inference.sample",
               "--exp_dir", to_repo_relative(MODEL_EXP_DIR),
               "--asset", *asset_references,
               "--prompt", *prompts,
               "--num_repetitions", str(repetitions),
               "--cfg_scale", str(cfg_scale),
               "--seed", str(seed),
               "--output_dir", to_repo_relative(run_dir)]
    if chain_prompts:
        command += ["--motion_expand", "--expand_overlap", str(expand_overlap)]
    return JobStep(label="Generando movimientos", command=command, progress_kind="sample",
                   expected_units=repetitions, weight=3.0)


def build_animate_step(manifest_dir: Path, output_dir: Path, character_override: Optional[Path]) -> JobStep:
    """run_animate_motion.sh: drives the mesh with each motion and exports GLB + FBX."""
    command = [str(GIT_BASH), ANIMATE_SCRIPT, to_repo_relative(manifest_dir), to_repo_relative(output_dir)]
    extra_environment: Dict[str, str] = {"SKIP_INVALID": "1"}
    if character_override is not None:
        extra_environment["CHAR_PATH"] = to_repo_relative(character_override)
    return JobStep(label="Exportando GLB/FBX", command=command, progress_kind="animate", weight=1.0,
                   extra_environment=extra_environment, success_marker="BATCH DONE")
