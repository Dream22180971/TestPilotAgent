from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import analysis, documents, exports, followup, generation, projects, requirements
from app.database import create_tables, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield
    engine.dispose()


app = FastAPI(title="TestPilot API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(documents.router, prefix="/api/projects", tags=["documents"])
app.include_router(requirements.router, prefix="/api/projects", tags=["requirements"])
app.include_router(analysis.router, prefix="/api/projects", tags=["analysis"])
app.include_router(generation.router, prefix="/api/projects", tags=["generation"])
app.include_router(followup.router, prefix="/api/projects", tags=["followup"])
app.include_router(exports.router, prefix="/api/projects", tags=["exports"])


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
