"""Character endpoints: list, upload + review, annotation edits, rotation and build."""

import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app_settings import ALLOWED_REST_ROTATIONS, ALLOWED_UPLOAD_EXTENSIONS, RIG_ASSETS_DIR, UPLOADS_DIR
from asset_library import (describe_asset, find_asset_dir, find_source_file, is_example_asset, list_assets,
                           read_annotation, read_asset_metadata, save_annotation, write_asset_metadata)
from command_builder import build_build_step, build_review_step, to_repo_relative
from job_manager import JOB_STATUS_COMPLETED, Job, job_manager
from validation import sanitize_name

asset_router = APIRouter(prefix="/api/assets")


class FacePairPayload(BaseModel):
    """Facing pair chosen in the review screen."""
    right: str = ""
    left: str = ""
    body_axis: bool = False


class JointLabelPayload(BaseModel):
    """One joint's new label."""
    raw: str
    label: str


class AnnotationPayload(BaseModel):
    """Editable part of annotation.json."""
    face_pair: FacePairPayload
    joints: List[JointLabelPayload]


class RotationPayload(BaseModel):
    """Rest-pose correction (rig authored lying down or upside down)."""
    rest_rotation: str = ""


@asset_router.get("")
def get_assets() -> list:
    """All characters with status, joint count and preview URLs."""
    return list_assets()


@asset_router.get("/{asset_name}")
def get_asset(asset_name: str) -> dict:
    """One character."""
    return describe_asset(find_asset_dir(asset_name))


@asset_router.post("")
async def upload_asset(model_file: UploadFile = File(...), display_name: Optional[str] = Form(None),
                       rest_rotation: str = Form("")) -> dict:
    """Save an uploaded GLB/FBX and start rig_preprocess in review mode."""
    file_extension = Path(model_file.filename or "").suffix.lower()
    if file_extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato no soportado: subí un .glb, .gltf o .fbx")
    require_rest_rotation(rest_rotation)
    asset_name = pick_free_asset_name(sanitize_name(display_name or Path(model_file.filename).stem))

    upload_dir = UPLOADS_DIR / asset_name
    upload_dir.mkdir(parents=True, exist_ok=True)
    source_file = upload_dir / f"{asset_name}{file_extension}"
    with open(source_file, "wb") as destination_file:
        shutil.copyfileobj(model_file.file, destination_file)

    asset_dir = RIG_ASSETS_DIR / asset_name
    write_asset_metadata(asset_dir, {
        "display_name": display_name or Path(model_file.filename).stem,
        "source_file": to_repo_relative(source_file),
        "rest_rotation": rest_rotation,
    })
    review_job = submit_asset_job(asset_dir, "review", f"Preparar personaje {asset_name}",
                                  build_review_step(source_file, asset_dir, rest_rotation, None))
    return {"asset_name": asset_name, "job_id": review_job.job_id}


@asset_router.get("/{asset_name}/annotation")
def get_annotation(asset_name: str) -> dict:
    """Joint labels, facing pair, alternatives and label vocabulary."""
    return read_annotation(asset_name)


@asset_router.put("/{asset_name}/annotation")
def put_annotation(asset_name: str, annotation_payload: AnnotationPayload) -> dict:
    """Save edited labels and facing pair."""
    return save_annotation(asset_name, annotation_payload.face_pair.model_dump(),
                           [joint_payload.model_dump() for joint_payload in annotation_payload.joints])


@asset_router.post("/{asset_name}/rotation")
def apply_rotation(asset_name: str, rotation_payload: RotationPayload) -> dict:
    """Re-run the review with a rest rotation, keeping the edited labels."""
    asset_dir, source_file = require_editable_asset(asset_name)
    require_rest_rotation(rotation_payload.rest_rotation)
    asset_metadata = read_asset_metadata(asset_dir)
    asset_metadata["rest_rotation"] = rotation_payload.rest_rotation
    write_asset_metadata(asset_dir, asset_metadata)
    annotation_file = asset_dir / "annotation.json"
    review_job = submit_asset_job(asset_dir, "review", f"Rotar pose de reposo de {asset_name}",
                                  build_review_step(source_file, asset_dir, rotation_payload.rest_rotation,
                                                    annotation_file if annotation_file.is_file() else None))
    return {"job_id": review_job.job_id}


@asset_router.post("/{asset_name}/build")
def build_asset(asset_name: str) -> dict:
    """Build cond.npy + canonical GLB/FBX from the reviewed annotation."""
    asset_dir, source_file = require_editable_asset(asset_name)
    annotation_file = asset_dir / "annotation.json"
    if not annotation_file.is_file():
        raise HTTPException(status_code=409, detail="Primero hay que etiquetar los huesos")
    rest_rotation = read_asset_metadata(asset_dir).get("rest_rotation", "")
    build_job = submit_asset_job(asset_dir, "build", f"Construir esqueleto de {asset_name}",
                                 build_build_step(source_file, asset_dir, annotation_file, rest_rotation))
    return {"job_id": build_job.job_id}


@asset_router.delete("/{asset_name}")
def delete_asset(asset_name: str) -> dict:
    """Remove a user character (its rig folder and uploaded file)."""
    asset_dir = find_asset_dir(asset_name)
    if is_example_asset(asset_dir):
        raise HTTPException(status_code=403, detail="Los personajes de ejemplo no se borran")
    if job_manager.is_related_busy("asset", asset_name):
        raise HTTPException(status_code=409, detail="El personaje está en uso por un trabajo activo")
    shutil.rmtree(asset_dir, ignore_errors=True)
    shutil.rmtree(UPLOADS_DIR / asset_name, ignore_errors=True)
    return {"deleted": asset_name}


def require_rest_rotation(rest_rotation: str) -> None:
    """Only accept the rotations the review screen offers."""
    if rest_rotation not in ALLOWED_REST_ROTATIONS:
        raise HTTPException(status_code=400, detail=f"Rotación no permitida: {rest_rotation}")


def require_editable_asset(asset_name: str):
    """A user asset with its source file, not busy with another job."""
    asset_dir = find_asset_dir(asset_name)
    if is_example_asset(asset_dir):
        raise HTTPException(status_code=403, detail="Los personajes de ejemplo ya están construidos")
    source_file = find_source_file(asset_dir)
    if source_file is None:
        raise HTTPException(status_code=409, detail="No se encontró el archivo original subido")
    if job_manager.is_related_busy("asset", asset_name):
        raise HTTPException(status_code=409, detail="Ya hay un trabajo en curso para este personaje")
    return asset_dir, source_file


def pick_free_asset_name(base_name: str) -> str:
    """base_name, or base_name_2, _3... if a character already uses it."""
    candidate_name, suffix_number = base_name, 2
    while (RIG_ASSETS_DIR / candidate_name).exists() or (UPLOADS_DIR / candidate_name).exists():
        candidate_name = f"{base_name[:60]}_{suffix_number}"
        suffix_number += 1
    return candidate_name


def submit_asset_job(asset_dir: Path, job_kind: str, job_title: str, job_step) -> Job:
    """Queue a rig_preprocess job and record its error (if any) in the asset metadata."""

    def remember_job_result(finished_job: Job) -> None:
        """Store or clear the asset's last error when the job ends."""
        asset_metadata = read_asset_metadata(asset_dir)
        asset_metadata["last_error"] = None if finished_job.status == JOB_STATUS_COMPLETED else (
            finished_job.error_message or finished_job.phase)
        write_asset_metadata(asset_dir, asset_metadata)

    return job_manager.submit(job_kind, job_title, [job_step], related={"asset": asset_dir.name},
                              on_finish=remember_job_result)
