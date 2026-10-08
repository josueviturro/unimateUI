#!/bin/bash
# Applies the Windows fixes UniMate needs (run once from Git Bash, from the UniMate root):
#   bash UI/setup/aplicar_arreglos_windows.sh
# 1. Copies the "blender" shim into .venv/Scripts: the animate step calls "blender -b -P script -- args",
#    and the shim runs that script with the venv's Python (pip bpy 4.0) instead of a real Blender.
# 2. Patches scripts/run_animate_motion.sh to strip Windows CR line endings from the job list
#    (without it: "Unknown dataset 'general'").
set -euo pipefail

UNIMATE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV_SCRIPTS_DIR="$UNIMATE_ROOT/.venv/Scripts"
ANIMATE_SCRIPT="$UNIMATE_ROOT/scripts/run_animate_motion.sh"

if [ ! -x "$VENV_SCRIPTS_DIR/python.exe" ]; then
    echo "ERROR: no encuentro $VENV_SCRIPTS_DIR/python.exe. Creá primero el entorno (ver README)." >&2
    exit 1
fi

cp "$UNIMATE_ROOT/UI/setup/blender" "$VENV_SCRIPTS_DIR/blender"
echo "OK  shim de blender copiado a .venv/Scripts/blender"

if grep -q 'sample_manifest "${LIST_ARGS\[@\]}" | tr -d' "$ANIMATE_SCRIPT"; then
    echo "OK  run_animate_motion.sh ya tenía el arreglo de CR"
else
    "$VENV_SCRIPTS_DIR/python.exe" - "$ANIMATE_SCRIPT" <<'PYTHON'
import sys
from pathlib import Path
script_path = Path(sys.argv[1])
script_text = script_path.read_text(encoding="utf-8")
original_line = 'sample_manifest "${LIST_ARGS[@]}")'
fixed_line = r'''sample_manifest "${LIST_ARGS[@]}" | tr -d "$(printf '\r')")'''
if original_line not in script_text:
    sys.exit("ERROR: no encontré la línea a corregir en run_animate_motion.sh (¿cambió el repo?)")
script_path.write_text(script_text.replace(original_line, fixed_line, 1), encoding="utf-8", newline="\n")
print("OK  run_animate_motion.sh corregido (quita los CR de Windows)")
PYTHON
fi
