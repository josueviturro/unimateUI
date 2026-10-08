"""Paths and constants shared by the whole backend."""

from pathlib import Path

# UniMate repo root (this file lives in UI/backend/)
REPO_ROOT = Path(__file__).resolve().parents[2]

VENV_SCRIPTS_DIR = REPO_ROOT / ".venv" / "Scripts"
VENV_PYTHON = VENV_SCRIPTS_DIR / "python.exe"
GIT_BASH = Path(r"C:\Program Files\Git\bin\bash.exe")

OUTPUTS_DIR = REPO_ROOT / "outputs"
EXAMPLE_ASSETS_DIR = REPO_ROOT / "assets" / "examples"
RIG_ASSETS_DIR = OUTPUTS_DIR / "rig"
UPLOADS_DIR = OUTPUTS_DIR / "uploads"
SAMPLES_DIR = OUTPUTS_DIR / "samples"

MODEL_EXP_DIR = OUTPUTS_DIR / "unimate_uniml3d_f60_v3"
MODEL_CHECKPOINT = MODEL_EXP_DIR / "checkpoints" / "checkpoint_step_150000.pt"
MODEL_LABEL = "UniMate v3 · checkpoint 150k"

ANIMATE_SCRIPT = "scripts/run_animate_motion.sh"

FRONTEND_DIST_DIR = REPO_ROOT / "UI" / "frontend" / "dist"

# Model limits and clip format
MAX_JOINTS = 70
CLIP_FRAMES = 60
CLIP_FPS = 30

# Generation parameter ranges (validated server-side)
MIN_REPETITIONS, MAX_REPETITIONS = 1, 5
MIN_CFG_SCALE, MAX_CFG_SCALE = 1.0, 7.0
MAX_PROMPT_LENGTH = 120
MAX_CHAINED_PROMPTS = 6

# ComfyUI only matters as a VRAM competitor
COMFYUI_PORT = 8188

ALLOWED_UPLOAD_EXTENSIONS = {".glb", ".gltf", ".fbx"}
ALLOWED_REST_ROTATIONS = {"", "x90", "x-90", "x180", "y180", "z90", "z-90"}

RUN_METADATA_FILE = "ui_run.json"
ASSET_METADATA_FILE = "ui_asset.json"

DEV_FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
