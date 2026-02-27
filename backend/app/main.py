from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
**Transfer Window Financial Simulator**

Simulate transfer windows with full FFP impact analysis.

**Access levels:**
-  **Anonymous / Public** — search clubs, view squads, view FFP dashboards (Capology estimates)
-  **User** — + save transfer simulations, edit profile
-  **Sport Director** — + set private real salaries, see accurate FFP calculations
-  **Admin** — + manage users, force data syncs

**Transfer types:** BUY · SELL · LOAN IN · LOAN OUT (with option-to-buy)
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}