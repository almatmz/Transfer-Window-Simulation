from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException, status
from app.models.club import Club
from app.schemas.club import ClubCreate, ClubUpdate, ClubResponse


def _serialize(club: Club) -> ClubResponse:
    return ClubResponse(
        id=str(club.id),
        name=club.name,
        short_name=club.short_name,
        country=club.country,
        league=club.league,
        annual_revenue=club.annual_revenue,
        wage_budget=club.wage_budget,
        transfer_budget=club.transfer_budget,
        season_year=club.season_year,
        projection_years=club.projection_years,
        created_at=club.created_at,
        updated_at=club.updated_at,
    )


async def create_club(data: ClubCreate) -> ClubResponse:
    club = Club(**data.model_dump())
    await club.insert()
    return _serialize(club)


async def get_club(club_id: str) -> ClubResponse:
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")
    return _serialize(club)


async def list_clubs(skip: int = 0, limit: int = 50) -> list[ClubResponse]:
    clubs = await Club.find_all().skip(skip).limit(limit).to_list()
    return [_serialize(c) for c in clubs]


async def update_club(club_id: str, data: ClubUpdate) -> ClubResponse:
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")

    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    await club.set(update_data)
    return _serialize(club)


async def delete_club(club_id: str) -> dict:
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")
    await club.delete()
    return {"message": f"Club '{club.name}' deleted successfully"}