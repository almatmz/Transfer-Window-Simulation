from fastapi import APIRouter, UploadFile, File
from app.schemas.player import PlayerCreate, PlayerUpdate, PlayerResponse, PlayerBulkUploadResponse
from app.services import player_service

router = APIRouter(tags=["Squad Management"])


@router.post(
    "/clubs/{club_id}/players",
    response_model=PlayerResponse,
    status_code=201,
    summary="Add player to squad",
)
async def create_player(club_id: str, body: PlayerCreate):
    return await player_service.create_player(club_id, body)


@router.get(
    "/clubs/{club_id}/players",
    response_model=list[PlayerResponse],
    summary="List all players in a club's squad",
)
async def list_players(club_id: str):
    return await player_service.list_players(club_id)


@router.post(
    "/clubs/{club_id}/players/upload",
    response_model=PlayerBulkUploadResponse,
    summary="Bulk upload squad via CSV",
    description=(
        "Upload a CSV file with columns: name, age, nationality, position, "
        "annual_salary, contract_length_years, contract_expiry_year, "
        "transfer_value, acquisition_fee (optional), acquisition_year (optional)"
    ),
)
async def bulk_upload_players(club_id: str, file: UploadFile = File(...)):
    return await player_service.bulk_upload_players(club_id, file)


# Individual player operations

@router.get(
    "/players/{player_id}",
    response_model=PlayerResponse,
    summary="Get player by ID",
)
async def get_player(player_id: str):
    return await player_service.get_player(player_id)


@router.patch(
    "/players/{player_id}",
    response_model=PlayerResponse,
    summary="Update player contract or valuation",
)
async def update_player(player_id: str, body: PlayerUpdate):
    return await player_service.update_player(player_id, body)


@router.delete(
    "/players/{player_id}",
    summary="Remove player from squad",
)
async def delete_player(player_id: str):
    return await player_service.delete_player(player_id)