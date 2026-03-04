from fastapi import APIRouter, Depends, Query, HTTPException
from beanie import PydanticObjectId
from app.schemas.club import ClubResponse, ClubRevenueUpdate
from app.schemas.player import (
    SquadPlayerResponse, ContractResponse,
    CreateContractRequest, ExtendContractRequest
)
from app.services import club_service
from app.services import contract_service
from app.core.deps import get_optional_user, require_sport_director, require_admin
from app.models.user import User
from app.models.club import Club
from app.models.player import Player
from app.models.player_contract import PlayerContract, ContractType, DataSource
from app.core.security import UserRole, role_gte

router = APIRouter(prefix="/clubs", tags=["Clubs"])


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/{api_football_id}", response_model=ClubResponse,
    summary="Get club info — loads from API-Football on first call")
async def get_club(api_football_id: int, season: int = Query(2025)):
    return await club_service.get_club_response(api_football_id, season)


@router.get("/{api_football_id}/squad", response_model=list[SquadPlayerResponse],
    summary="Get squad. Sport Directors also see salary and amortization.")
async def get_squad(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    club = await club_service.get_or_create_club(api_football_id)
    is_sd = viewer and role_gte(viewer.role, UserRole.SPORT_DIRECTOR)

    contracts = await PlayerContract.find(
        PlayerContract.club_id == str(club.id),
        PlayerContract.is_active == True,
        PlayerContract.contract_type == ContractType.PERMANENT,
    ).to_list()

    result = []
    for c in contracts:
        player = await Player.get(c.player_id)
        if not player:
            continue
        result.append(SquadPlayerResponse(
            player_id=str(player.id),
            api_football_id=player.api_football_id,
            name=player.name,
            age=player.age,
            position=player.position.value,
            nationality=player.nationality,
            photo_url=player.photo_url,
            contract_expiry_year=c.contract_expiry_year,
            has_contract=True,
            annual_salary=c.annual_salary if is_sd else None,
            amortization_per_year=c.amortization_per_year if is_sd else None,
            data_source=c.data_source.value if is_sd else None,
        ))
    return result


# ── Sport Director / Admin endpoints ─────────────────────────────────────────

@router.patch("/{api_football_id}/revenue", response_model=ClubResponse,
    summary="Set annual revenue — required before FFP dashboard works")
async def update_revenue(
    api_football_id: int,
    body: ClubRevenueUpdate,
    _: User = Depends(require_sport_director),
):
    return await club_service.update_revenue(api_football_id, body)


@router.post("/{api_football_id}/sync",
    summary="Re-sync squad from API-Football + AI enrichment — Admin only")
async def force_sync(
    api_football_id: int,
    season: int = Query(2025),
    _: User = Depends(require_admin),
):
    club = await club_service.get_or_create_club(api_football_id, season)
    count = await club_service.sync_squad(club, season)
    return {"synced": count, "club": club.name}


@router.get("/{api_football_id}/contracts", response_model=list[ContractResponse],
    summary="View all active contracts — Sport Directors / Admins only")
async def get_contracts(
    api_football_id: int,
    _: User = Depends(require_sport_director),
):
    club = await club_service.get_or_create_club(api_football_id)
    contracts = await contract_service.get_active_contracts(str(club.id))
    current_season = club.season_year

    return [
        ContractResponse(
            id=str(c.id),
            player_id=c.player_id,
            player_name=c.player_name,
            position="",
            contract_type=c.contract_type.value,
            contract_start_year=c.contract_start_year,
            contract_expiry_year=c.contract_expiry_year,
            annual_salary=c.annual_salary,
            acquisition_fee=c.acquisition_fee,
            amortization_per_year=c.amortization_per_year,
            remaining_book_value=c.get_remaining_book_value(current_season),
            loan_wage_contribution_pct=c.loan_wage_contribution_pct,
            data_source=c.data_source.value,
            is_active=c.is_active,
        )
        for c in contracts
    ]


@router.post("/{api_football_id}/contracts",
    summary="Manually create/override a player contract — Sport Directors only",
    description="Set real acquisition_fee and salary. Overwrites AI estimates.")
async def create_contract(
    api_football_id: int,
    body: CreateContractRequest,
    _: User = Depends(require_sport_director),
):
    club = await club_service.get_or_create_club(api_football_id)
    player = await Player.find_one(Player.api_football_id == body.player_api_football_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found. Sync the squad first.")

    # Terminate existing if any (SD override replaces it)
    existing = await contract_service.get_player_contract(str(club.id), str(player.id))
    if existing:
        await contract_service.terminate_contract(existing, reason="sd_override")

    contract = await contract_service.create_contract(
        player=player,
        club=club,
        annual_salary=body.annual_salary,
        contract_start_year=body.contract_start_year,
        contract_expiry_year=body.contract_expiry_year,
        acquisition_fee=body.acquisition_fee,
        data_source=DataSource.OVERRIDE,
        contract_type=ContractType(body.contract_type),
        parent_club_id=body.parent_club_id,
        loan_fee=body.loan_fee,
        loan_wage_contribution_pct=body.loan_wage_contribution_pct,
        option_to_buy_enabled=body.option_to_buy_enabled,
        option_to_buy_fee=body.option_to_buy_fee,
    )
    return {
        "id": str(contract.id),
        "player": player.name,
        "annual_salary": contract.annual_salary,
        "amortization_per_year": contract.amortization_per_year,
        "contract_expiry_year": contract.contract_expiry_year,
        "data_source": contract.data_source.value,
    }


# ── Contract-level operations (use contract_id directly) ─────────────────────

@router.patch("/contracts/{contract_id}/extend",
    summary="Extend a contract — correctly recalculates amortization",
    description=(
        "Does NOT create a new contract. Updates expiry + salary and recalculates:\n\n"
        "`new_amortization = remaining_book_value / new_years_remaining`\n\n"
        "Example: €20M book value, 5 years remaining → €4M/year."
    ))
async def extend_contract(
    contract_id: str,
    body: ExtendContractRequest,
    _: User = Depends(require_sport_director),
):
    try:
        contract = await PlayerContract.get(PydanticObjectId(contract_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")

    club = await Club.get(contract.club_id)
    current_season = club.season_year if club else 2025

    updated = await contract_service.extend_contract(
        contract, body.new_expiry_year, body.new_annual_salary, current_season
    )
    return {
        "id": str(updated.id),
        "player": updated.player_name,
        "new_expiry_year": updated.contract_expiry_year,
        "new_annual_salary": updated.annual_salary,
        "new_amortization_per_year": updated.amortization_per_year,
    }


@router.delete("/contracts/{contract_id}",
    status_code=204,
    summary="Terminate a contract — Sport Directors only")
async def terminate_contract(
    contract_id: str,
    _: User = Depends(require_sport_director),
):
    try:
        contract = await PlayerContract.get(PydanticObjectId(contract_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    await contract_service.terminate_contract(contract, reason="manual_termination")