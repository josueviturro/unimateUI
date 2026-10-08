"""Hardware and installation checks: GPU/VRAM, model files, ComfyUI presence."""

import socket
import subprocess
from typing import Optional

from app_settings import (COMFYUI_PORT, GIT_BASH, MODEL_CHECKPOINT, MODEL_LABEL, VENV_PYTHON,
                          VENV_SCRIPTS_DIR)

MEBIBYTES_PER_GIGABYTE = 1024


def query_gpu() -> Optional[dict]:
    """Read GPU name and VRAM usage from nvidia-smi (None if unavailable)."""
    try:
        smi_output = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.used,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5, check=True).stdout.strip().splitlines()[0]
    except (OSError, subprocess.SubprocessError, IndexError):
        return None
    gpu_name, used_mebibytes, total_mebibytes = [value.strip() for value in smi_output.split(",")]
    used_gigabytes = int(used_mebibytes) / MEBIBYTES_PER_GIGABYTE
    total_gigabytes = int(total_mebibytes) / MEBIBYTES_PER_GIGABYTE
    return {
        "name": gpu_name.replace("NVIDIA GeForce ", ""),
        "vram_used_gb": round(used_gigabytes, 2),
        "vram_total_gb": round(total_gigabytes, 2),
        "vram_free_gb": round(total_gigabytes - used_gigabytes, 2),
    }


def is_comfyui_running() -> bool:
    """True when something listens on ComfyUI's port (it competes for VRAM)."""
    try:
        with socket.create_connection(("127.0.0.1", COMFYUI_PORT), timeout=0.3):
            return True
    except OSError:
        return False


def collect_system_status() -> dict:
    """Everything the top bar needs in one call."""
    return {
        "model_label": MODEL_LABEL,
        "model_ready": MODEL_CHECKPOINT.is_file(),
        "venv_ready": VENV_PYTHON.is_file() and (VENV_SCRIPTS_DIR / "blender").is_file(),
        "git_bash_ready": GIT_BASH.is_file(),
        "gpu": query_gpu(),
        "comfyui_running": is_comfyui_running(),
    }
