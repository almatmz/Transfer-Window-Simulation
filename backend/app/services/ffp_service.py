from fastapi import HTTPException
from app.models.club import Club
from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.user import User
from app.schemas.ffp import FFPDashboardResponse, FFPStatus
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import build_projections, squad_cost_ratio, ffp_status_from_ratio
from app.core.security import UserRole


async def get_ffp_dashboard_by_api_id(
    api_football_id: int, viewer: User | None
) -> FFPDashboardResponse:
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {api_football_id} not loaded yet. "
                   f"Call GET /api/v1/search/clubs/{api_football_id} first to load it."
        )

    players = await Player.find(Player.club_id == str(club.id)).to_list()
    is_sd = viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)

    total_wages = 0.0
    total_amortization = 0.0
    sources_used: set[str] = set()

    for player in players:
        if is_sd:
            override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
            if override:
                total_wages += override.annual_salary
                total_amortization += calculate_annual_amortization(
                    override.acquisition_fee, override.contract_length_years
                )
                sources_used.add("sd_overrides")
                continue
        total_wages += player.estimated_annual_salary
        sources_used.add("capology_estimates")

    salary_data_source = (
        "mixed" if len(sources_used) == 2
        else "sd_overrides" if "sd_overrides" in sources_used
        else "capology_estimates"
    )

    base_revenue = club.annual_revenue or 0.0
    revenue_configured = base_revenue > 0

    # Current year snapshot
    current_ratio = squad_cost_ratio(base_revenue, total_wages, total_amortization)
    current_squad_cost = total_wages + total_amortization
    current_status_str = ffp_status_from_ratio(current_ratio)

    # Determine reason
    if not revenue_configured:
        reason = "⚠️ Revenue not set. Set it via PATCH /api/v1/clubs/{id}/revenue for accurate FFP."
        current_status_str = "HIGH_RISK"
    elif current_status_str == "HIGH_RISK":
        reason = f"Squad cost {current_ratio:.1%} exceeds 70% UEFA Squad Cost Ratio limit"
    elif current_status_str == "WARNING":
        reason = f"Squad cost ratio {current_ratio:.1%} approaching 70% limit — monitor closely"
    else:
        reason = f"Squad cost ratio {current_ratio:.1%} — within UEFA 70% limit ✅"

    badges = {"SAFE": "✅", "WARNING": "⚠️", "HIGH_RISK": "🚨"}
    colors = {"SAFE": "green", "WARNING": "amber", "HIGH_RISK": "red"}

    current_ffp = FFPStatus(
        status=current_status_str,
        color=colors[current_status_str],
        badge=badges[current_status_str],
        reason=reason,
        squad_cost_ratio=round(current_ratio, 4),
        break_even_result=0.0,   # requires 3 years of history — not available from squad data alone
        break_even_ok=True,
    )

    # 3-year projections
    projections, _ = build_projections(
        base_revenue=base_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amortization,
        net_spend_year1=0,
        loan_fee_impact_year1=0,
        projection_years=3,
        start_year=club.season_year or 2025,
    )

    # Convert dataclass → dict for pydantic
    proj_out = [p.__dict__ for p in projections]

    return FFPDashboardResponse(
        club_id=str(club.id),
        club_name=club.name,
        annual_revenue=base_revenue,
        season_year=club.season_year or 2025,
        salary_data_source=salary_data_source,
        current_wage_bill=round(total_wages, 0),
        current_amortization=round(total_amortization, 0),
        current_squad_cost=round(current_squad_cost, 0),
        current_squad_cost_ratio=round(current_ratio, 4),
        current_ffp_status=current_ffp,
        projections=proj_out,
        revenue_configured=revenue_configured,
    )