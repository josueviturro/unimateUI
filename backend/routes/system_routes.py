"""Health, jobs (status, live log stream, cancel) and read-only file serving."""

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app_settings import EXAMPLE_ASSETS_DIR, MAX_JOINTS, CLIP_FPS, CLIP_FRAMES, OUTPUTS_DIR, REPO_ROOT
from job_manager import FINISHED_STATUSES, job_manager
from system_status import collect_system_status

system_router = APIRouter()

SERVED_ROOTS = (OUTPUTS_DIR, EXAMPLE_ASSETS_DIR)
EVENT_POLL_SECONDS = 0.4


@system_router.get("/api/health")
def read_health() -> dict:
    """GPU, VRAM, model files, ComfyUI presence and the running job."""
    active_job = job_manager.active_job()
    queued_count = sum(1 for listed_job in job_manager.list_jobs() if listed_job.status == "queued")
    return {
        **collect_system_status(),
        "limits": {"max_joints": MAX_JOINTS, "clip_frames": CLIP_FRAMES, "clip_fps": CLIP_FPS},
        "active_job": active_job.to_summary() if active_job else None,
        "queued_job_count": queued_count,
    }


@system_router.get("/api/jobs")
def list_jobs() -> list:
    """Jobs of this backend session, newest first."""
    return [listed_job.to_summary() for listed_job in job_manager.list_jobs()]


@system_router.get("/api/jobs/{job_id}")
def read_job(job_id: str) -> dict:
    """One job's status plus its full log."""
    target_job = require_job(job_id)
    return {**target_job.to_summary(), "log": job_manager.read_log(target_job, 0)}


@system_router.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict:
    """Cancel a queued or running job."""
    require_job(job_id)
    return {"cancelled": job_manager.cancel(job_id)}


@system_router.get("/api/jobs/{job_id}/events")
async def stream_job_events(job_id: str) -> StreamingResponse:
    """Server-Sent Events: 'log' with new lines and 'status' with progress, until the job ends."""
    target_job = require_job(job_id)

    async def generate_events():
        """Yield new log lines and status snapshots while the job runs."""
        next_log_line = 0
        while True:
            new_log_entries = job_manager.read_log(target_job, next_log_line)
            if new_log_entries:
                # from_line lets the client place lines correctly after an automatic reconnect
                yield format_event("log", {"from_line": next_log_line, "entries": new_log_entries})
                next_log_line += len(new_log_entries)
            yield format_event("status", target_job.to_summary())
            if target_job.status in FINISHED_STATUSES and not job_manager.read_log(target_job, next_log_line):
                yield format_event("end", target_job.to_summary())
                return
            await asyncio.sleep(EVENT_POLL_SECONDS)

    return StreamingResponse(generate_events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@system_router.api_route("/files/{relative_path:path}", methods=["GET", "HEAD"])
def serve_file(relative_path: str) -> FileResponse:
    """Read-only access to outputs/ and assets/examples/ (images, mp4, glb, fbx)."""
    requested_path = (REPO_ROOT / relative_path).resolve()
    allowed = any(served_root.resolve() in requested_path.parents for served_root in SERVED_ROOTS)
    if not allowed or not requested_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(requested_path)


def require_job(job_id: str):
    """Find a job or answer 404."""
    target_job = job_manager.get_job(job_id)
    if target_job is None:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado (¿se reinició el servidor?)")
    return target_job


def format_event(event_name: str, event_payload) -> str:
    """One SSE frame."""
    return f"event: {event_name}\ndata: {json.dumps(event_payload, ensure_ascii=False)}\n\n"
