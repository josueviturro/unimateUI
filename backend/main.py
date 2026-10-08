"""UniMate Studio backend: FastAPI app that drives the UniMate CLI for the React UI.

Run from the repo root with the UniMate venv:
    .venv\\Scripts\\python.exe -m uvicorn main:app --app-dir UI/backend --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app_settings import DEV_FRONTEND_ORIGINS, FRONTEND_DIST_DIR
from routes.asset_routes import asset_router
from routes.run_routes import run_router
from routes.system_routes import system_router

app = FastAPI(title="UniMate Studio", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=DEV_FRONTEND_ORIGINS, allow_methods=["*"], allow_headers=["*"])

app.include_router(system_router)
app.include_router(asset_router)
app.include_router(run_router)

if FRONTEND_DIST_DIR.is_dir():
    # Built React app (npm run build): served at / so one process is enough
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets"), name="frontend_assets")

    @app.get("/{frontend_path:path}", include_in_schema=False)
    def serve_frontend(frontend_path: str) -> FileResponse:
        """Every non-API path returns the React app (single-page app routing)."""
        requested_file = FRONTEND_DIST_DIR / frontend_path
        if frontend_path and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
