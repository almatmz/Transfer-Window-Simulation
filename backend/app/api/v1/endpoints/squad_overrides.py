from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.core.deps import require_sport_director, get_current_user, get_optional_user
from app.models.squad_override import SquadOverride, OverrideAction
from app.models.user import User
from app.services.squad_override_service import get_effective_squad

router = APIRouter(prefix="/squad-overrides", tags=["Squad Overrides"])


# ─────────────────────────────── Schemas ────────────────────────────────────

class SquadOverrideCreateRequest(BaseModel):
    action: OverrideAction
    season_year: int = 2026

    # For REMOVE: just supply api_football_player_id
    api_football_player_id: Optional[int] = None

    # For ADD: fill in player details
    player_name: str = ""
    position: str = "UNKNOWN"
    age: Optional[int] = None
    nationality: str = ""
    transfer_value: float = 0.0
    annual_salary: float = 0.0
    contract_signing_date: Optional[str] = None   # ISO date string
    contract_expiry_year: int = 0
    contract_length_years: int = 0
    is_on_loan: bool = False
    loan_from_club: Optional[str] = None
    loan_end_date: Optional[str] = None           # ISO date string
    acquisition_fee: float = 0.0
    photo_url: str = ""
    notes: str = ""


class SquadOverrideResponse(BaseModel):
    id: str
    club_api_football_id: int
    set_by_user_id: str
    set_by_role: str
    action: OverrideAction
    api_football_player_id: Optional[int]
    player_name: str
    position: str
    season_year: int
    is_active: bool
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def _serialize(ov: SquadOverride) -> SquadOverrideResponse:
    return SquadOverrideResponse(
        id=str(ov.id),
        club_api_football_id=ov.club_api_football_id,
        set_by_user_id=ov.set_by_user_id,
        set_by_role=ov.set_by_role,
        action=ov.action,
        api_football_player_id=ov.api_football_player_id,
        player_name=ov.player_name,
        position=ov.position,
        season_year=ov.season_year,
        is_active=ov.is_active,
        notes=ov.notes,
        created_at=ov.created_at,
        updated_at=ov.updated_at,
    )


# ─────────────────────────── Endpoints ──────────────────────────────────────

@router.post(
    "/clubs/{api_football_id}",
    response_model=SquadOverrideResponse,
    summary="Add or remove a player from a club's squad (Admin / SD only)",
)
async def create_override(
    api_football_id: int,
    body: SquadOverrideCreateRequest,
    user: User = Depends(require_sport_director),
):
    """
    Create a squad override.

    - **Admin** → override is visible to ALL users.
    - **Sport Director** → override is private (visible only to this SD).
    - **Regular user** → 403.
    """
    if body.action == OverrideAction.REMOVE and not body.api_football_player_id:
        raise HTTPException(
            status_code=400,
            detail="api_football_player_id is required for REMOVE overrides",
        )
    if body.action == OverrideAction.ADD and not body.player_name:
        raise HTTPException(
            status_code=400,
            detail="player_name is required for ADD overrides",
        )

    from datetime import date as _date

    def _parse_date(s: Optional[str]):
        if not s:
            return None
        try:
            return _date.fromisoformat(s)
        except Exception:
            return None

    ov = SquadOverride(
        club_api_football_id=api_football_id,
        set_by_user_id=str(user.id),
        set_by_role=user.role.value,
        action=body.action,
        api_football_player_id=body.api_football_player_id,
        player_name=body.player_name,
        position=body.position,
        age=body.age,
        nationality=body.nationality,
        transfer_value=body.transfer_value,
        annual_salary=body.annual_salary,
        contract_signing_date=_parse_date(body.contract_signing_date),
        contract_expiry_year=body.contract_expiry_year,
        contract_length_years=body.contract_length_years,
        is_on_loan=body.is_on_loan,
        loan_from_club=body.loan_from_club,
        loan_end_date=_parse_date(body.loan_end_date),
        acquisition_fee=body.acquisition_fee,
        photo_url=body.photo_url,
        notes=body.notes,
        season_year=body.season_year,
    )
    await ov.insert()
    return _serialize(ov)


@router.get(
    "/clubs/{api_football_id}",
    response_model=list[SquadOverrideResponse],
    summary="List squad overrides for a club",
)
async def list_overrides(
    api_football_id: int,
    season_year: int = Query(default=2026),
    user: User = Depends(require_sport_director),
):
    """
    - **Admin** → sees ALL overrides (their own + every SD's).
    - **Sport Director** → sees ONLY their own overrides.
    """
    is_admin = user.role.value == "admin"

    if is_admin:
        overrides = await SquadOverride.find(
            SquadOverride.club_api_football_id == api_football_id,
            SquadOverride.season_year == season_year,
            SquadOverride.is_active == True,  # noqa: E712
        ).to_list()
    else:
        overrides = await SquadOverride.find(
            SquadOverride.club_api_football_id == api_football_id,
            SquadOverride.set_by_user_id == str(user.id),
            SquadOverride.season_year == season_year,
            SquadOverride.is_active == True,  # noqa: E712
        ).to_list()

    return [_serialize(ov) for ov in overrides]


@router.delete(
    "/{override_id}",
    summary="Soft-delete a squad override",
)
async def delete_override(
    override_id: str,
    user: User = Depends(require_sport_director),
):
    """
    - **Admin** → can delete any override.
    - **Sport Director** → can only delete their own.
    """
    ov = await SquadOverride.get(override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Override not found")

    is_admin = user.role.value == "admin"
    is_own = ov.set_by_user_id == str(user.id)

    if not is_admin and not is_own:
        raise HTTPException(
            status_code=403, detail="You can only delete your own squad overrides"
        )

    await ov.set({"is_active": False, "updated_at": datetime.utcnow()})
    return {"message": "Override deleted", "id": override_id}


@router.get(
    "/clubs/{api_football_id}/effective",
    summary="Get the effective squad for a season (with overrides applied)",
    description="""
Returns the squad as seen by the current viewer for the requested season.

**What is included:**
- Base squad from DB (players whose contracts have not expired before `view_season`)
- Admin squad overrides (visible to **everyone**)
- Viewer's own SD overrides (visible **only** to that SD)

**Regular users** see the base squad + admin overrides only (read-only).
""",
)
async def effective_squad(
    api_football_id: int,
    view_season: int = Query(
        default=2026,
        description="Season year to project (e.g. 2027 for 2027/28)",
    ),
    viewer: User | None = Depends(get_optional_user),
):
    viewer_id = str(viewer.id) if viewer else None
    viewer_role = viewer.role.value if viewer else "anonymous"

    result = await get_effective_squad(
        club_api_football_id=api_football_id,
        view_season=view_season,
        viewer_id=viewer_id,
        viewer_role=viewer_role,
    )

    # Hide SD metadata from regular users / anonymous
    if not viewer or viewer.role.value not in ("admin", "sport_director"):
        result.pop("sd_additions", None)
        result.pop("sd_removals", None)

    return result