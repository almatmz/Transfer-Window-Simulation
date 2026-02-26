from datetime import datetime
from io import StringIO
from fastapi import HTTPException, UploadFile, status
import pandas as pd

from app.models.player import Player, Position
from app.models.club import Club
from app.schemas.player import PlayerCreate, PlayerUpdate, PlayerResponse, PlayerBulkUploadResponse
from app.utils.amortization import calculate_annual_amortization


def _serialize(player: Player) -> PlayerResponse:
    amortization = calculate_annual_amortization(
        player.acquisition_fee, player.contract_length_years
    )
    return PlayerResponse(
        id=str(player.id),
        club_id=player.club_id,
        name=player.name,
        age=player.age,
        nationality=player.nationality,
        position=player.position,
        annual_salary=player.annual_salary,
        contract_length_years=player.contract_length_years,
        contract_expiry_year=player.contract_expiry_year,
        transfer_value=player.transfer_value,
        acquisition_fee=player.acquisition_fee,
        annual_amortization=amortization,
        is_active=player.is_active,
        created_at=player.created_at,
    )


async def _assert_club_exists(club_id: str) -> Club:
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return club


async def create_player(club_id: str, data: PlayerCreate) -> PlayerResponse:
    await _assert_club_exists(club_id)
    player = Player(club_id=club_id, **data.model_dump())
    await player.insert()
    return _serialize(player)


async def get_player(player_id: str) -> PlayerResponse:
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return _serialize(player)


async def list_players(club_id: str) -> list[PlayerResponse]:
    players = await Player.find(Player.club_id == club_id, Player.is_active == True).to_list()
    return [_serialize(p) for p in players]


async def update_player(player_id: str, data: PlayerUpdate) -> PlayerResponse:
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    await player.set(update_data)
    return _serialize(player)


async def delete_player(player_id: str) -> dict:
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    await player.set({"is_active": False, "updated_at": datetime.utcnow()})
    return {"message": f"Player '{player.name}' removed from squad"}


async def bulk_upload_players(club_id: str, file: UploadFile) -> PlayerBulkUploadResponse:
    """
    Upload squad via CSV.
    Expected columns: name, age, nationality, position, annual_salary,
                      contract_length_years, contract_expiry_year,
                      transfer_value, acquisition_fee, acquisition_year
    """
    await _assert_club_exists(club_id)

    content = await file.read()
    df = pd.read_csv(StringIO(content.decode("utf-8")))

    required_cols = {
        "name", "age", "nationality", "position",
        "annual_salary", "contract_length_years",
        "contract_expiry_year", "transfer_value",
    }
    missing = required_cols - set(df.columns.str.lower())
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV missing required columns: {missing}",
        )

    df.columns = df.columns.str.lower().str.strip()
    errors = []
    success_count = 0

    for idx, row in df.iterrows():
        try:
            player_data = PlayerCreate(
                name=str(row["name"]),
                age=int(row["age"]),
                nationality=str(row.get("nationality", "Unknown")),
                position=Position(str(row["position"]).upper()),
                annual_salary=float(row["annual_salary"]),
                contract_length_years=int(row["contract_length_years"]),
                contract_expiry_year=int(row["contract_expiry_year"]),
                transfer_value=float(row["transfer_value"]),
                acquisition_fee=float(row.get("acquisition_fee", 0)),
                acquisition_year=int(row.get("acquisition_year", 0)),
            )
            player = Player(club_id=club_id, **player_data.model_dump())
            await player.insert()
            success_count += 1
        except Exception as e:
            errors.append({"row": idx + 2, "error": str(e)})

    return PlayerBulkUploadResponse(
        total_rows=len(df),
        success_count=success_count,
        error_count=len(errors),
        errors=errors,
    )