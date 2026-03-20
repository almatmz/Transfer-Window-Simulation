from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    search,
    clubs,
    players,
    transfers,
    ffp,
    admin,
    squad_overrides,
    contract_extensions,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(search.router)
api_router.include_router(clubs.router)
api_router.include_router(players.router)
api_router.include_router(transfers.router)
api_router.include_router(ffp.router)
api_router.include_router(admin.router)
api_router.include_router(squad_overrides.router)
api_router.include_router(contract_extensions.router)