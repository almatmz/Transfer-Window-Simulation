from __future__ import annotations

import re
from datetime import datetime
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.transfer import (
    TransferSimulation, BuyEntry, SellEntry, LoanInEntry, LoanOutEntry,
    WindowType, YearlyProjection,
)
from app.models.user import User
from app.schemas.transfer import (
    SimulationCreateRequest, SimulationResponse, SimulationSummary,
    UpdateSimulationMetaRequest,
    AddBuyRequest, AddSellRequest, AddLoanInRequest, AddLoanOutRequest,
    UpdateBuyRequest, UpdateSellRequest, UpdateLoanInRequest, UpdateLoanOutRequest,
)
from app.utils.amortization import (
    calculate_annual_amortization,
    amortization_for_season,
    book_profit_or_loss,
)
from app.utils.ffp_calculator import (
    build_projections,
    worst_case_status,
    validate_simulation_year,
)

_NOW_YEAR = 2026


#  Serializers 

def _serialize(sim: TransferSimulation) -> SimulationResponse:
    return SimulationResponse(
        id=str(sim.id),
        user_id=sim.user_id,
        club_api_football_id=sim.club_api_football_id,
        club_name=sim.club_name,
        simulation_name=sim.simulation_name,
        window_type=sim.window_type,
        season=sim.season,
        buys=sim.buys,
        sells=sim.sells,
        loans_in=sim.loans_in,
        loans_out=sim.loans_out,
        used_salary_overrides=sim.used_salary_overrides,
        projections=sim.projections,
        total_buy_fees=sim.total_buy_fees,
        total_sell_fees=sim.total_sell_fees,
        total_loan_fees_paid=sim.total_loan_fees_paid,
        total_loan_fees_received=sim.total_loan_fees_received,
        net_spend=sim.net_spend,
        overall_ffp_status=sim.overall_ffp_status,
        is_public=sim.is_public,
        created_at=sim.created_at,
        updated_at=sim.updated_at,
    )


def _summary(sim: TransferSimulation) -> SimulationSummary:
    return SimulationSummary(
        id=str(sim.id),
        club_name=sim.club_name,
        club_api_football_id=sim.club_api_football_id,
        simulation_name=sim.simulation_name,
        window_type=sim.window_type,
        season=sim.season,
        total_buys=len(sim.buys),
        total_sells=len(sim.sells),
        total_loans_in=len(sim.loans_in),
        total_loans_out=len(sim.loans_out),
        net_spend=sim.net_spend,
        overall_ffp_status=sim.overall_ffp_status,
        is_public=sim.is_public,
        created_at=sim.created_at,
    )


#  Player financials helper 

async def _player_financials(
    api_football_player_id: int | None,
    is_sd: bool,
    viewer_user_id: str | None = None,
) -> tuple[float, int, float, int]:
    """
    Returns (annual_salary, contract_length_years, acquisition_fee, acquisition_year)
    applying PlayerOverride priority:
      SD viewer  -> SD own override > Admin override > raw DB
      Everyone   -> Admin override > raw DB
    """
    if not api_football_player_id:
        return 0.0, 0, 0.0, 0
    player = await Player.find_one(Player.api_football_id == api_football_player_id)
    if not player:
        return 0.0, 0, 0.0, 0

    player_id = str(player.id)

    if is_sd and viewer_user_id:
        sd_ov = await PlayerOverride.find_one(
            PlayerOverride.player_id == player_id,
            PlayerOverride.set_by_user_id == viewer_user_id,
            PlayerOverride.set_by_role == "sport_director",
        )
        if sd_ov:
            return (
                sd_ov.annual_salary or player.estimated_annual_salary,
                sd_ov.contract_length_years or player.contract_length_years,
                sd_ov.acquisition_fee if sd_ov.acquisition_fee is not None else player.acquisition_fee,
                sd_ov.acquisition_year or player.acquisition_year or 0,
            )

    admin_ov = await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_role == "admin",
    )
    if admin_ov:
        return (
            admin_ov.annual_salary or player.estimated_annual_salary,
            admin_ov.contract_length_years or player.contract_length_years,
            admin_ov.acquisition_fee if admin_ov.acquisition_fee is not None else player.acquisition_fee,
            admin_ov.acquisition_year or player.acquisition_year or 0,
        )

    return (
        player.estimated_annual_salary,
        player.contract_length_years,
        player.acquisition_fee,
        player.acquisition_year or 0,
    )


