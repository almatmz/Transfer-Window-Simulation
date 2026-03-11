from __future__ import annotations

from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.models.club import Club
from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.transfer import TransferSimulation
from app.models.user import User
from app.schemas.ffp import FFPDashboardResponse, FFPStatus, YearlyProjection as YP
from app.utils.amortization import (
    calculate_annual_amortization,
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


def _make_ffp_status(result: FFPStatusResult) -> FFPStatus:
    color_map = {"HIGH_RISK": "red", "WARNING": "amber", "SAFE": "green"}
    badge_map = {"HIGH_RISK": "🚨", "WARNING": "⚠️", "SAFE": "✅"}
    return FFPStatus(
        status=result.status,
        color=color_map.get(result.status, "green"),
        badge=badge_map.get(result.status, "✅"),
        reason=result.reason,
        squad_cost_ratio=result.squad_cost_ratio,
        break_even_result=result.break_even_result,
        break_even_ok=result.break_even_ok,
    )


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

    # Simulation year validation 
    start_year = simulation_year or club.season_year or _NOW_YEAR
    try:
        validate_simulation_year(start_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    players = await Player.find(Player.club_id == str(club.id)).to_list()
    is_sd = viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)

    # Baseline squad wages + amortization 
    baseline_wages = 0.0
    baseline_amort = 0.0
    sources_used: set[str] = set()

    for player in players:
        if player.is_sold:
            # Sold players: no ongoing wages or amortization
            continue

        if is_sd:
            override = await SalaryOverride.find_one(
                SalaryOverride.player_id == str(player.id)
            )
            if override:
                baseline_wages += override.annual_salary
                # Amortization based on override acquisition data
                fee = override.acquisition_fee
                years = override.contract_length_years
                acq_year = override.acquisition_year or 0
                if acq_year and fee > 0:
                    from app.utils.amortization import amortization_for_season
                    baseline_amort += amortization_for_season(
                        fee=fee,
                        contract_years=years,
                        acquisition_year=acq_year,
                        target_season_year=start_year,
                    )
                sources_used.add("sd_overrides")
                continue

        baseline_wages += player.estimated_annual_salary
        # Use season-aware amortization (not flat fee/years)
        if player.acquisition_fee > 0 and player.acquisition_year > 0:
            from app.utils.amortization import amortization_for_season
            baseline_amort += amortization_for_season(
                fee=player.acquisition_fee,
                contract_years=player.contract_length_years,
                acquisition_year=player.acquisition_year,
                target_season_year=start_year,
            )
        sources_used.add(player.salary_source or "position_estimate")

    #  Simulation overlay 
    sim = None
    net_spend = 0.0
    loan_fee_impact = 0.0
    extra_wages = 0.0
    extra_amort = 0.0
    sell_wages = 0.0
    sell_amort_relief = 0.0     # amortization that STOPS because player is sold
    sell_profit_loss = 0.0      # crystallized book profit/loss from sales

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

        #  Add buys 
        for b in sim.buys:
            extra_wages += b.annual_salary
            extra_amort += calculate_annual_amortization(
                b.transfer_fee, b.contract_length_years
            )
            net_spend += b.transfer_fee

        # ── Remove sells (correct: stop amortization + crystallize book P&L) ─
        for s in sim.sells:
            sell_player: Player | None = None
            if s.api_football_player_id:
                sell_player = next(
                    (p for p in players if p.api_football_id == s.api_football_player_id),
                    None,
                )
            if sell_player:
                # Wages removed
                if is_sd:
                    ov = await SalaryOverride.find_one(
                        SalaryOverride.player_id == str(sell_player.id)
                    )
                    sell_wages += ov.annual_salary if ov else sell_player.estimated_annual_salary
                    fee = ov.acquisition_fee if ov else sell_player.acquisition_fee
                    years = ov.contract_length_years if ov else sell_player.contract_length_years
                    acq_year = ov.acquisition_year if ov else sell_player.acquisition_year
                else:
                    sell_wages += sell_player.estimated_annual_salary
                    fee = sell_player.acquisition_fee
                    years = sell_player.contract_length_years
                    acq_year = sell_player.acquisition_year or 0

                # The annual amortization that was running — now stops
                if fee > 0 and years > 0 and acq_year > 0:
                    from app.utils.amortization import amortization_for_season
                    sell_amort_relief += amortization_for_season(
                        fee=fee,
                        contract_years=years,
                        acquisition_year=acq_year,
                        target_season_year=start_year,
                    )
                    # Crystallize profit/loss
                    elapsed = start_year - acq_year
                    pl = book_profit_or_loss(s.transfer_fee, fee, years, elapsed)
                    sell_profit_loss += pl
            else:
                # Unknown player — use provided values
                sell_wages += s.annual_salary
                sell_amort_relief += calculate_annual_amortization(
                    s.transfer_fee, s.contract_length_years
                )
                # No book value known, profit/loss = full fee (free transfer baseline)
                sell_profit_loss += s.transfer_fee

            net_spend -= s.transfer_fee

        #  Loan in 
        for li in sim.loans_in:
            extra_wages += li.annual_salary * (li.wage_contribution_pct / 100)
            extra_amort += calculate_annual_amortization(
                li.loan_fee, li.contract_length_years
            )
            loan_fee_impact += li.loan_fee
            net_spend += li.loan_fee

        # ── Loan out ──────────────────────────────────────────────────────────
        for lo in sim.loans_out:
            lo_player: Player | None = None
            if lo.api_football_player_id:
                lo_player = next(
                    (p for p in players if p.api_football_id == lo.api_football_player_id),
                    None,
                )
            if lo_player:
                if is_sd:
                    ov2 = await SalaryOverride.find_one(
                        SalaryOverride.player_id == str(lo_player.id)
                    )
                    full_sal = ov2.annual_salary if ov2 else lo_player.estimated_annual_salary
                else:
                    full_sal = lo_player.estimated_annual_salary
            else:
                full_sal = lo.annual_salary
            sell_wages += full_sal * ((100 - lo.wage_contribution_pct) / 100)
            loan_fee_impact -= lo.loan_fee_received
            net_spend -= lo.loan_fee_received

    #  Final totals
    total_wages = max(
        baseline_wages + extra_wages - sell_wages, 0.0
    )
    total_amort = max(
        baseline_amort + extra_amort - sell_amort_relief, 0.0
    )

    # Effective revenue (respects role authority)
    annual_revenue = club.effective_revenue

    current_scr = squad_cost_ratio_calc(annual_revenue, total_wages, total_amort)
    current_status_str = ffp_status_from_ratio(current_scr)
    current_squad_cost = total_wages + total_amort

    #  3-year projections 
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
            year=p.year,
            revenue=p.revenue,
            wage_bill=p.wage_bill,
            amortization=p.amortization,
            squad_cost=p.squad_cost,
            squad_cost_ratio=p.squad_cost_ratio,
            net_transfer_spend=p.net_transfer_spend,
            operating_result=p.operating_result,
            ffp_status=p.ffp_status,
        )
        for p in projections
    ]

    current_ffp = FFPStatus(
        status=current_status_str,
        color={"HIGH_RISK": "red", "WARNING": "amber", "SAFE": "green"}.get(
            current_status_str, "green"
        ),
        badge={"HIGH_RISK": "🚨", "WARNING": "⚠️", "SAFE": "✅"}.get(
            current_status_str, "✅"
        ),
        reason="",
        squad_cost_ratio=current_scr,
        break_even_result=0.0,
        break_even_ok=current_scr <= 0.70,
    )

    salary_data_source = (
        "sd_overrides" if "sd_overrides" in sources_used
        else ("capology_estimate" if "capology_estimate" in sources_used
              else ("groq_estimate" if "groq_estimate" in sources_used
                    else "position_estimate"))
    )

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
        revenue_configured=club.revenue_configured,
        simulation_id=str(sim.id) if sim else None,
        simulation_name=sim.simulation_name if sim else None,
        baseline_wage_bill=round(baseline_wages, 2) if sim else None,
        simulation_extra_wages=round(extra_wages, 2) if sim else None,
        simulation_wage_relief=round(sell_wages, 2) if sim else None,
        simulation_net_spend=round(net_spend, 2) if sim else None,
    )