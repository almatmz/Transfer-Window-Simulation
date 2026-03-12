from __future__ import annotations

from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.transfer import TransferSimulation
from app.models.user import User
from app.schemas.ffp import FFPDashboardResponse, FFPStatus, YearlyProjection as YP
from app.utils.amortization import (
    calculate_annual_amortization,
    amortization_for_season,
    remaining_book_value,
    book_profit_or_loss,
)
from app.utils.ffp_calculator import (
    build_projections,
    squad_cost_ratio_calc,
    ffp_status_from_ratio,
    FFPStatusResult,
    validate_simulation_year,
)

_NOW_YEAR = 2026


# Override helpers 

async def _get_player_financials(
    player: Player,
    is_sd: bool,
    viewer_id: str | None,
) -> tuple[float, int, float, int]:
    """
    Returns (annual_salary, contract_length_years, acquisition_fee, acquisition_year)
    using PlayerOverride priority:
      SD own override > Admin override > raw DB
    """
    player_id = str(player.id)

    if is_sd and viewer_id:
        sd_ov = await PlayerOverride.find_one(
            PlayerOverride.player_id == player_id,
            PlayerOverride.set_by_user_id == viewer_id,
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


async def _get_salary_source(
    player: Player,
    is_sd: bool,
    viewer_id: str | None,
) -> str:
    """Returns the effective salary_source label for a player."""
    player_id = str(player.id)

    if is_sd and viewer_id:
        sd_ov = await PlayerOverride.find_one(
            PlayerOverride.player_id == player_id,
            PlayerOverride.set_by_user_id == viewer_id,
            PlayerOverride.set_by_role == "sport_director",
        )
        if sd_ov and sd_ov.annual_salary is not None:
            return "sd_override"

    admin_ov = await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_role == "admin",
    )
    if admin_ov and admin_ov.annual_salary is not None:
        return "admin_override"

    return player.salary_source or "position_estimate"


# Main FFP function

