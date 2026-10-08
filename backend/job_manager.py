"""GPU job queue: runs UniMate CLI steps one at a time as subprocesses and keeps their logs."""

import os
import queue
import re
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Dict, List, Optional

from app_settings import REPO_ROOT, VENV_SCRIPTS_DIR

MAX_LOG_LINES = 3000
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
SAMPLE_PROGRESS_PATTERN = re.compile(r"rep#(\d+) (?:chunk|case)\[")
ANIMATE_PROGRESS_PATTERN = re.compile(r"^# \[(\d+)/(\d+)\]")
HARMLESS_ERROR_LINES = ("Not freed memory blocks", "Draco mesh compression is not available")

JOB_STATUS_QUEUED = "queued"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"
FINISHED_STATUSES = {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}

# GPU jobs (sampling, rig preprocessing, mesh export) run one at a time; quick CPU-only jobs
# (e.g. making a loop) get their own queue so they never wait behind a generation.
QUEUE_GPU = "gpu"
QUEUE_CPU = "cpu"


@dataclass
class JobStep:
    """One subprocess of a job (e.g. 'sample' or 'animate')."""
    label: str
    command: List[str]
    progress_kind: str = "none"          # "sample" | "animate" | "none"
    expected_units: int = 1              # repetitions for sample; motions for animate (if known)
    weight: float = 1.0                  # share of the job's total progress
    extra_environment: Dict[str, str] = field(default_factory=dict)
    success_marker: Optional[str] = None  # text that must appear in the log for success


@dataclass
class Job:
    """A queued or running pipeline job with its log and progress."""
    job_id: str
    kind: str
    title: str
    steps: List[JobStep]
    queue_name: str = QUEUE_GPU
    related: Dict[str, str] = field(default_factory=dict)
    on_finish: Optional[Callable[["Job"], None]] = None
    status: str = JOB_STATUS_QUEUED
    phase: str = "En cola"
    progress: Optional[float] = 0.0
    log_entries: List[dict] = field(default_factory=list)
    log_offset: int = 0                  # how many old lines were dropped from the front
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    current_step_index: int = 0
    error_message: Optional[str] = None
    cancel_requested: bool = False
    process: Optional[subprocess.Popen] = None

    def to_summary(self) -> dict:
        """Serializable view of the job (without the log)."""
        return {
            "job_id": self.job_id,
            "kind": self.kind,
            "queue_name": self.queue_name,
            "title": self.title,
            "status": self.status,
            "phase": self.phase,
            "progress": self.progress,
            "related": self.related,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "current_step": self.current_step_index + 1,
            "total_steps": len(self.steps),
            "error_message": self.error_message,
            "log_line_count": self.log_offset + len(self.log_entries),
        }


def build_process_environment(extra_environment: Dict[str, str]) -> Dict[str, str]:
    """Environment for UniMate subprocesses: venv first in PATH, UTF-8 output."""
    process_environment = dict(os.environ)
    process_environment["PATH"] = str(VENV_SCRIPTS_DIR) + os.pathsep + process_environment.get("PATH", "")
    process_environment["PYTHONIOENCODING"] = "utf-8"
    process_environment["PYTHONUNBUFFERED"] = "1"
    process_environment["NO_COLOR"] = "1"
    process_environment["COLUMNS"] = "240"   # rich wraps log lines at 80 columns otherwise
    process_environment.update(extra_environment)
    return process_environment


def classify_log_level(line_text: str) -> str:
    """Guess a display level for one log line."""
    if any(harmless_text in line_text for harmless_text in HARMLESS_ERROR_LINES):
        return "info"
    if "ERROR" in line_text or "Traceback" in line_text or "Error:" in line_text:
        return "error"
    if "WARNING" in line_text or "warning:" in line_text:
        return "warning"
    if "SUCCESS" in line_text or "BATCH DONE" in line_text:
        return "success"
    return "info"


