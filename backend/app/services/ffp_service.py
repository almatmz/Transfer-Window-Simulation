from fastapi import HTTPException
from app.models.club import Club
from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.transfer import TransferSimulation
from app.models.user import User
from app.schemas.ffp import FFPDashboardResponse, FFPStatus, YearlyProjection as YP
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import build_projections, squad_cost_ratio, ffp_status_from_ratio
from app.core.security import UserRole


async def get_ffp_dashboard_by_api_id(
    api_football_id: int,
    viewer: User | None,
    sim_id: str | None = None,
) -> FFPDashboardResponse:
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {api_football_id} not loaded. Call GET /clubs/{api_football_id} first."
        )

    players = await Player.find(Player.club_id == str(club.id)).to_list()
    is_sd = viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)

    # ── Baseline squad wages + amortization ──────────────────────────────────
    baseline_wages = 0.0
    baseline_amort = 0.0
    sources_used: set[str] = set()

    for player in players:
        if is_sd:
            override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
            if override:
                baseline_wages += override.annual_salary
                baseline_amort += calculate_annual_amortization(
                    override.acquisition_fee, override.contract_length_years
                )
                sources_used.add("sd_overrides")
                continue
        baseline_wages += player.estimated_annual_salary
        sources_used.add("gemini_estimates")

    # ── Overlay simulation if sim_id provided ─────────────────────────────────
    sim = None
    sim_label = ""
    net_spend = 0.0
    loan_fee_impact = 0.0
    extra_wages = 0.0
    extra_amort = 0.0
    sell_wages  = 0.0
    sell_amort  = 0.0

    if sim_id:
        from beanie import PydanticObjectId
        try:
            sim = await TransferSimulation.get(PydanticObjectId(sim_id))
        except Exception:
            raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")

        if sim.club_api_football_id != api_football_id:
            raise HTTPException(
                status_code=400,
                detail=f"Simulation {sim_id} belongs to club {sim.club_api_football_id}, not {api_football_id}"
            )

        sim_label = f" + sim '{sim.simulation_name}'"

        # Add buys
        for b in sim.buys:
            extra_wages += b.annual_salary
            extra_amort += calculate_annual_amortization(b.transfer_fee, b.contract_length_years)
            net_spend   += b.transfer_fee

        # Remove sells
        for s in sim.sells:
            # Try to find this player in squad for their actual salary
            sell_player = None
            if s.api_football_player_id:
                sell_player = next(
                    (p for p in players if p.api_football_id == s.api_football_player_id), None
                )
            if sell_player:
                sell_wages += sell_player.estimated_annual_salary
                sell_amort += calculate_annual_amortization(
                    sell_player.transfer_value or 0, 1
                )
            else:
                sell_wages += s.annual_salary
            net_spend -= s.transfer_fee

        # Loans in
        for li in sim.loans_in:
            pct = (li.wage_contribution_pct or 100) / 100
            extra_wages  += li.annual_salary * pct
            loan_fee_impact += getattr(li, "loan_fee", 0)

        # Loans out
        for lo in sim.loans_out:
            pct = (lo.wage_contribution_pct or 0) / 100
            # Relief = salary * (1 - your_contribution_pct)
            sell_wages += lo.annual_salary * (1 - pct)
            loan_fee_impact -= getattr(lo, "loan_fee", 0)

    total_wages = max(baseline_wages + extra_wages - sell_wages, 0)
    total_amort = max(baseline_amort + extra_amort - sell_amort, 0)

    salary_data_source = (
        "mixed" if len(sources_used) == 2
        else "sd_overrides" if "sd_overrides" in sources_used
        else "gemini_estimates"
    )

    base_revenue = club.annual_revenue or 0.0
    revenue_configured = base_revenue > 0

    # ── Current snapshot ──────────────────────────────────────────────────────
    current_ratio      = squad_cost_ratio(base_revenue, total_wages, total_amort)
    current_squad_cost = total_wages + total_amort
    current_status_str = ffp_status_from_ratio(current_ratio)

    if not revenue_configured:
        reason = "⚠️ Revenue not set. Use PATCH /clubs/{id}/revenue for accurate FFP."
        current_status_str = "HIGH_RISK"
    elif current_status_str == "HIGH_RISK":
        reason = f"Squad cost {current_ratio:.1%} exceeds UEFA 70% limit"
    elif current_status_str == "WARNING":
        reason = f"Squad cost ratio {current_ratio:.1%} approaching 70% limit — monitor closely"
    else:
        reason = f"Squad cost ratio {current_ratio:.1%} — within UEFA 70% limit ✅"

    if sim:
        reason += f" (simulation: '{sim.simulation_name}' applied)"

    badges = {"SAFE": "✅", "WARNING": "⚠️", "HIGH_RISK": "🚨"}
    colors = {"SAFE": "green", "WARNING": "amber", "HIGH_RISK": "red"}

    current_ffp = FFPStatus(
        status=current_status_str,
        color=colors[current_status_str],
        badge=badges[current_status_str],
        reason=reason,
        squad_cost_ratio=round(current_ratio, 4),
        break_even_result=0.0,
        break_even_ok=True,
    )

    # ── 3-year projections ────────────────────────────────────────────────────
    projections, _ = build_projections(
        base_revenue=base_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amort,
        net_spend_year1=net_spend,
        loan_fee_impact_year1=loan_fee_impact,
        projection_years=3,
        start_year=club.season_year or 2025,
    )

    proj_out = [YP(
        year=p.year,
        revenue=p.revenue,
        wage_bill=p.wage_bill,
        amortization=p.amortization,
        squad_cost=p.squad_cost,
        squad_cost_ratio=p.squad_cost_ratio,
        net_transfer_spend=p.net_transfer_spend,
        operating_result=p.operating_result,
        ffp_status=p.ffp_status,
    ) for p in projections]

    return FFPDashboardResponse(
        club_id=str(club.id),
        club_name=club.name + sim_label,
        annual_revenue=base_revenue,
        season_year=club.season_year or 2025,
        salary_data_source=salary_data_source,
        current_wage_bill=round(total_wages, 0),
        current_amortization=round(total_amort, 0),
        current_squad_cost=round(current_squad_cost, 0),
        current_squad_cost_ratio=round(current_ratio, 4),
        current_ffp_status=current_ffp,
        projections=proj_out,
        revenue_configured=revenue_configured,
        simulation_id=sim_id,
        simulation_name=sim.simulation_name if sim else None,
        baseline_wage_bill=round(baseline_wages, 0),
        simulation_extra_wages=round(extra_wages, 0),
        simulation_wage_relief=round(sell_wages, 0),
        simulation_net_spend=round(net_spend, 0),
    )