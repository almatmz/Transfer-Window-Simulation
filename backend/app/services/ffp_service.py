from fastapi import HTTPException

from app.models.club import Club
from app.models.player import Player
from app.schemas.ffp import FFPDashboardResponse, FFPThresholds
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import (
    build_yearly_projections,
    worst_case_status,
    evaluate_ffp_status,
    THRESHOLDS,
)


async def get_ffp_dashboard(club_id: str) -> FFPDashboardResponse:
    """
    Compute real-time FFP dashboard for a club based on current squad.
    No simulation — just the existing squad data.
    """
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    players = await Player.find(
        Player.club_id == club_id,
        Player.is_active == True,
    ).to_list()

    total_wages = sum(p.annual_salary for p in players)
    total_amortization = sum(
        calculate_annual_amortization(p.acquisition_fee, p.contract_length_years)
        for p in players
    )
    w_r_ratio = total_wages / club.annual_revenue if club.annual_revenue > 0 else 1.0
    net_spend = 0.0  # No transfers in this view

    projections = build_yearly_projections(
        base_revenue=club.annual_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amortization,
        net_spend=net_spend,
        projection_years=club.projection_years,
        season_year=club.season_year,
    )

    overall = evaluate_ffp_status(w_r_ratio, net_spend)

    return FFPDashboardResponse(
        club_id=str(club.id),
        club_name=club.name,
        season_year=club.season_year,
        current_wage_to_revenue=round(w_r_ratio, 4),
        current_amortization_burden=round(total_amortization, 2),
        current_net_spend=0.0,
        overall_status=overall,
        yearly_projections=projections,
        thresholds=THRESHOLDS,
    )