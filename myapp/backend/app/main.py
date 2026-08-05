"""Application entry point: wiring only.

Routes live in ``app.routers``, SQL in ``app.db``, request models in
``app.schemas``. Nothing domain-specific belongs in this file.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.db import schema
from app.routers import inventory, returns, shipping, upload, workflow


@asynccontextmanager
async def lifespan(_app: FastAPI):
    schema.create_all()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Inventory Control API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for module in (inventory, returns, shipping, workflow, upload):
        app.include_router(module.router)

    @app.get("/api/health", tags=["health"])
    def health():
        return {"ok": True}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=config.API_HOST, port=config.API_PORT, reload=True)
