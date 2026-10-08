# UniMate Studio

**[English](#english) · [Español](#español)**

---

## English

Graphical interface for [UniMate](https://github.com/Friedrich-M/UniMate) (SIGGRAPH Asia 2026): text → skeletal animation for any rigged character (bipeds, quadrupeds, birds, fish, robots…). A React frontend drives the UniMate command-line tools through a local FastAPI backend.

```
React (Vite)  ⇄  FastAPI (UI/backend, UniMate venv)  ⇄  subprocesses: rig_preprocess / sample / run_animate_motion.sh
```

> **License:** UniMate's code is MIT, but its **checkpoints are CC BY-NC 4.0 (non-commercial)**. Animations generated with them cannot be used commercially.

### Requirements

- Windows 10/11 with an **NVIDIA GPU** (8 GB VRAM is enough) and up-to-date drivers (`nvidia-smi` must work)
- [Git for Windows](https://git-scm.com/download/win) (includes Git Bash, installed at `C:\Program Files\Git\bin\bash.exe`)
- [Node.js](https://nodejs.org) 20 or newer
- [uv](https://docs.astral.sh/uv/) (installs Python 3.10 for you) — `winget install astral-sh.uv`
- ~10 GB of disk (Python environment + 1.2 GB checkpoint)

### Installation (from scratch)

Run every command in **Git Bash**.

**1. Download UniMate and create its environment**

```bash
git clone https://github.com/Friedrich-M/UniMate.git
cd UniMate
uv venv --python 3.10 --seed .venv
.venv/Scripts/python.exe -m pip install "setuptools<81"
.venv/Scripts/python.exe -m pip install -r requirements.txt --no-build-isolation
```

This installs PyTorch 2.5.1 (CUDA 12.4), bpy 4.0 (Blender as a Python module) and the rest. It takes a while.
UniMate's own README uses conda. A venv works the same way, and the interface expects it at `UniMate/.venv`.

**2. Download the model checkpoint (1.2 GB)**

```bash
.venv/Scripts/hf.exe download Linzhan/UniMate --repo-type model --local-dir outputs \
    --include "unimate_uniml3d_f60_v3/*.json" --include "unimate_uniml3d_f60_v3/*.npy" \
    --include "unimate_uniml3d_f60_v3/checkpoints/checkpoint_step_150000.pt"
```

**3. Download this interface into `UniMate/UI`**

```bash
git clone https://github.com/josueviturro/unimateUI.git UI
```

**4. Apply the Windows fixes** (only once)

```bash
bash UI/setup/aplicar_arreglos_windows.sh
```

It does two things:
- Copies a `blender` shim into `.venv/Scripts`. UniMate's export step calls `blender`, and the shim runs it with the venv's bpy instead.
- Patches `scripts/run_animate_motion.sh` so it strips Windows line endings. Without this, you get the error `Unknown dataset 'general'`.

**5. Install the interface dependencies**

```bash
uv pip install --python .venv/Scripts/python.exe fastapi "uvicorn[standard]" python-multipart
cd UI/frontend && npm install && cd ../..
```

**6. Check that UniMate works** (optional, about 1 minute)

```bash
export PATH="$PWD/.venv/Scripts:$PATH" PYTHONIOENCODING=utf-8
python -m unimate.inference.sample --exp_dir outputs/unimate_uniml3d_f60_v3 \
    --asset assets/examples/shark --prompt "An object swims forward." --output_dir outputs/samples/test
bash scripts/run_animate_motion.sh outputs/samples/test
```

If the output ends with `BATCH DONE`, everything is installed.

### Starting it

- **Normal use:** double-click `UI\iniciar_unimate_studio.bat`. The first time, it builds the interface. It then opens **http://localhost:8000**. Keep the black console window open while you use the app, and close it to stop the app.
- **Development** (instant reload), in two terminals from the UniMate root:

  ```bash
  .venv/Scripts/python.exe -m uvicorn main:app --app-dir UI/backend --port 8000 --reload --reload-dir UI/backend
  cd UI/frontend && npm run dev          # http://localhost:5173
  ```

If you change the frontend code, delete `UI/frontend/dist` (or run `npm run build`) so the .bat rebuilds it.

### How to use it

Close ComfyUI, Unreal or anything else using the GPU before generating. A yellow warning appears at the top while ComfyUI is open.

1. **Characters.** Export your rigged character from Blender as GLB/FBX with **only the deforming bones**: no IK/MCH controllers, fingers or face bones, and **at most 70 bones**. Drag the file in, give it a name and click "Subir y etiquetar huesos". It then shows up as "Necesita revisión".
2. **Bone review.**
   - The character must stand upright and face **+Z** (the green arrow). If it does not, use the rotation buttons.
   - Choose the **facing pair**: two symmetric bones, ideally the thighs.
   - Fix the bones marked ⚠. Labels are in English: `Left Thigh`, `Spine`, `Tail End`…
   - Click **"Construir esqueleto"**. The character becomes "Listo".
3. **Generator.**
   - Tick the characters to animate.
   - Pick **Normal** (one 2 s clip) or **Encadenado** (several actions joined into one clip).
   - Write a **short, single action** in English after the fixed "An object" prefix, for example `walks forward` or `roars`. Do not describe the character.
   - Variants: 3. CFG: 3 (raise it to 5–7 if the prompt is ignored). Seed: leave empty.
   - Click "Generar animación" and follow the live log.
4. **3D results.**
   - Each variant shows the skeleton video and the animated model on one timeline. **⛶ Ampliar** enlarges it, and ⌖ re-frames the view.
   - Mark favorites, use "Generar más parecidas" (same prompt, new seed), and download GLB/FBX per variant or the whole run as a ZIP.
   - Export options: **Canónico** (centered, size-normalized, facing +Z, so rescale it in Unreal) or **escala original** (experimental: animates your uploaded file).
5. **History.** All runs, with search and filters. You can open, relaunch (new seed), download or delete each one.

Clips are **2 s, 60 frames, 30 fps**. To use one in Unreal, import the FBX as an animation for the character's skeleton.

### Where files are saved

| What | Folder |
|---|---|
| Uploaded files | `outputs/uploads/<name>/` |
| Built characters | `outputs/rig/<name>/` (+ `ui_asset.json`) |
| Runs | `outputs/samples/run_YYYYMMDD_HHMMSS/` (+ `ui_run.json`: parameters, status, favorites) |
| Chained runs | inside the run, in `motion_expand/` |
| Exports | `animated/` (canonical) and `animated_original/` (original scale) |

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Unknown dataset 'general'` | Run `bash UI/setup/aplicar_arreglos_windows.sh` |
| `blender: command not found` | Same script (the `blender` shim is missing) |
| CUDA out of memory | Close ComfyUI/Unreal, then generate fewer variants |
| "No entra" (more than 70 bones) | Re-export only the deforming bones |
| Character lies down or faces backwards | Rotation buttons on screen 2, then rebuild |
| The prompt is ignored | Shorter "An object …" prompt, CFG 5–7, more variants |
| The interface shows "Backend desconectado" | The .bat console was closed; open it again |

### Project structure

| Path | What it does |
|---|---|
| `backend/main.py` | FastAPI app; serves `frontend/dist` |
| `backend/app_settings.py` | Paths and constants |
| `backend/job_manager.py` | GPU job queue (one job at a time), live log, progress, cancel |
| `backend/command_builder.py` | Argument lists for each UniMate command (never shell strings) |
| `backend/asset_library.py` / `run_library.py` | Characters and runs on disk |
| `backend/system_status.py` | GPU/VRAM, checkpoint, ComfyUI detection |
| `backend/routes/` | HTTP endpoints (`/api/...`, `/files/...`, SSE log stream) |
| `frontend/src/views/` | The 5 screens |
| `frontend/src/components/` | Shared components (buttons, panels, 3D viewer, job console) |
| `frontend/src/styles/design_tokens.css` | Colors, spacing and typography variables |
| `setup/` | `blender` shim and the Windows fixes script |

Code conventions:
- Components use **CSS Modules**.
- Class names are `snake_case` and start with the element's role: `container_*`, `panel_*`, `button_*`, `text_*`, `badge_*`… (e.g. `container_general_view`).
- Variable names are descriptive (no single letters).
- Every function has a short comment describing what it does.

---

## Español

Interfaz gráfica para [UniMate](https://github.com/Friedrich-M/UniMate) (SIGGRAPH Asia 2026): texto → animación esquelética para cualquier personaje riggeado (bípedos, cuadrúpedos, aves, peces, robots…). Un frontend en React maneja las herramientas de línea de comandos de UniMate a través de un backend local en FastAPI.

```
React (Vite)  ⇄  FastAPI (UI/backend, venv de UniMate)  ⇄  subprocesos: rig_preprocess / sample / run_animate_motion.sh
```

> **Licencia:** el código de UniMate es MIT, pero sus **checkpoints son CC BY-NC 4.0 (no comercial)**. Las animaciones generadas con ellos no se pueden usar con fines comerciales.

### Requisitos

- Windows 10/11 con **GPU NVIDIA** (alcanza con 8 GB de VRAM) y drivers al día (`nvidia-smi` tiene que funcionar)
- [Git para Windows](https://git-scm.com/download/win) (trae Git Bash, instalado en `C:\Program Files\Git\bin\bash.exe`)
- [Node.js](https://nodejs.org) 20 o superior
- [uv](https://docs.astral.sh/uv/) (instala Python 3.10 solo) — `winget install astral-sh.uv`
- ~10 GB de disco (entorno de Python + checkpoint de 1.2 GB)

### Instalación (desde cero)

Corré todos los comandos en **Git Bash**.

**1. Descargar UniMate y crear su entorno**

```bash
git clone https://github.com/Friedrich-M/UniMate.git
cd UniMate
uv venv --python 3.10 --seed .venv
.venv/Scripts/python.exe -m pip install "setuptools<81"
.venv/Scripts/python.exe -m pip install -r requirements.txt --no-build-isolation
```

Esto instala PyTorch 2.5.1 (CUDA 12.4), bpy 4.0 (Blender como módulo de Python) y el resto. Tarda un rato.
El README de UniMate usa conda. Un venv funciona igual, y la interfaz lo busca en `UniMate/.venv`.

**2. Descargar el checkpoint del modelo (1.2 GB)**

```bash
.venv/Scripts/hf.exe download Linzhan/UniMate --repo-type model --local-dir outputs \
    --include "unimate_uniml3d_f60_v3/*.json" --include "unimate_uniml3d_f60_v3/*.npy" \
    --include "unimate_uniml3d_f60_v3/checkpoints/checkpoint_step_150000.pt"
```

**3. Descargar esta interfaz en `UniMate/UI`**

```bash
git clone https://github.com/josueviturro/unimateUI.git UI
```

**4. Aplicar los arreglos para Windows** (una sola vez)

```bash
bash UI/setup/aplicar_arreglos_windows.sh
```

Hace dos cosas:
- Copia un shim de `blender` a `.venv/Scripts`. El paso de exportación de UniMate llama a `blender`, y el shim lo corre con el bpy del venv.
- Corrige `scripts/run_animate_motion.sh` para que quite los finales de línea de Windows. Sin esto aparece el error `Unknown dataset 'general'`.

**5. Instalar las dependencias de la interfaz**

```bash
uv pip install --python .venv/Scripts/python.exe fastapi "uvicorn[standard]" python-multipart
cd UI/frontend && npm install && cd ../..
```

**6. Comprobar que UniMate funciona** (opcional, más o menos 1 minuto)

```bash
export PATH="$PWD/.venv/Scripts:$PATH" PYTHONIOENCODING=utf-8
python -m unimate.inference.sample --exp_dir outputs/unimate_uniml3d_f60_v3 \
    --asset assets/examples/shark --prompt "An object swims forward." --output_dir outputs/samples/test
bash scripts/run_animate_motion.sh outputs/samples/test
```

Si la salida termina en `BATCH DONE`, está todo instalado.

### Cómo arrancarla

- **Uso normal:** doble clic en `UI\iniciar_unimate_studio.bat`. La primera vez compila la interfaz. Después abre **http://localhost:8000**. Dejá abierta la consola negra mientras la usás y cerrala para apagar la app.
- **Desarrollo** (recarga al instante), en dos terminales desde la raíz de UniMate:

  ```bash
  .venv/Scripts/python.exe -m uvicorn main:app --app-dir UI/backend --port 8000 --reload --reload-dir UI/backend
  cd UI/frontend && npm run dev          # http://localhost:5173
  ```

Si cambiás el código del frontend, borrá `UI/frontend/dist` (o corré `npm run build`) para que el .bat lo vuelva a compilar.

### Cómo usarla

Antes de generar, cerrá ComfyUI, Unreal o cualquier otro programa que use la GPU. Mientras ComfyUI esté abierto aparece un aviso amarillo arriba.

1. **Personajes.** Exportá tu personaje riggeado desde Blender como GLB/FBX con **solo los huesos deformantes**: sin controladores IK/MCH, dedos ni cara, y **máximo 70 huesos**. Arrastrá el archivo, ponele un nombre y tocá "Subir y etiquetar huesos". Va a aparecer como "Necesita revisión".
2. **Revisión de huesos.**
   - El personaje tiene que estar parado y mirando hacia **+Z** (la flecha verde). Si no, usá los botones de rotación.
   - Elegí el **par de orientación**: dos huesos simétricos, idealmente los muslos.
   - Corregí los huesos marcados con ⚠. Las etiquetas van en inglés: `Left Thigh`, `Spine`, `Tail End`…
   - Tocá **"Construir esqueleto"**. El personaje pasa a "Listo".
3. **Generador.**
   - Tildá los personajes que querés animar.
   - Elegí **Normal** (un clip de 2 s) o **Encadenado** (varias acciones unidas en un solo clip).
   - Escribí **una sola acción corta** en inglés después del prefijo fijo "An object", por ejemplo `walks forward` o `roars`. No describas al personaje.
   - Variantes: 3. CFG: 3 (subilo a 5–7 si ignora el prompt). Semilla: dejala vacía.
   - Tocá "Generar animación" y seguí el log en vivo.
4. **Resultados 3D.**
   - Cada variante muestra el video del esqueleto y el modelo animado en una misma línea de tiempo. **⛶ Ampliar** la agranda y ⌖ vuelve a encuadrar.
   - Podés marcar favoritos, usar "Generar más parecidas" (mismo prompt, otra semilla) y descargar GLB/FBX por variante o la tanda entera en un ZIP.
   - Opciones de exportación: **Canónico** (centrado, tamaño normalizado, mirando a +Z, así que hay que reescalarlo en Unreal) o **escala original** (experimental: anima tu archivo subido).
5. **Historial.** Todas las tandas, con búsqueda y filtros. Cada una se puede abrir, relanzar (con otra semilla), descargar o borrar.

Los clips duran **2 s: 60 frames a 30 fps**. Para usar uno en Unreal, importá el FBX como animación sobre el esqueleto del personaje.

### Dónde se guardan los archivos

| Qué | Carpeta |
|---|---|
| Archivos subidos | `outputs/uploads/<nombre>/` |
| Personajes construidos | `outputs/rig/<nombre>/` (+ `ui_asset.json`) |
| Tandas | `outputs/samples/run_AAAAMMDD_HHMMSS/` (+ `ui_run.json`: parámetros, estado, favoritos) |
| Tandas encadenadas | dentro de la tanda, en `motion_expand/` |
| Exportaciones | `animated/` (canónico) y `animated_original/` (escala original) |

### Problemas comunes

| Síntoma | Solución |
|---|---|
| `Unknown dataset 'general'` | Correr `bash UI/setup/aplicar_arreglos_windows.sh` |
| `blender: command not found` | El mismo script (falta el shim de `blender`) |
| CUDA out of memory | Cerrar ComfyUI/Unreal y generar menos variantes |
| "No entra" (más de 70 huesos) | Reexportar solo los huesos deformantes |
| El personaje queda acostado o de espaldas | Botones de rotación en la pantalla 2 y reconstruir |
| Ignora el prompt | Prompt "An object …" más corto, CFG 5–7, más variantes |
| La interfaz dice "Backend desconectado" | Se cerró la consola del .bat: volvé a abrirla |

### Estructura del proyecto

| Ruta | Qué hace |
|---|---|
| `backend/main.py` | App FastAPI; sirve `frontend/dist` |
| `backend/app_settings.py` | Rutas y constantes |
| `backend/job_manager.py` | Cola de trabajos de GPU (de a uno), log en vivo, progreso, cancelación |
| `backend/command_builder.py` | Argumentos de cada comando de UniMate (nunca strings de shell) |
| `backend/asset_library.py` / `run_library.py` | Personajes y tandas en disco |
| `backend/system_status.py` | GPU/VRAM, checkpoint, detección de ComfyUI |
| `backend/routes/` | Endpoints HTTP (`/api/...`, `/files/...`, log en vivo por SSE) |
| `frontend/src/views/` | Las 5 pantallas |
| `frontend/src/components/` | Componentes compartidos (botones, paneles, visor 3D, consola de trabajos) |
| `frontend/src/styles/design_tokens.css` | Variables de colores, espaciado y tipografía |
| `setup/` | Shim de `blender` y el script de arreglos para Windows |

Convenciones de código:
- Los componentes usan **CSS Modules**.
- Las clases van en `snake_case` y empiezan por el rol del elemento: `container_*`, `panel_*`, `button_*`, `text_*`, `badge_*`… (ej. `container_general_view`).
- Los nombres de variables son descriptivos (nada de una sola letra).
- Cada función tiene un comentario breve que dice qué hace.
