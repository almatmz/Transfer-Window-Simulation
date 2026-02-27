"""
Transfer Simulation Service v4
================================
Add/remove individual transfers. FFP recomputed on every change.
"""

from datetime import datetime
from fastapi import HTTPException

from app.models.club import Club
from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.transfer import (
    TransferSimulation, WindowType,
    BuyEntry, SellEntry, LoanInEntry, LoanOutEntry,
)
from app.models.user import User
from app.schemas.transfer import (
    SimulationCreateRequest, UpdateSimulationMetaRequest,
    SimulationResponse, SimulationSummary,
    AddBuyRequest, AddSellRequest, AddLoanInRequest, AddLoanOutRequest,
)
from app.core.security import UserRole
from app.schemas.transfer import YearlyProjection
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import build_projections, worst_case_status


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


# Helper: get player financials 

async def _player_financials(
    api_football_player_id: int | None, is_sd: bool
) -> tuple[float, int, float]:
    """Returns (annual_salary, contract_years, acquisition_fee). Falls back to (0,0,0)."""
    if not api_football_player_id:
        return 0.0, 0, 0.0
    player = await Player.find_one(Player.api_football_id == api_football_player_id)
    if not player:
        return 0.0, 0, 0.0
    if is_sd:
        override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
        if override:
            return override.annual_salary, override.contract_length_years, override.acquisition_fee
    return player.estimated_annual_salary, player.contract_length_years, 0.0


#  Core FFP engine 

async def _recompute(
    club: Club,
    buys: list[BuyEntry],
    sells: list[SellEntry],
    loans_in: list[LoanInEntry],
    loans_out: list[LoanOutEntry],
    is_sd: bool,
) -> dict:
    # Baseline squad
    squad = await Player.find(Player.club_id == str(club.id)).to_list()
    baseline_wages = 0.0
    baseline_amort = 0.0
    used_overrides = False

    for p in squad:
        if is_sd:
            ov = await SalaryOverride.find_one(SalaryOverride.player_id == str(p.id))
            if ov:
                used_overrides = True
                baseline_wages += ov.annual_salary
                baseline_amort += calculate_annual_amortization(ov.acquisition_fee, ov.contract_length_years)
                continue
        baseline_wages += p.estimated_annual_salary

    # BUY: +wages +amortization -cash
    buy_fees = sum(b.transfer_fee for b in buys)
    buy_wages = sum(b.annual_salary for b in buys)
    buy_amort = sum(calculate_annual_amortization(b.transfer_fee, b.contract_length_years) for b in buys)

    # SELL: -wages -amortization +cash
    sell_fees = sum(s.transfer_fee for s in sells)
    sell_wages = 0.0
    sell_amort = 0.0
    for s in sells:
        sal, yrs, fee = await _player_financials(s.api_football_player_id, is_sd)
        sell_wages += sal if sal else s.annual_salary
        sell_amort += calculate_annual_amortization(fee, yrs) if yrs else 0.0

    # LOAN IN: +partial_wages +loan_fee_amort
    loan_fees_paid = sum(l.loan_fee for l in loans_in)
    loan_in_wages = sum(l.annual_salary * (l.wage_contribution_pct / 100) for l in loans_in)
    loan_in_amort = sum(
        calculate_annual_amortization(l.loan_fee, l.contract_length_years) for l in loans_in
    )

    # LOAN OUT: -partial_wages +loan_fee_received
    loan_fees_recv = sum(l.loan_fee_received for l in loans_out)
    loan_out_relief = 0.0
    for l in loans_out:
        sal, _, _ = await _player_financials(l.api_football_player_id, is_sd)
        full_sal = sal if sal else l.annual_salary
        loan_out_relief += full_sal * ((100 - l.wage_contribution_pct) / 100)

    total_wages = max(baseline_wages + buy_wages - sell_wages + loan_in_wages - loan_out_relief, 0)
    total_amort = max(baseline_amort + buy_amort - sell_amort + loan_in_amort, 0)
    net_spend = buy_fees + loan_fees_paid - sell_fees - loan_fees_recv

    revenue = max(club.annual_revenue or 1.0, 1.0)

    projections, ffp_result = build_projections(
    base_revenue=revenue,
    base_wage_bill=total_wages,
    base_amortization=total_amort,
    net_spend_year1=net_spend,
    loan_fee_impact_year1=loan_fees_paid - loan_fees_recv,
    projection_years=3,
    start_year=club.season_year or 2025,
)
    
    projections = [
    YearlyProjection(**p.__dict__)
    for p in projections
]

    return {
        "used_salary_overrides": used_overrides,
        "total_buy_fees": round(buy_fees, 2),
        "total_sell_fees": round(sell_fees, 2),
        "total_loan_fees_paid": round(loan_fees_paid, 2),
        "total_loan_fees_received": round(loan_fees_recv, 2),
        "net_spend": round(net_spend, 2),
        "projections": projections,
        "overall_ffp_status": ffp_result.status,
    }


async def _save_recomputed(sim: TransferSimulation, club: Club, is_sd: bool) -> SimulationResponse:
    computed = await _recompute(club, sim.buys, sim.sells, sim.loans_in, sim.loans_out, is_sd)
    for k, v in computed.items():
        setattr(sim, k, v)
    sim.updated_at = datetime.utcnow()
    await sim.save()
    return _serialize(sim)


# ── Auth helpers ──────────────────────────────────────────────────────────────

async def _get_sim_and_club(sim_id: str, user: User) -> tuple[TransferSimulation, Club]:
    sim = await TransferSimulation.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if sim.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Not your simulation")
    club = await Club.find_one(Club.api_football_id == sim.club_api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found in DB — re-sync it")
    return sim, club


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create_simulation(data: SimulationCreateRequest, user: User) -> SimulationResponse:
    club = await Club.find_one(Club.api_football_id == data.club_api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {data.club_api_football_id} not loaded. "
                   f"Call GET /api/v1/search/clubs/{data.club_api_football_id} first."
        )
    is_sd = user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)
    computed = await _recompute(club, [], [], [], [], is_sd)

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
    user: User, season: str | None, window_type: WindowType | None
) -> list[SimulationSummary]:
    sims = await TransferSimulation.find(TransferSimulation.user_id == str(user.id)).to_list()
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


async def update_meta(sim_id: str, data: UpdateSimulationMetaRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    if data.simulation_name: sim.simulation_name = data.simulation_name
    if data.window_type: sim.window_type = data.window_type
    if data.season: sim.season = data.season
    if data.is_public is not None: sim.is_public = data.is_public
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


# ── Add transfers (each recomputes FFP) ──────────────────────────────────────

async def add_buy(sim_id: str, data: AddBuyRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.buys.append(BuyEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))


async def add_sell(sim_id: str, data: AddSellRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.sells.append(SellEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))


async def add_loan_in(sim_id: str, data: AddLoanInRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.loans_in.append(LoanInEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))


async def add_loan_out(sim_id: str, data: AddLoanOutRequest, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    sim.loans_out.append(LoanOutEntry(**data.model_dump()))
    return await _save_recomputed(sim, club, user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))


async def remove_transfer(sim_id: str, list_name: str, index: int, user: User) -> SimulationResponse:
    sim, club = await _get_sim_and_club(sim_id, user)
    target = getattr(sim, list_name)
    if index < 0 or index >= len(target):
        raise HTTPException(status_code=400, detail=f"Index {index} out of range (list has {len(target)} items)")
    target.pop(index)
    setattr(sim, list_name, target)
    return await _save_recomputed(sim, club, user.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))