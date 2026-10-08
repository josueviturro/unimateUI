"""Generation endpoints: generate, runs (tandas), favorites, re-export, relaunch, ZIP, delete."""

import random
import re
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from app_settings import (MAX_CFG_SCALE, MAX_CHAINED_PROMPTS, MAX_PROMPT_LENGTH, MAX_REPETITIONS, MIN_CFG_SCALE,
                          MIN_REPETITIONS, SAMPLES_DIR)
from asset_library import ASSET_STATUS_READY, describe_asset, find_asset_dir, find_source_file, is_example_asset
from command_builder import build_animate_step, build_sample_step
from job_manager import Job, job_manager
from run_library import (CANONICAL_FOLDER, ORIGINAL_SCALE_FOLDER, delete_run, describe_run_detail, find_manifest_dir,
                         find_run_dir, list_runs, new_run_name, read_run_metadata, record_job_result,
                         storage_summary, toggle_favorite, write_run_metadata)

run_router = APIRouter(prefix="/api")

PROMPT_PREFIX = "An object"
MAX_SEED = 2**31 - 1
DEFAULT_EXPAND_OVERLAP = 10
FORBIDDEN_PROMPT_CHARACTERS = re.compile(r"[\x00-\x1f\"`$\\]")


class GeneratePayload(BaseModel):
    """Parameters of a new generation run."""
    assets: List[str] = Field(min_length=1, max_length=4)
    prompts: List[str] = Field(min_length=1, max_length=MAX_CHAINED_PROMPTS)
    repetitions: int = 3
    cfg_scale: float = 3.0
    seed: Optional[int] = None
    mode: str = "text"                 # "text" (one clip per prompt) | "expand" (chained prompts)
    expand_overlap: int = DEFAULT_EXPAND_OVERLAP
    export_meshes: bool = True


class FavoritePayload(BaseModel):
    """Mark or unmark a variant as favorite."""
    sample_stem: str
    favorite: bool


class AnimatePayload(BaseModel):
    """Re-export options for a run."""
    original_scale: bool = False


class SimilarPayload(BaseModel):
    """Which case (asset × prompt) to generate again with a new seed."""
    case_id: str


@run_router.post("/generate")
def generate(generate_payload: GeneratePayload) -> dict:
    """Start a run: sample motions, then (optionally) export GLB/FBX."""
    return start_generation(generate_payload)


@run_router.get("/runs")
def get_runs() -> list:
    """History table rows, newest first."""
    return list_runs()


@run_router.get("/runs/storage")
def get_storage() -> dict:
    """Disk used by all runs."""
    return storage_summary()


@run_router.get("/runs/{run_name}")
def get_run(run_name: str) -> dict:
    """One run with its cases and variant file URLs."""
    return describe_run_detail(run_name)


@run_router.put("/runs/{run_name}/favorites")
def put_favorite(run_name: str, favorite_payload: FavoritePayload) -> dict:
    """Toggle a favorite variant."""
    return {"favorites": toggle_favorite(run_name, favorite_payload.sample_stem, favorite_payload.favorite)}


@run_router.post("/runs/{run_name}/animate")
def animate_run(run_name: str, animate_payload: AnimatePayload) -> dict:
    """Export GLB/FBX for a run, canonical or at the character's original scale."""
    run_dir = find_run_dir(run_name)
    manifest_dir = find_manifest_dir(run_dir)
    if manifest_dir is None:
        raise HTTPException(status_code=409, detail="La tanda no tiene movimientos generados")
    if job_manager.is_related_busy("run", run_name):
        raise HTTPException(status_code=409, detail="La tanda ya tiene un trabajo en curso")
    character_override = None
    output_folder = CANONICAL_FOLDER
    if animate_payload.original_scale:
        character_override = require_original_character(read_run_metadata(run_dir).get("assets", []))
        output_folder = ORIGINAL_SCALE_FOLDER
    animate_step = build_animate_step(manifest_dir, manifest_dir / output_folder, character_override)
    animate_job = submit_run_job(run_dir, f"Exportar tanda {run_name}", [animate_step])
    return {"job_id": animate_job.job_id}


