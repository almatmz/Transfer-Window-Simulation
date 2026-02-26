from fastapi import APIRouter
from app.api.v1.endpoints import clubs, players, transfers, ffp

api_router = APIRouter()

api_router.include_router(clubs.router)
api_router.include_router(players.router)
api_router.include_router(transfers.router)
api_router.include_router(ffp.router)