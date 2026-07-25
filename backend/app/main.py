from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="Briefr API", version="1.0.0")

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok"}


# ── Route registration ───────────────────────────────────────────
# Deferred imports so the app can boot even before routes exist.
# Each module is guarded by try/except during incremental development.

def _register_routes():
    try:
        from app.routes import auth
        app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    except Exception:
        pass

    try:
        from app.routes import users
        app.include_router(users.router, prefix="/api/users", tags=["users"])
    except Exception:
        pass

    try:
        from app.routes import projects
        app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    except Exception:
        pass

    try:
        from app.routes import meetings
        app.include_router(meetings.router, prefix="/api/meetings", tags=["meetings"])
    except Exception:
        pass

    try:
        from app.routes import transcripts
        app.include_router(transcripts.router, prefix="/api/transcripts", tags=["transcripts"])
    except Exception:
        pass

    try:
        from app.routes import tasks
        app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
    except Exception:
        pass


_register_routes()
