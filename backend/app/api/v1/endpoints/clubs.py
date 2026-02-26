from fastapi import APIRouter, Query
from app.schemas.club import ClubCreate, ClubUpdate, ClubResponse
from app.services import club_service

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.post("/", response_model=ClubResponse, status_code=201, summary="Create a new club")
async def create_club(body: ClubCreate):
    return await club_service.create_club(body)


@router.get("/", response_model=list[ClubResponse], summary="List all clubs")
async def list_clubs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return await club_service.list_clubs(skip=skip, limit=limit)


@router.get("/{club_id}", response_model=ClubResponse, summary="Get club by ID")
async def get_club(club_id: str):
    return await club_service.get_club(club_id)


@router.patch("/{club_id}", response_model=ClubResponse, summary="Update club financials")
async def update_club(club_id: str, body: ClubUpdate):
    return await club_service.update_club(club_id, body)


@router.delete("/{club_id}", summary="Delete a club")
async def delete_club(club_id: str):
    return await club_service.delete_club(club_id)