#  Core FFP engine 

async def _recompute(
    club: Club,
    buys: list[BuyEntry],
    sells: list[SellEntry],
    loans_in: list[LoanInEntry],
    loans_out: list[LoanOutEntry],
    is_sd: bool,
    start_year: int | None = None,
    user_id: str | None = None,
) -> dict:
    target_year = start_year or club.season_year or _NOW_YEAR
    validate_simulation_year(target_year)

    from app.services.club_service import get_effective_revenue
    base_revenue = await get_effective_revenue(club, user_id)

    squad = await Player.find(Player.club_id == str(club.id)).to_list()

    baseline_wages = 0.0
    baseline_amort = 0.0

    for p in squad:
        if p.is_sold:
            continue
        # Apply PlayerOverride priority: SD own > Admin > raw DB
        sal, yrs, fee, acq_yr = await _player_financials(
            p.api_football_id, is_sd, user_id
        )
        baseline_wages += sal
        baseline_amort += amortization_for_season(
            fee=fee,
            contract_years=yrs,
            acquisition_year=acq_yr,
            target_season_year=target_year,
        )

    buy_fees = sum(b.transfer_fee for b in buys)
    buy_wages = sum(b.annual_salary for b in buys)
    buy_amort = sum(
        calculate_annual_amortization(b.transfer_fee, b.contract_length_years)
        for b in buys
    )

    sell_fees = sum(s.transfer_fee for s in sells)
    sell_wages = 0.0
    sell_amort_relief = 0.0
    sell_profit_loss = 0.0

    for s in sells:
        sal, yrs, fee, acq_year = await _player_financials(s.api_football_player_id, is_sd, user_id)
        sell_wages += sal if sal else s.annual_salary
        if fee > 0 and yrs > 0 and acq_year > 0:
            sell_amort_relief += amortization_for_season(
                fee=fee, contract_years=yrs,
                acquisition_year=acq_year, target_season_year=target_year,
            )
            sell_profit_loss += book_profit_or_loss(
                s.transfer_fee, fee, yrs, target_year - acq_year
            )
        else:
            sell_profit_loss += s.transfer_fee

    loan_fees_paid = sum(li.loan_fee for li in loans_in)
    loan_in_wages = sum(
        li.annual_salary * (li.wage_contribution_pct / 100) for li in loans_in
    )
    loan_in_amort = sum(
        calculate_annual_amortization(li.loan_fee, li.contract_length_years)
        for li in loans_in
    )

    loan_fees_recv = sum(lo.loan_fee_received for lo in loans_out)
    loan_out_relief = 0.0
    for lo in loans_out:
        sal, _, _, _ = await _player_financials(lo.api_football_player_id, is_sd, user_id)
        full_sal = sal if sal else lo.annual_salary
        loan_out_relief += full_sal * ((100 - lo.wage_contribution_pct) / 100)

    total_wages = max(
        baseline_wages + buy_wages - sell_wages + loan_in_wages - loan_out_relief, 0.0
    )
    total_amort = max(
        baseline_amort + buy_amort - sell_amort_relief + loan_in_amort, 0.0
    )
    net_spend = buy_fees + loan_fees_paid - sell_fees - loan_fees_recv
    loan_fee_impact = loan_fees_paid - loan_fees_recv

    projections, overall = build_projections(
        base_revenue=base_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amort,
        net_spend_year1=net_spend,
        loan_fee_impact_year1=loan_fee_impact,
        projection_years=3,
        start_year=target_year,
        sell_profit_loss_year1=sell_profit_loss,
    )

    proj_models = [
        YearlyProjection(
            year=p.year, revenue=p.revenue, wage_bill=p.wage_bill,
            amortization=p.amortization, squad_cost=p.squad_cost,
            squad_cost_ratio=p.squad_cost_ratio,
            net_transfer_spend=p.net_transfer_spend,
            operating_result=p.operating_result, ffp_status=p.ffp_status,
        )
        for p in projections
    ]

    return {
        "total_buy_fees": buy_fees,
        "total_sell_fees": sell_fees,
        "total_loan_fees_paid": loan_fees_paid,
        "total_loan_fees_received": loan_fees_recv,
        "net_spend": net_spend,
        "used_salary_overrides": is_sd,
        "projections": proj_models,
        "overall_ffp_status": overall.status,
    }


