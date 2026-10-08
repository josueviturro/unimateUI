# UniMate Studio

Interfaz gráfica para UniMate (texto → animación esquelética). Un frontend en React maneja el CLI de UniMate a través de un backend local en FastAPI.

```
React (Vite)  ⇄  FastAPI (UI/backend, venv de UniMate)  ⇄  subprocesos: rig_preprocess / sample / run_animate_motion.sh
```

## Instalación

Este repo es la carpeta `UI/` dentro de una instalación de [UniMate](https://github.com/Friedrich-M/UniMate) que ya funciona (venv en `.venv`, checkpoint en `outputs/unimate_uniml3d_f60_v3/`, Git Bash para el paso de animación).

```bash
cd UniMate
git clone https://github.com/josueviturro/unimateUI.git UI
uv pip install --python .venv/Scripts/python.exe fastapi "uvicorn[standard]" python-multipart
cd UI/frontend && npm install
```

Requisitos: Windows, Node 20+, NVIDIA GPU con `nvidia-smi`, Git Bash en `C:\Program Files\Git\bin\bash.exe`.

## Cómo arrancarlo

**Uso normal:** doble clic en `UI/iniciar_unimate_studio.bat`. La primera vez instala dependencias y compila la interfaz. Después abre http://localhost:8000.

Si cambiás el código del frontend, borrá `UI/frontend/dist` (o corré `npm run build`) para que el .bat lo recompile.

**Modo desarrollo** (recarga al instante), en dos terminales desde la raíz del repo:

```bash
.venv/Scripts/python.exe -m uvicorn main:app --app-dir UI/backend --port 8000 --reload --reload-dir UI/backend
cd UI/frontend && npm run dev          # http://localhost:5173 (redirige /api y /files a :8000)
```

## Pantallas

| # | Pantalla | Qué hace |
|---|---|---|
| 1 | Personajes | Sube un GLB/FBX y corre `rig_preprocess` en modo revisión. Biblioteca con huesos n/70 y estado. |
| 2 | Revisión de huesos | Edita etiquetas y par de orientación (`annotation.json`), rota la pose de reposo (`--rest_rotation`) y construye (`--annotation`). |
| 3 | Generador | Personajes, prompt con prefijo fijo "An object", variantes, CFG, semilla, modo Normal / Encadenado. Log en vivo. |
| 4 | Resultados 3D | Video del esqueleto + GLB animado con una línea de tiempo compartida, favoritos, descargas GLB/FBX/ZIP, exportación canónica o a escala original. |
| 5 | Historial | Todas las tandas con filtros: abrir, relanzar (con otra semilla), descargar, eliminar. |

## Dónde se guarda todo

- Archivos subidos: `outputs/uploads/<nombre>/`
- Personajes construidos: `outputs/rig/<nombre>/` (+ `ui_asset.json`, datos propios de la interfaz)
- Tandas: `outputs/samples/run_AAAAMMDD_HHMMSS/` (+ `ui_run.json`: parámetros, estado, favoritos)
  - El modo encadenado escribe en la subcarpeta `motion_expand/`.
  - `animated/` = exportación canónica; `animated_original/` = exportación a escala original.

## Backend (UI/backend)

| Archivo | Responsabilidad |
|---|---|
| `main.py` | App FastAPI, routers, sirve `frontend/dist` |
| `app_settings.py` | Rutas y constantes (límites, puertos, rangos) |
| `job_manager.py` | Cola de trabajos de GPU (de a uno), log, progreso, cancelación |
| `command_builder.py` | Listas de argumentos de cada CLI (nunca strings de shell) |
| `asset_library.py` | Personajes: estado, anotación, archivos originales |
| `run_library.py` | Tandas: manifest, variantes, favoritos, uso de disco |
| `system_status.py` | GPU/VRAM (nvidia-smi), checkpoint, ComfyUI en :8188 |
| `routes/*.py` | Endpoints HTTP (`/api/...`, `/files/...`, SSE en `/api/jobs/{id}/events`) |

## Convenciones de código

- **CSS Modules** (`Componente.module.css` al lado de cada componente). Clases en `snake_case` que empiezan por el rol del elemento: `container_*`, `panel_*`, `header_*`, `bar_*`, `button_*`, `input_*`, `select_*`, `text_*`, `badge_*`, `pill_*`, `icon_*`, `list_*`, `item_*`, `row_*`, `grid_*`, `card_*`. Ejemplo: `container_general_view`.
- Variables de diseño en `src/styles/design_tokens.css` (`--color_*`, `--space_*`, `--font_*`, `--radius_*`).
- Nombres de variables descriptivos (nada de una sola letra), y cada función tiene un comentario breve que dice qué hace.

## Notas

- Los clips duran 2 s (60 frames, 30 fps). El modo encadenado une los tramos con 10 frames de superposición.
- Exportación canónica = centrado, diámetro 2, mirando a +Z. La escala original es experimental: puede fallar si el archivo subido tiene huesos extra.
- Licencia: los checkpoints son **CC BY-NC 4.0 (no comercial)**.
