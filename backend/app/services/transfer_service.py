from __future__ import annotations

import re
from datetime import datetime
from fastapi import HTTPException

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
    validate_simulation_year,
)

_NOW_YEAR = 2026


# Helpers

def _is_sd(user: User) -> bool:
    return user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)


def _parse_season_year(season: str) -> int:
    match = re.search(r"(\d{4})", season)
    return int(match.group(1)) if match else _NOW_YEAR


def _check_index(target: list, index: int, label: str) -> None:
    if index < 0 or index >= len(target):
        raise HTTPException(
            status_code=400,
            detail=f"{label} index {index} out of range — list has {len(target)} item(s).",
        )


async def _get_sim_and_club(sim_id: str, user: User) -> tuple[TransferSimulation, Club]:
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not your simulation")
    club = await Club.find_one(Club.api_football_id == sim.club_api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found — re-sync it")
    return sim, club


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


#  Bulk financials context 

class _FinancialsCtx:
    """
    Pre-loads all PlayerOverrides for a squad in 2 bulk queries.
    Lookup is O(1) dict access — zero extra DB calls in loops.
    """
    def __init__(
        self,
        admin_map: dict[str, PlayerOverride],
        sd_map: dict[str, PlayerOverride],
    ):
        self._admin = admin_map
        self._sd = sd_map

    def get(self, player: Player, is_sd: bool, viewer_id: str | None) -> tuple[float, int, float, int]:
        pid = str(player.id)
        if is_sd and viewer_id:
            ov = self._sd.get(pid)
            if ov:
                return (
                    ov.annual_salary or player.estimated_annual_salary,
                    ov.contract_length_years or player.contract_length_years,
                    ov.acquisition_fee if ov.acquisition_fee is not None else player.acquisition_fee,
                    ov.acquisition_year or player.acquisition_year or 0,
                )
        ov = self._admin.get(pid)
        if ov:
            return (
                ov.annual_salary or player.estimated_annual_salary,
                ov.contract_length_years or player.contract_length_years,
                ov.acquisition_fee if ov.acquisition_fee is not None else player.acquisition_fee,
                ov.acquisition_year or player.acquisition_year or 0,
            )
        return (
            player.estimated_annual_salary,
            player.contract_length_years,
            player.acquisition_fee,
            player.acquisition_year or 0,
        )


async def _build_ctx(
    player_ids: list[str], is_sd: bool, viewer_id: str | None
) -> _FinancialsCtx:
    if not player_ids:
        return _FinancialsCtx({}, {})

    admin_list = await PlayerOverride.find(
        {"player_id": {"$in": player_ids}, "set_by_role": "admin"}
    ).to_list()
    admin_map = {ov.player_id: ov for ov in admin_list}

    sd_map: dict[str, PlayerOverride] = {}
    if is_sd and viewer_id:
        sd_list = await PlayerOverride.find(
            {"player_id": {"$in": player_ids},
             "set_by_user_id": viewer_id,
             "set_by_role": "sport_director"}
        ).to_list()
        sd_map = {ov.player_id: ov for ov in sd_list}

    return _FinancialsCtx(admin_map, sd_map)


# Validation 

async def _validate_club_player(
    api_football_player_id: int | None,
    club_id: str,
    operation: str,
) -> Player | None:
    """
    Validates that a player being sold/loaned-out belongs to this simulation's club.
    Raises 400 if player is from a different club.
    Returns None if api_football_player_id is not provided (manual entry).
    """
    if not api_football_player_id:
        return None

    player = await Player.find_one(Player.api_football_id == api_football_player_id)
    if not player:
        raise HTTPException(
            status_code=404,
            detail=f"Player {api_football_player_id} not found. Load their club squad first.",
        )
    if player.club_id != club_id:
        club = await Club.find_one(Club.id == player.club_id)
        actual_club = club.name if club else player.club_id
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot {operation} player {player.name} — "
                f"they belong to {actual_club}, not this simulation's club. "
                f"You can only sell/loan-out players from your own squad."
            ),
        )
    return player


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

    # Load squad + bulk overrides in 3 queries total
    squad = await Player.find(
        Player.club_id == str(club.id),
        Player.is_sold == False,  # noqa: E712
    ).to_list()
    player_ids = [str(p.id) for p in squad]
    ctx = await _build_ctx(player_ids, is_sd, user_id)

    # Build a map for sell/loan-out lookups
    player_by_api_id = {p.api_football_id: p for p in squad}

    #  Baseline wages + amortization
    baseline_wages = 0.0
    baseline_amort = 0.0

    for p in squad:
        sal, yrs, fee, acq_yr = ctx.get(p, is_sd, user_id)
        baseline_wages += sal
        baseline_amort += amortization_for_season(
            fee=fee, contract_years=yrs,
            acquisition_year=acq_yr, target_season_year=target_year,
        )

    #  Buys
    buy_fees   = sum(b.transfer_fee for b in buys)
    buy_wages  = sum(b.annual_salary for b in buys)
    buy_amort  = sum(
        calculate_annual_amortization(b.transfer_fee, b.contract_length_years)
        for b in buys
    )

    # Sells 
    sell_fees        = sum(s.transfer_fee for s in sells)
    sell_wages       = 0.0
    sell_amort_relief = 0.0
    sell_profit_loss = 0.0

    for s in sells:
        p = player_by_api_id.get(s.api_football_player_id) if s.api_football_player_id else None
        if p:
            sal, yrs, fee, acq_yr = ctx.get(p, is_sd, user_id)
        else:
            sal, yrs, fee, acq_yr = s.annual_salary, s.contract_length_years, s.transfer_fee, 0

        sell_wages += sal
        if fee > 0 and yrs > 0 and acq_yr > 0:
            sell_amort_relief += amortization_for_season(
                fee=fee, contract_years=yrs,
                acquisition_year=acq_yr, target_season_year=target_year,
            )
            sell_profit_loss += book_profit_or_loss(
                s.transfer_fee, fee, yrs, target_year - acq_yr
            )
        else:
            sell_profit_loss += s.transfer_fee

    #  Loans in
    loan_fees_paid = sum(li.loan_fee for li in loans_in)
    loan_in_wages  = sum(li.annual_salary * li.wage_contribution_pct / 100 for li in loans_in)
    loan_in_amort  = sum(
        calculate_annual_amortization(li.loan_fee, li.contract_length_years)
        for li in loans_in
    )

    # Loans out 
    loan_fees_recv  = sum(lo.loan_fee_received for lo in loans_out)
    loan_out_relief = 0.0

    for lo in loans_out:
        p = player_by_api_id.get(lo.api_football_player_id) if lo.api_football_player_id else None
        sal = ctx.get(p, is_sd, user_id)[0] if p else lo.annual_salary
        loan_out_relief += sal * (100 - lo.wage_contribution_pct) / 100

    # Totals
    total_wages = max(baseline_wages + buy_wages - sell_wages + loan_in_wages - loan_out_relief, 0.0)
    total_amort = max(baseline_amort + buy_amort - sell_amort_relief + loan_in_amort, 0.0)
    net_spend      = buy_fees + loan_fees_paid - sell_fees - loan_fees_recv
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