async def _save_recomputed(
    sim: TransferSimulation, club: Club, is_sd: bool, user_id: str
) -> SimulationResponse:
    computed = await _recompute(
        club, sim.buys, sim.sells, sim.loans_in, sim.loans_out,
        is_sd, user_id=user_id,
    )
    for k, v in computed.items():
        setattr(sim, k, v)
    sim.updated_at = datetime.utcnow()
    await sim.save()
    return _serialize(sim)


#  Auth helpers 

async def _get_sim_and_club(
    sim_id: str, user: User
) -> tuple[TransferSimulation, Club]:
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not your simulation")
    club = await Club.find_one(Club.api_football_id == sim.club_api_football_id)
    if not club:
        raise HTTPException(
            status_code=404, detail="Club not found in DB — re-sync it"
        )
    return sim, club


def _is_sd(user: User) -> bool:
    return user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)


def _check_index(target: list, index: int, label: str) -> None:
    if index < 0 or index >= len(target):
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} index {index} out of range — "
                f"list has {len(target)} item(s). Indices are 0-based."
            ),
        )


#  CRUD 

async def create_simulation(
    data: SimulationCreateRequest, user: User
) -> SimulationResponse:
    club = await Club.find_one(Club.api_football_id == data.club_api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Club {data.club_api_football_id} not loaded. "
                f"Call GET /api/v1/clubs/{data.club_api_football_id} first."
            ),
        )
    try:
        start_year = int(data.season.split("/")[0])
    except Exception:
        start_year = club.season_year or _NOW_YEAR

    try:
        validate_simulation_year(start_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sd = _is_sd(user)
    computed = await _recompute(
        club, [], [], [], [], sd,
        start_year=start_year, user_id=str(user.id),
    )
    sim = TransferSimulation(
        user_id=str(user.id),
        club_api_football_id=data.club_api_football_id,
        club_name=club.name,
        simulation_name=data.simulation_name,
        window_type=data.window_type,
        season=data.season,
        is_public=data.is_public,
        **computed,
    )
    await sim.insert()
    return _serialize(sim)


async def list_my_simulations(
    user: User,
    season: str | None,
    window_type: WindowType | None,
) -> list[SimulationSummary]:
    sims = await TransferSimulation.find(
        TransferSimulation.user_id == str(user.id)
    ).to_list()
    if season:
        sims = [s for s in sims if s.season == season]
    if window_type:
        sims = [s for s in sims if s.window_type == window_type]
    sims.sort(key=lambda s: s.created_at, reverse=True)
    return [_summary(s) for s in sims]


async def get_simulation(sim_id: str, user: User) -> SimulationResponse:
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(user.id) and not sim.is_public:
        raise HTTPException(status_code=403, detail="This simulation is private")
    return _serialize(sim)


async def update_meta(
    sim_id: str, data: UpdateSimulationMetaRequest, user: User
) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    if data.simulation_name:
        sim.simulation_name = data.simulation_name
    if data.window_type:
        sim.window_type = data.window_type
    if data.season:
        sim.season = data.season
    if data.is_public is not None:
        sim.is_public = data.is_public
    sim.updated_at = datetime.utcnow()
    await sim.save()
    return _serialize(sim)


async def delete_simulation(sim_id: str, user: User) -> dict:
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(user.id) and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not your simulation")
    await sim.delete()
    return {"message": "Simulation deleted"}


# Add transfers

async def add_buy(sim_id: str, data: AddBuyRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.buys.append(BuyEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_sell(sim_id: str, data: AddSellRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.sells.append(SellEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_loan_in(
    sim_id: str, data: AddLoanInRequest, user: User
) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.loans_in.append(LoanInEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_loan_out(
    sim_id: str, data: AddLoanOutRequest, user: User
) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.loans_out.append(LoanOutEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


#  Update transfers (PATCH by index) 

async def update_transfer(
    sim_id: str,
    list_name: str,
    index: int,
    data: UpdateBuyRequest | UpdateSellRequest | UpdateLoanInRequest | UpdateLoanOutRequest,
    user: User,
) -> SimulationResponse:
    """
    Patch any field(s) of an existing transfer entry by its list index.
    Only the fields you send are updated — everything else stays the same.
    FFP is fully recomputed after the change.
    """
    sim, club = await _get_sim_and_club(sim_id, user)
    target: list = getattr(sim, list_name)
    _check_index(target, index, list_name)

    current = target[index].model_dump()
    updates = data.model_dump(exclude_unset=True)
    current.update(updates)

    entry_map = {
        "buys": BuyEntry,
        "sells": SellEntry,
        "loans_in": LoanInEntry,
        "loans_out": LoanOutEntry,
    }
    EntryClass = entry_map[list_name]
    target[index] = EntryClass(**current)
    setattr(sim, list_name, target)

    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))



async def remove_transfer(
    sim_id: str, list_name: str, index: int, user: User
) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    target: list = getattr(sim, list_name)
    _check_index(target, index, list_name)
    target.pop(index)
    setattr(sim, list_name, target)
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


#  Simulation squad projection 

def _parse_season_year(season: str) -> int:
    """
    Parse a season string to its start year.

    Examples:
      "2025/26"         → 2025
      "2026/27"         → 2026
      "2027/28 Winter"  → 2027
    """
    match = re.search(r"(\d{4})", season)
    return int(match.group(1)) if match else _NOW_YEAR


async def get_simulation_squad_projection(
    sim_id: str,
    viewer: User,
) -> dict:
    """
    Returns the projected squad for the simulation's target season.

    Steps:
      1. Load simulation (ownership check — user can only see their own).
      2. Parse simulation.season → target_year (e.g. "2027/28" → 2027).
      3. Build effective base squad for target_year via get_effective_squad().
         (Players whose contracts expired before target_year are OUT.)
      4. Apply simulation transfers on top:
           buys      → ADD to squad
           sells     → REMOVE from squad
           loans_in  → ADD (marked is_on_loan=True)
           loans_out → REMOVE
      5. Return merged squad with metadata.

    Important: users CANNOT modify the base squad; they only see:
      - Remaining real players (post-expiry + admin squad overrides)
      - Their own simulated transfers added on top
    """
    from app.services.squad_override_service import get_effective_squad

    # ── 1. Load simulation
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(viewer.id) and not sim.is_public:
        raise HTTPException(
            status_code=403, detail="This simulation is private"
        )

    #  2. Determine target season year 
    target_year = _parse_season_year(sim.season)

    #3. Effective base squad for that season 
    viewer_role = viewer.role.value
    base = await get_effective_squad(
        club_api_football_id=sim.club_api_football_id,
        view_season=target_year,
        viewer_id=str(viewer.id),
        viewer_role=viewer_role,
    )

    players: list[dict] = list(base["players"])   # mutable copy

    # Index by api_football_id for fast lookup/removal
    def _keyed(squad: list[dict]) -> dict[int | None, dict]:
        return {p.get("api_football_id"): p for p in squad if p.get("api_football_id")}

    active_ids: set[int] = {
        p["api_football_id"]
        for p in players
        if p.get("api_football_id") is not None
    }

    # ── 4a. Apply SELLS (remove from squad) 
    sell_ids: set[int] = set()
    for sell in sim.sells:
        if sell.api_football_player_id:
            sell_ids.add(sell.api_football_player_id)
    players = [p for p in players if p.get("api_football_id") not in sell_ids]
    active_ids -= sell_ids

    #  4b. Apply LOANS OUT (remove from squad) 
    loan_out_ids: set[int] = set()
    for lo in sim.loans_out:
        if lo.api_football_player_id:
            loan_out_ids.add(lo.api_football_player_id)
    players = [p for p in players if p.get("api_football_id") not in loan_out_ids]
    active_ids -= loan_out_ids

    #  4c. Apply BUYS (add to squad)
    simulated_buys: list[dict] = []
    for buy in sim.buys:
        entry = {
            "id": None,
            "api_football_id": buy.api_football_player_id,
            "name": buy.player_name,
            "full_name": buy.player_name,
            "age": buy.age if hasattr(buy, "age") else None,
            "date_of_birth": None,
            "nationality": buy.nationality if hasattr(buy, "nationality") else "",
            "position": buy.position if hasattr(buy, "position") else "UNKNOWN",
            "photo_url": "",
            "transfer_value": buy.transfer_fee,
            "transfer_value_currency": "EUR",
            "estimated_annual_salary": buy.annual_salary,
            "salary_source": "simulation",
            "contract_expiry_year": 0,
            "contract_length_years": buy.contract_length_years,
            "is_on_loan": False,
            "loan_from_club": None,
            "transfermarkt_url": None,
            "source": "simulation:buy",
        }
        simulated_buys.append(entry)
    players.extend(simulated_buys)

    # ── 4d. Apply LOANS IN (add to squad, marked as loan) ────────────────────
    simulated_loans_in: list[dict] = []
    for li in sim.loans_in:
        entry = {
            "id": None,
            "api_football_id": li.api_football_player_id,
            "name": li.player_name,
            "full_name": li.player_name,
            "age": li.age if hasattr(li, "age") else None,
            "date_of_birth": None,
            "nationality": li.nationality if hasattr(li, "nationality") else "",
            "position": li.position if hasattr(li, "position") else "UNKNOWN",
            "photo_url": "",
            "transfer_value": 0.0,
            "transfer_value_currency": "EUR",
            "estimated_annual_salary": li.annual_salary * (li.wage_contribution_pct / 100),
            "salary_source": "simulation",
            "contract_expiry_year": 0,
            "contract_length_years": li.contract_length_years,
            "is_on_loan": True,
            "loan_from_club": li.from_club if hasattr(li, "from_club") else None,
            "loan_fee": li.loan_fee,
            "transfermarkt_url": None,
            "source": "simulation:loan_in",
        }
        simulated_loans_in.append(entry)
    players.extend(simulated_loans_in)

    return {
        "simulation_id": sim_id,
        "simulation_name": sim.simulation_name,
        "season": sim.season,
        "target_year": target_year,
        "club_api_football_id": sim.club_api_football_id,
        "club_name": sim.club_name,
        "players": players,
        "total_players": len(players),
        "expired_contracts": base["expired_contracts"],
        "simulated_buys": simulated_buys,
        "simulated_loans_in": simulated_loans_in,
        "simulated_sell_ids": list(sell_ids),
        "simulated_loan_out_ids": list(loan_out_ids),
        "admin_additions": base["admin_additions"],
        "admin_removals": base["admin_removals"],
    }