class JobManager:
    """One worker per queue: GPU jobs never run in parallel; CPU jobs run beside them."""

    def __init__(self) -> None:
        """Start one background worker thread per queue."""
        self.jobs_by_id: Dict[str, Job] = {}
        self.pending_jobs_by_queue: Dict[str, "queue.Queue[Job]"] = {QUEUE_GPU: queue.Queue(), QUEUE_CPU: queue.Queue()}
        self.state_lock = threading.Lock()
        for queue_name in self.pending_jobs_by_queue:
            threading.Thread(target=self._worker_loop, args=(queue_name,), daemon=True).start()

    # ---- public API -------------------------------------------------------

    def submit(self, kind: str, title: str, steps: List[JobStep], related: Optional[Dict[str, str]] = None,
               on_finish: Optional[Callable[[Job], None]] = None, queue_name: str = QUEUE_GPU) -> Job:
        """Queue a new job on the GPU (default) or CPU queue and return it."""
        new_job = Job(job_id=uuid.uuid4().hex[:12], kind=kind, title=title, steps=steps, queue_name=queue_name,
                      related=related or {}, on_finish=on_finish)
        with self.state_lock:
            self.jobs_by_id[new_job.job_id] = new_job
        self._append_log(new_job, f"Trabajo en cola: {title}")
        self.pending_jobs_by_queue[queue_name].put(new_job)
        return new_job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Find a job by id."""
        return self.jobs_by_id.get(job_id)

    def list_jobs(self) -> List[Job]:
        """All jobs of this backend session, newest first."""
        return sorted(self.jobs_by_id.values(), key=lambda listed_job: listed_job.created_at, reverse=True)

    def active_job(self) -> Optional[Job]:
        """The running job, if any (GPU jobs first)."""
        running_jobs = [listed_job for listed_job in self.jobs_by_id.values() if listed_job.status == JOB_STATUS_RUNNING]
        return next((running_job for running_job in running_jobs if running_job.queue_name == QUEUE_GPU),
                    running_jobs[0] if running_jobs else None)

    def is_related_busy(self, related_key: str, related_value: str) -> bool:
        """True when an unfinished job targets the same asset/run."""
        return any(listed_job.related.get(related_key) == related_value and listed_job.status not in FINISHED_STATUSES
                   for listed_job in self.jobs_by_id.values())

    def cancel(self, job_id: str) -> bool:
        """Cancel a queued job, or kill the process tree of a running one."""
        target_job = self.get_job(job_id)
        if target_job is None or target_job.status in FINISHED_STATUSES:
            return False
        target_job.cancel_requested = True
        if target_job.status == JOB_STATUS_RUNNING and target_job.process is not None:
            kill_process_tree(target_job.process.pid)
        self._append_log(target_job, "Cancelación solicitada por el usuario", "warning")
        return True

    def read_log(self, job: Job, from_line: int) -> List[dict]:
        """Log entries from an absolute line number on."""
        start_index = max(0, from_line - job.log_offset)
        return job.log_entries[start_index:]

    # ---- worker -----------------------------------------------------------

    def _worker_loop(self, queue_name: str) -> None:
        """Take jobs from one queue forever, one at a time."""
        while True:
            next_job = self.pending_jobs_by_queue[queue_name].get()
            if next_job.cancel_requested:
                self._finish(next_job, JOB_STATUS_CANCELLED)
                continue
            self._run_job(next_job)

    def _run_job(self, job: Job) -> None:
        """Run every step of a job in order; stop at the first failure."""
        job.status = JOB_STATUS_RUNNING
        job.started_at = time.time()
        completed_weight = 0.0
        total_weight = sum(job_step.weight for job_step in job.steps) or 1.0
        for step_index, job_step in enumerate(job.steps):
            job.current_step_index = step_index
            job.phase = job_step.label
            step_succeeded = self._run_step(job, job_step, completed_weight / total_weight,
                                            job_step.weight / total_weight)
            if job.cancel_requested:
                self._finish(job, JOB_STATUS_CANCELLED)
                return
            if not step_succeeded:
                self._finish(job, JOB_STATUS_FAILED)
                return
            completed_weight += job_step.weight
        job.progress = 1.0
        self._finish(job, JOB_STATUS_COMPLETED)

    def _run_step(self, job: Job, job_step: JobStep, progress_start: float, progress_share: float) -> bool:
        """Spawn one subprocess, stream its output into the job log, return success."""
        self._append_log(job, f"▶ {job_step.label}", "step")
        self._append_log(job, "$ " + " ".join(quote_for_display(argument) for argument in job_step.command), "command")
        job.progress = progress_start if job_step.progress_kind != "none" else None
        try:
            job.process = subprocess.Popen(
                job_step.command, cwd=str(REPO_ROOT), env=build_process_environment(job_step.extra_environment),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                text=True, encoding="utf-8", errors="replace", bufsize=1,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        except OSError as launch_error:
            job.error_message = f"No se pudo iniciar el proceso: {launch_error}"
            self._append_log(job, job.error_message, "error")
            return False

        success_marker_seen = job_step.success_marker is None
        last_error_line = None
        for raw_line in job.process.stdout:
            line_text = ANSI_ESCAPE_PATTERN.sub("", raw_line).rstrip()
            if not line_text.strip():
                continue
            line_level = classify_log_level(line_text)
            if line_level == "error":
                last_error_line = line_text
            if job_step.success_marker and job_step.success_marker in line_text:
                success_marker_seen = True
            self._append_log(job, line_text, line_level)
            self._update_progress(job, job_step, line_text, progress_start, progress_share)
        return_code = job.process.wait()
        job.process = None
        if return_code != 0 or not success_marker_seen:
            if not job.cancel_requested:
                job.error_message = last_error_line or f"{job_step.label} terminó con código {return_code}"
                self._append_log(job, f"✖ {job_step.label} falló (código {return_code})", "error")
            return False
        self._append_log(job, f"✔ {job_step.label} terminado", "success")
        return True

    def _update_progress(self, job: Job, job_step: JobStep, line_text: str, progress_start: float,
                         progress_share: float) -> None:
        """Parse CLI progress lines into the job's progress and phase."""
        if "Loading checkpoints" in line_text:
            job.phase = "Cargando modelo UniMate"
        if job_step.progress_kind == "sample":
            sample_match = SAMPLE_PROGRESS_PATTERN.search(line_text)
            if sample_match:
                finished_repetitions = int(sample_match.group(1)) + 1
                step_fraction = min(1.0, finished_repetitions / max(1, job_step.expected_units))
                job.progress = progress_start + progress_share * step_fraction
                job.phase = f"Generando movimientos (repetición {finished_repetitions}/{job_step.expected_units})"
        elif job_step.progress_kind == "animate":
            animate_match = ANIMATE_PROGRESS_PATTERN.search(line_text)
            if animate_match:
                current_motion, total_motions = int(animate_match.group(1)), int(animate_match.group(2))
                job.progress = progress_start + progress_share * (current_motion - 1) / max(1, total_motions)
                job.phase = f"Exportando GLB/FBX ({current_motion}/{total_motions})"

    def _finish(self, job: Job, final_status: str) -> None:
        """Mark a job finished and run its callback."""
        job.status = final_status
        job.finished_at = time.time()
        job.phase = {JOB_STATUS_COMPLETED: "Completado", JOB_STATUS_FAILED: "Error",
                     JOB_STATUS_CANCELLED: "Cancelado"}[final_status]
        if final_status == JOB_STATUS_COMPLETED:
            job.progress = 1.0
        self._append_log(job, f"Trabajo {job.phase.lower()}", "success" if final_status == JOB_STATUS_COMPLETED else "warning")
        if job.on_finish is not None:
            try:
                job.on_finish(job)
            except Exception as callback_error:  # a broken callback must not kill the worker
                self._append_log(job, f"Error al cerrar el trabajo: {callback_error}", "error")

    def _append_log(self, job: Job, line_text: str, line_level: str = "info") -> None:
        """Add one timestamped line to the job log, trimming old lines."""
        job.log_entries.append({"time": datetime.now().strftime("%H:%M:%S"), "text": line_text, "level": line_level})
        overflow_count = len(job.log_entries) - MAX_LOG_LINES
        if overflow_count > 0:
            del job.log_entries[:overflow_count]
            job.log_offset += overflow_count


def kill_process_tree(process_id: int) -> None:
    """Kill a process and all its children (Windows)."""
    subprocess.run(["taskkill", "/PID", str(process_id), "/T", "/F"], stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, check=False)


def quote_for_display(argument: str) -> str:
    """Quote an argument with spaces so the logged command reads correctly."""
    return f'"{argument}"' if " " in argument else argument


job_manager = JobManager()