@run_router.post("/runs/{run_name}/relaunch")
def relaunch_run(run_name: str) -> dict:
    """Same assets, prompts and settings as an earlier run, with a new seed."""
    run_metadata = read_run_metadata(find_run_dir(run_name))
    if not run_metadata.get("assets") or not run_metadata.get("prompts"):
        raise HTTPException(status_code=409, detail="Esta tanda no se creó desde la interfaz: faltan sus parámetros")
    return start_generation(GeneratePayload(
        assets=run_metadata["assets"], prompts=run_metadata["prompts"],
        repetitions=run_metadata.get("repetitions") or 3, cfg_scale=run_metadata.get("cfg_scale") or 3.0,
        mode=run_metadata.get("mode", "text"), expand_overlap=run_metadata.get("expand_overlap", DEFAULT_EXPAND_OVERLAP)))


@run_router.post("/runs/{run_name}/similar")
def generate_similar(run_name: str, similar_payload: SimilarPayload) -> dict:
    """Generate more variants of one case: same prompt and character, new seed."""
    run_detail = describe_run_detail(run_name)
    matching_case = next((case_entry for case_entry in run_detail["cases"]
                          if case_entry["case_id"] == similar_payload.case_id), None)
    if matching_case is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado en la tanda")
    case_prompts = [prompt_part.strip() for prompt_part in matching_case["prompt"].split("→")]
    case_asset_name = resolve_case_asset_name(matching_case["asset"], run_detail["assets"])
    return start_generation(GeneratePayload(
        assets=[case_asset_name], prompts=case_prompts,
        repetitions=run_detail.get("repetitions") or 3, cfg_scale=run_detail.get("cfg_scale") or 3.0,
        mode=run_detail.get("mode", "text")))


@run_router.get("/runs/{run_name}/zip")
def download_run_zip(run_name: str, scale: str = "canonical") -> FileResponse:
    """ZIP with every exported GLB/FBX of a run (plus textures)."""
    run_dir = find_run_dir(run_name)
    manifest_dir = find_manifest_dir(run_dir)
    export_dir = manifest_dir / (ORIGINAL_SCALE_FOLDER if scale == "original" else CANONICAL_FOLDER) if manifest_dir else None
    if export_dir is None or not export_dir.is_dir():
        raise HTTPException(status_code=404, detail="Esta tanda todavía no tiene archivos exportados")
    temporary_zip = Path(tempfile.mkstemp(suffix=".zip")[1])
    with zipfile.ZipFile(temporary_zip, "w", zipfile.ZIP_DEFLATED) as zip_archive:
        for exported_file in export_dir.rglob("*"):
            if exported_file.is_file():
                zip_archive.write(exported_file, exported_file.relative_to(export_dir).as_posix())
    return FileResponse(temporary_zip, filename=f"{run_name}_{scale}.zip", media_type="application/zip",
                        background=BackgroundTask(temporary_zip.unlink, missing_ok=True))


@run_router.delete("/runs/{run_name}")
def remove_run(run_name: str) -> dict:
    """Delete a run folder."""
    delete_run(run_name)
    return {"deleted": run_name}


def normalize_prompt(raw_prompt: str) -> str:
    """Clean a prompt and make sure it reads 'An object ... .'."""
    prompt_text = " ".join(raw_prompt.split())
    if FORBIDDEN_PROMPT_CHARACTERS.search(prompt_text):
        raise HTTPException(status_code=400, detail="El prompt tiene caracteres no permitidos")
    if not prompt_text.lower().startswith(PROMPT_PREFIX.lower()):
        prompt_text = f"{PROMPT_PREFIX} {prompt_text}"
    if not prompt_text.endswith("."):
        prompt_text += "."
    if len(prompt_text) <= len(PROMPT_PREFIX) + 2:
        raise HTTPException(status_code=400, detail="El prompt está vacío")
    if len(prompt_text) > MAX_PROMPT_LENGTH:
        raise HTTPException(status_code=400, detail=f"El prompt supera {MAX_PROMPT_LENGTH} caracteres")
    return prompt_text


def resolve_case_asset_name(manifest_asset_name: str, run_asset_names: List[str]) -> str:
    """Folder name of a case's character (the manifest may use the rig's internal name)."""
    if manifest_asset_name in run_asset_names:
        return manifest_asset_name
    if len(run_asset_names) == 1:
        return run_asset_names[0]
    return manifest_asset_name


