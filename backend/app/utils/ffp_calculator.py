"""
FFP (Financial Fair Play) calculation helpers.
Key metrics:
  - Wage-to-Revenue Ratio (W/R): Total wages / Total revenue
  - Net Transfer Spend per window
  - 3-year rolling projection
"""

from app.schemas.ffp import FFPStatus, FFPThresholds
from app.models.transfer import YearlyProjection


THRESHOLDS = FFPThresholds()


def evaluate_ffp_status(wage_to_revenue_ratio: float, net_spend: float) -> FFPStatus:
    """
    Determine FFP risk level based on key ratios.

    Args:
        wage_to_revenue_ratio: e.g. 0.72 = 72%
        net_spend: Positive = net buyer, Negative = net seller (EUR)

    Returns:
        FFPStatus with color, badge, reason
    """
    reasons = []
    max_level = "SAFE"

    if wage_to_revenue_ratio >= THRESHOLDS.wage_to_revenue_danger:
        max_level = "HIGH_RISK"
        reasons.append(
            f"Wage-to-revenue ratio {wage_to_revenue_ratio:.0%} exceeds danger threshold "
            f"({THRESHOLDS.wage_to_revenue_danger:.0%})"
        )
    elif wage_to_revenue_ratio >= THRESHOLDS.wage_to_revenue_warning:
        if max_level != "HIGH_RISK":
            max_level = "WARNING"
        reasons.append(
            f"Wage-to-revenue ratio {wage_to_revenue_ratio:.0%} in warning zone "
            f"(>{THRESHOLDS.wage_to_revenue_warning:.0%})"
        )

    if net_spend > THRESHOLDS.max_net_transfer_loss_per_window:
        max_level = "HIGH_RISK"
        reasons.append(
            f"Net transfer spend €{net_spend/1_000_000:.1f}M exceeds €"
            f"{THRESHOLDS.max_net_transfer_loss_per_window/1_000_000:.0f}M window ceiling"
        )

    status_map = {
        "SAFE": FFPStatus(
            status="SAFE",
            color="green",
            badge="✅",
            reason=reasons[0] if reasons else "All financial ratios within safe thresholds.",
        ),
        "WARNING": FFPStatus(
            status="WARNING",
            color="amber",
            badge="⚠️",
            reason=" | ".join(reasons) if reasons else "Approaching thresholds — monitor closely.",
        ),
        "HIGH_RISK": FFPStatus(
            status="HIGH_RISK",
            color="red",
            badge="🚨",
            reason=" | ".join(reasons) if reasons else "FFP breach risk detected.",
        ),
    }

    return status_map[max_level]


def build_yearly_projections(
    base_revenue: float,
    base_wage_bill: float,
    base_amortization: float,
    net_spend: float,
    projection_years: int,
    season_year: int,
    revenue_growth_rate: float = 0.05,
) -> list[YearlyProjection]:
    """
    Build multi-year FFP projections.

    Assumptions (conservative MVP defaults):
      - Revenue grows at 5% per year
      - Existing wage contracts step down as players expire
        (simplified: flat wages for MVP)
      - Amortization from new transfers spreads over contract length

    Args:
        base_revenue: Current annual revenue
        base_wage_bill: Current total wage bill
        base_amortization: Current total amortization charge
        net_spend: Net transfer spend this window (positive = buyer)
        projection_years: How many years to project
        season_year: Starting season year
        revenue_growth_rate: Annual revenue growth assumption

    Returns:
        List of YearlyProjection
    """
    projections = []
    revenue = base_revenue
    wage_bill = base_wage_bill
    amortization = base_amortization

    for i in range(projection_years):
        year = season_year + i
        if i > 0:
            revenue *= (1 + revenue_growth_rate)
            # Amortization naturally declines as contracts expire (simplified: linear decay)
            amortization = max(amortization * 0.90, 0)

        total_cost = wage_bill + amortization
        w_r_ratio = wage_bill / revenue if revenue > 0 else 1.0
        ffp = evaluate_ffp_status(w_r_ratio, net_spend if i == 0 else 0)

        projections.append(
            YearlyProjection(
                year=year,
                total_wage_bill=round(wage_bill, 2),
                amortization_cost=round(amortization, 2),
                revenue=round(revenue, 2),
                wage_to_revenue_ratio=round(w_r_ratio, 4),
                net_transfer_spend=round(net_spend if i == 0 else 0, 2),
                ffp_status=ffp.status,
            )
        )

    return projections


def worst_case_status(projections: list[YearlyProjection]) -> str:
    """Return the worst FFP status across all projection years."""
    priority = {"HIGH_RISK": 3, "WARNING": 2, "SAFE": 1}
    return max(projections, key=lambda p: priority.get(p.ffp_status, 0)).ffp_status