#CRUD 

async def create_simulation(data: SimulationCreateRequest, user: User) -> SimulationResponse:
    club = await Club.find_one(Club.api_football_id == data.club_api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {data.club_api_football_id} not loaded. "
                   f"Call GET /api/v1/clubs/{data.club_api_football_id} first.",
        )
    start_year = _parse_season_year(data.season) if data.season else club.season_year or _NOW_YEAR
    try:
        validate_simulation_year(start_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    computed = await _recompute(
        club, [], [], [], [], _is_sd(user),
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
    filters: dict = {"user_id": str(user.id)}
    if season:
        filters["season"] = season
    if window_type:
        filters["window_type"] = window_type
    sims = await TransferSimulation.find(filters).sort("-created_at").to_list()
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
    sim, _ = await _get_sim_and_club(sim_id, user)
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(sim, k, v)
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


#  Add transfers 

async def add_buy(sim_id: str, data: AddBuyRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.buys.append(BuyEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_sell(sim_id: str, data: AddSellRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    # Validate player belongs to this club
    await _validate_club_player(data.api_football_player_id, str(club.id), "sell")
    sim.sells.append(SellEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_loan_in(sim_id: str, data: AddLoanInRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.loans_in.append(LoanInEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


async def add_loan_out(sim_id: str, data: AddLoanOutRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    # Validate player belongs to this club
    await _validate_club_player(data.api_football_player_id, str(club.id), "loan out")
    sim.loans_out.append(LoanOutEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


#  Update transfers 

_ENTRY_CLASSES = {
    "buys": BuyEntry,
    "sells": SellEntry,
    "loans_in": LoanInEntry,
    "loans_out": LoanOutEntry,
}


async def update_transfer(
    sim_id: str,
    list_name: str,
    index: int,
    data: UpdateBuyRequest | UpdateSellRequest | UpdateLoanInRequest | UpdateLoanOutRequest,
    user: User,
) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    target: list = getattr(sim, list_name)
    _check_index(target, index, list_name)

    # For sells/loan-outs, validate club ownership if player id is being changed
    if list_name in ("sells", "loans_out"):
        new_pid = data.model_dump(exclude_unset=True).get("api_football_player_id")
        if new_pid:
            op = "sell" if list_name == "sells" else "loan out"
            await _validate_club_player(new_pid, str(club.id), op)

    merged = {**target[index].model_dump(), **data.model_dump(exclude_unset=True)}
    target[index] = _ENTRY_CLASSES[list_name](**merged)
    setattr(sim, list_name, target)
    return await _save_recomputed(sim, club, _is_sd(user), str(user.id))


#  Remove transfers 

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

async def get_simulation_squad_projection(sim_id: str, viewer: User) -> dict:
    """
    Returns the full simulated squad for display — every player tagged with sim_status.

    sim_status values:
      null          — regular squad member, unaffected by simulation
      "sold"        — sold in this simulation (shown greyed out / crossed out)
      "loaned_out"  — loaned out (shown with wage contribution % and fee received)
      "bought"      — purchased in this simulation (shown with transfer fee paid)
      "loan_in"     — loaned in (shown with loan fee and wage contribution)

    FFP impact is computed separately in ffp_service — this endpoint is purely
    for squad display. The frontend decides how to render each sim_status.

    sold / loaned_out players ARE included so the frontend can show them with
    visual markers. Their financial impact is reflected in the FFP numbers.
    """
    from app.services.squad_override_service import get_effective_squad

    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(viewer.id) and not sim.is_public:
        raise HTTPException(status_code=403, detail="This simulation is private")

    target_year = _parse_season_year(sim.season)

    base = await get_effective_squad(
        club_api_football_id=sim.club_api_football_id,
        view_season=target_year,
        viewer_id=str(viewer.id),
        viewer_role=viewer.role.value,
    )

    # Build lookup maps for simulation entries (by api_football_player_id)
    sell_map: dict[int, SellEntry] = {
        s.api_football_player_id: s
        for s in sim.sells if s.api_football_player_id
    }
    loan_out_map: dict[int, LoanOutEntry] = {
        lo.api_football_player_id: lo
        for lo in sim.loans_out if lo.api_football_player_id
    }

    #  Tag every base squad player with their sim_status 
    tagged_squad: list[dict] = []
    for p in base["players"]:
        pid = p.get("api_football_id")
        if pid in sell_map:
            sell = sell_map[pid]
            tagged_squad.append({
                **p,
                "sim_status": "sold",
                "sim_transfer_fee": sell.transfer_fee,
                "sim_annual_salary": p.get("estimated_annual_salary", 0),
                "sim_note": f"Sold for €{sell.transfer_fee/1e6:.1f}M",
            })
        elif pid in loan_out_map:
            lo = loan_out_map[pid]
            effective_salary = p.get("estimated_annual_salary", lo.annual_salary)
            wage_relief = effective_salary * lo.wage_contribution_pct / 100
            tagged_squad.append({
                **p,
                "sim_status": "loaned_out",
                "sim_loan_fee_received": lo.loan_fee_received,
                "sim_wage_contribution_pct": lo.wage_contribution_pct,
                "sim_wage_relief": wage_relief,          # amount receiving club pays
                "sim_wage_remaining": effective_salary - wage_relief,  # your cost
                "sim_to_club": getattr(lo, "to_club", None),
                "sim_note": (
                    f"Loaned out — receiving club pays {lo.wage_contribution_pct:.0f}% wages"
                ),
            })
        else:
            tagged_squad.append({**p, "sim_status": None})

    # ── Bought players ──────────────────────────────────────────────────────
    bought: list[dict] = [
        {
            "id": None,
            "api_football_id": b.api_football_player_id,
            "name": b.player_name,
            "full_name": b.player_name,
            "position": getattr(b, "position", "UNKNOWN"),
            "nationality": getattr(b, "nationality", ""),
            "age": getattr(b, "age", None),
            "photo_url": "",
            "transfer_value": b.transfer_fee,
            "transfer_value_currency": "EUR",
            "estimated_annual_salary": b.annual_salary,
            "salary_source": "simulation",
            "contract_length_years": b.contract_length_years,
            "contract_expiry_year": target_year + b.contract_length_years,
            "is_on_loan": False,
            "squad_loan_status": None,
            "data_source": "simulation:buy",
            # Simulation-specific fields
            "sim_status": "bought",
            "sim_transfer_fee": b.transfer_fee,
            "sim_annual_amortization": (
                b.transfer_fee / b.contract_length_years
                if b.contract_length_years > 0 else 0.0
            ),
            "sim_note": f"Bought for €{b.transfer_fee/1e6:.1f}M",
        }
        for b in sim.buys
    ]

    # ── Loaned-in players ───────────────────────────────────────────────────
    loaned_in: list[dict] = [
        {
            "id": None,
            "api_football_id": li.api_football_player_id,
            "name": li.player_name,
            "full_name": li.player_name,
            "position": getattr(li, "position", "UNKNOWN"),
            "nationality": getattr(li, "nationality", ""),
            "age": getattr(li, "age", None),
            "photo_url": "",
            "transfer_value": 0.0,
            "transfer_value_currency": "EUR",
            "estimated_annual_salary": li.annual_salary,
            "salary_source": "simulation",
            "contract_length_years": li.contract_length_years,
            "contract_expiry_year": 0,
            "is_on_loan": True,
            "squad_loan_status": "loan_in",
            "loan_from_club": getattr(li, "from_club", None),
            "data_source": "simulation:loan_in",
            # Simulation-specific fields
            "sim_status": "loan_in",
            "sim_loan_fee_paid": li.loan_fee,
            "sim_wage_contribution_pct": li.wage_contribution_pct,
            "sim_wage_cost": li.annual_salary * li.wage_contribution_pct / 100,
            "sim_note": (
                f"Loaned in — paying {li.wage_contribution_pct:.0f}% of wages"
            ),
        }
        for li in sim.loans_in
    ]

    # Full squad = tagged base + bought + loaned_in
    # (sold/loaned_out remain in tagged_squad with their sim_status flag)
    all_players = tagged_squad + bought + loaned_in

    # Counts for summary
    active_count = sum(
        1 for p in all_players
        if p["sim_status"] not in ("sold", "loaned_out")
    )

    return {
        "simulation_id": sim_id,
        "simulation_name": sim.simulation_name,
        "season": sim.season,
        "target_year": target_year,
        "club_api_football_id": sim.club_api_football_id,
        "club_name": sim.club_name,
        # All players — frontend filters/styles by sim_status
        "players": all_players,
        # Counts
        "total_active_players": active_count,
        "total_sold": len(sell_map),
        "total_loaned_out": len(loan_out_map),
        "total_bought": len(bought),
        "total_loaned_in": len(loaned_in),
        # Expired contracts from base squad (pre-simulation)
        "expired_contracts": base["expired_contracts"],
        # Admin squad overrides applied to base
        "admin_additions": base["admin_additions"],
        "admin_removals": base["admin_removals"],
    }