def require_ready_assets(asset_names: List[str]) -> List[str]:
    """Asset references for the sampler; every asset must be built and fit the model."""
    asset_references = []
    for asset_name in dict.fromkeys(asset_names):
        asset_info = describe_asset(find_asset_dir(asset_name))
        if asset_info["status"] != ASSET_STATUS_READY:
            raise HTTPException(status_code=409, detail=f"'{asset_name}' no está listo para animar")
        asset_references.append(asset_info["asset_reference"])
    return asset_references


def require_original_character(asset_names: List[str]) -> Path:
    """The uploaded file to drive at original scale (single user asset runs only)."""
    if len(asset_names) != 1:
        raise HTTPException(status_code=409, detail="La escala original solo se puede usar con un personaje por tanda")
    asset_dir = find_asset_dir(asset_names[0])
    source_file = None if is_example_asset(asset_dir) else find_source_file(asset_dir)
    if source_file is None:
        raise HTTPException(status_code=409, detail="Este personaje no tiene archivo original (los ejemplos solo exportan canónico)")
    return source_file


def start_generation(generate_payload: GeneratePayload) -> dict:
    """Validate parameters, create the run folder and queue sample (+ animate)."""
    if not MIN_REPETITIONS <= generate_payload.repetitions <= MAX_REPETITIONS:
        raise HTTPException(status_code=400, detail=f"Variantes entre {MIN_REPETITIONS} y {MAX_REPETITIONS}")
    if not MIN_CFG_SCALE <= generate_payload.cfg_scale <= MAX_CFG_SCALE:
        raise HTTPException(status_code=400, detail=f"CFG entre {MIN_CFG_SCALE} y {MAX_CFG_SCALE}")
    if generate_payload.mode not in ("text", "expand"):
        raise HTTPException(status_code=400, detail="Modo inválido")
    chain_prompts = generate_payload.mode == "expand"
    if chain_prompts and len(generate_payload.prompts) < 2:
        raise HTTPException(status_code=400, detail="El modo encadenado necesita al menos 2 acciones")
    # the sampler needs cfg > 1 for chained prompts
    cfg_scale = max(generate_payload.cfg_scale, 1.5) if chain_prompts else generate_payload.cfg_scale

    prompts = [normalize_prompt(raw_prompt) for raw_prompt in generate_payload.prompts]
    asset_references = require_ready_assets(generate_payload.assets)
    seed = generate_payload.seed if generate_payload.seed is not None else random.randint(0, MAX_SEED)
    if not 0 <= seed <= MAX_SEED:
        raise HTTPException(status_code=400, detail="Semilla fuera de rango")

    run_name = new_run_name()
    run_dir = SAMPLES_DIR / run_name
    write_run_metadata(run_dir, {
        "run_name": run_name,
        "created_at": datetime.now().timestamp(),
        "assets": list(dict.fromkeys(generate_payload.assets)),
        "prompts": prompts,
        "repetitions": generate_payload.repetitions,
        "cfg_scale": cfg_scale,
        "seed": seed,
        "mode": generate_payload.mode,
        "expand_overlap": generate_payload.expand_overlap,
        "status": "queued",
        "favorites": [],
    })
    job_steps = [build_sample_step(asset_references, prompts, generate_payload.repetitions, cfg_scale, seed,
                                   run_dir, chain_prompts, generate_payload.expand_overlap)]
    if generate_payload.export_meshes:
        manifest_dir = run_dir / "motion_expand" if chain_prompts else run_dir
        job_steps.append(build_animate_step(manifest_dir, manifest_dir / CANONICAL_FOLDER, None))
    generation_job = submit_run_job(run_dir, f"Tanda {run_name}: {prompts[0]}", job_steps)
    write_run_metadata(run_dir, {**read_run_metadata(run_dir), "job_id": generation_job.job_id})
    return {"run_name": run_name, "job_id": generation_job.job_id, "seed": seed}


def submit_run_job(run_dir: Path, job_title: str, job_steps: list) -> Job:
    """Queue a job tied to a run and store its outcome in the run metadata."""

    def remember_job_result(finished_job: Job) -> None:
        """Save the final status of the run's job."""
        record_job_result(run_dir, finished_job.status, finished_job.error_message)

    return job_manager.submit("generate", job_title, job_steps, related={"run": run_dir.name},
                              on_finish=remember_job_result)