async def get_ffp_dashboard_by_api_id(
    api_football_id: int,
    viewer: User | None,
    sim_id: str | None = None,
    simulation_year: int | None = None,
) -> FFPDashboardResponse:

    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {api_football_id} not loaded. Call GET /clubs/{api_football_id} first.",
        )

    start_year = simulation_year or club.season_year or _NOW_YEAR
    try:
        validate_simulation_year(start_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    players = await Player.find(Player.club_id == str(club.id)).to_list()
    is_sd = bool(viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))
    viewer_id = str(viewer.id) if viewer else None

    # Revenue: official (global) OR this user's personal override 
    from app.services.club_service import get_effective_revenue
    annual_revenue = await get_effective_revenue(club, viewer_id)

    # Baseline squad wages + amortization 
    baseline_wages = 0.0
    baseline_amort = 0.0
    sources_used: set[str] = set()

    for player in players:
        if player.is_sold:
            continue

        sal, yrs, fee, acq_year = await _get_player_financials(player, is_sd, viewer_id)
        src = await _get_salary_source(player, is_sd, viewer_id)

        baseline_wages += sal
        if fee > 0 and acq_year > 0:
            baseline_amort += amortization_for_season(
                fee=fee,
                contract_years=yrs,
                acquisition_year=acq_year,
                target_season_year=start_year,
            )
        sources_used.add(src)

    #  Simulation overlay 
    sim = None
    net_spend = 0.0
    loan_fee_impact = 0.0
    extra_wages = 0.0
    extra_amort = 0.0
    sell_wages = 0.0
    sell_amort_relief = 0.0
    sell_profit_loss = 0.0

    if sim_id:
        from beanie import PydanticObjectId
        try:
            sim = await TransferSimulation.get(PydanticObjectId(sim_id))
        except Exception:
            raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")

        if sim.club_api_football_id != api_football_id:
            raise HTTPException(
                status_code=400,
                detail=f"Simulation {sim_id} belongs to club {sim.club_api_football_id}",
            )

        # Buys
        for b in sim.buys:
            extra_wages += b.annual_salary
            extra_amort += calculate_annual_amortization(b.transfer_fee, b.contract_length_years)
            net_spend += b.transfer_fee

        # Sells
        for s in sim.sells:
            sell_player = None
            if s.api_football_player_id:
                sell_player = next(
                    (p for p in players if p.api_football_id == s.api_football_player_id),
                    None,
                )
            if sell_player:
                sal, yrs, fee, acq = await _get_player_financials(
                    sell_player, is_sd, viewer_id
                )
                sell_wages += sal
                if fee > 0 and yrs > 0 and acq > 0:
                    sell_amort_relief += amortization_for_season(
                        fee=fee, contract_years=yrs,
                        acquisition_year=acq, target_season_year=start_year,
                    )
                    elapsed = start_year - acq
                    sell_profit_loss += book_profit_or_loss(s.transfer_fee, fee, yrs, elapsed)
                else:
                    sell_profit_loss += s.transfer_fee
            else:
                sell_wages += s.annual_salary
                sell_amort_relief += calculate_annual_amortization(
                    s.transfer_fee, s.contract_length_years
                )
                sell_profit_loss += s.transfer_fee
            net_spend -= s.transfer_fee

        # Loans in
        for li in sim.loans_in:
            extra_wages += li.annual_salary * (li.wage_contribution_pct / 100)
            extra_amort += calculate_annual_amortization(li.loan_fee, li.contract_length_years)
            loan_fee_impact += li.loan_fee
            net_spend += li.loan_fee

        # Loans out
        for lo in sim.loans_out:
            lo_player = None
            if lo.api_football_player_id:
                lo_player = next(
                    (p for p in players if p.api_football_id == lo.api_football_player_id),
                    None,
                )
            if lo_player:
                full_sal, _, _, _ = await _get_player_financials(lo_player, is_sd, viewer_id)
            else:
                full_sal = lo.annual_salary
            sell_wages += full_sal * ((100 - lo.wage_contribution_pct) / 100)
            loan_fee_impact -= lo.loan_fee_received
            net_spend -= lo.loan_fee_received

    # Final totals 
    total_wages = max(baseline_wages + extra_wages - sell_wages, 0.0)
    total_amort = max(baseline_amort + extra_amort - sell_amort_relief, 0.0)
    current_scr = squad_cost_ratio_calc(annual_revenue, total_wages, total_amort)
    current_squad_cost = total_wages + total_amort
    current_status_str = ffp_status_from_ratio(current_scr)

    projections, overall = build_projections(
        base_revenue=annual_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amort,
        net_spend_year1=net_spend,
        loan_fee_impact_year1=loan_fee_impact,
        projection_years=3,
        start_year=start_year,
        sell_profit_loss_year1=sell_profit_loss,
    )

    proj_models = [
        YP(
            year=p.year, revenue=p.revenue, wage_bill=p.wage_bill,
            amortization=p.amortization, squad_cost=p.squad_cost,
            squad_cost_ratio=p.squad_cost_ratio,
            net_transfer_spend=p.net_transfer_spend,
            operating_result=p.operating_result, ffp_status=p.ffp_status,
        )
        for p in projections
    ]

    color_map = {"HIGH_RISK": "red", "WARNING": "amber", "SAFE": "green"}
    badge_map = {"HIGH_RISK": "🚨", "WARNING": "⚠️", "SAFE": "✅"}

    current_ffp = FFPStatus(
        status=current_status_str,
        color=color_map.get(current_status_str, "green"),
        badge=badge_map.get(current_status_str, "✅"),
        reason="",
        squad_cost_ratio=current_scr,
        break_even_result=0.0,
        break_even_ok=current_scr <= 0.70,
    )

    # Determine dominant salary source for the dashboard label
    if "sd_override" in sources_used:
        salary_data_source = "sd_override"
    elif "admin_override" in sources_used:
        salary_data_source = "admin_override"
    elif "capology_estimate" in sources_used:
        salary_data_source = "capology_estimate"
    elif "groq_estimate" in sources_used:
        salary_data_source = "groq_estimate"
    else:
        salary_data_source = "position_estimate"

    return FFPDashboardResponse(
        club_id=str(club.id),
        club_name=club.name,
        annual_revenue=annual_revenue,
        season_year=start_year,
        salary_data_source=salary_data_source,
        current_wage_bill=round(total_wages, 2),
        current_amortization=round(total_amort, 2),
        current_squad_cost=round(current_squad_cost, 2),
        current_squad_cost_ratio=round(current_scr, 4),
        current_ffp_status=current_ffp,
        projections=proj_models,
        revenue_configured=club.revenue_configured or (annual_revenue > 0),
        simulation_id=str(sim.id) if sim else None,
        simulation_name=sim.simulation_name if sim else None,
        baseline_wage_bill=round(baseline_wages, 2) if sim else None,
        simulation_extra_wages=round(extra_wages, 2) if sim else None,
        simulation_wage_relief=round(sell_wages, 2) if sim else None,
        simulation_net_spend=round(net_spend, 2) if sim else None,
    )