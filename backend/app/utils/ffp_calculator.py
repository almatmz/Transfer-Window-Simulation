from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.utils.amortization import (
    amortization_for_season,
    book_profit_or_loss,
    remaining_book_value,
)

CURRENT_YEAR = 2026
MAX_FUTURE_YEARS = 3

SCR_WARNING        = 0.65
SCR_DANGER         = 0.70
BER_LIMIT          = -5_000_000.0
BER_EQUITY_LIMIT   = -60_000_000.0

REVENUE_GROWTH     = 0.05
AMORT_DECAY        = 0.10


#  Data structures 

@dataclass
class PlayerAmortEntry:
    player_id: str
    name: str
    fee: float
    contract_years: int
    acquisition_year: int
    is_sold: bool = False
    sold_in_year: int = 0
    sale_fee: float = 0.0


@dataclass
class SeasonFinancials:
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    agent_fees: float = 0.0
    net_transfer_spend: float = 0.0
    loan_fee_impact: float = 0.0
    sell_profit_loss: float = 0.0


@dataclass
class FFPStatusResult:
    status: str
    color: str
    badge: str
    squad_cost_ratio: float
    break_even_result: float
    break_even_ok: bool
    reasons: list[str] = field(default_factory=list)

    @property
    def reason(self) -> str:
        return " | ".join(self.reasons) if self.reasons else "All ratios within safe thresholds."


@dataclass
class YearProjection:
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float
    net_transfer_spend: float
    operating_result: float
    ffp_status: str
    sell_profit_loss: float = 0.0


#  Core functions

def validate_simulation_year(start_year: int) -> None:
    if start_year > CURRENT_YEAR + MAX_FUTURE_YEARS:
        raise ValueError(
            f"Cannot simulate for {start_year}. "
            f"Maximum allowed year is {CURRENT_YEAR + MAX_FUTURE_YEARS} "
            f"({MAX_FUTURE_YEARS} years from {CURRENT_YEAR})."
        )


def squad_cost_ratio_calc(
    revenue: float,
    wage_bill: float,
    amortization: float,
    agent_fees: float = 0.0,
) -> float:
    if revenue <= 0:
        return 1.0
    return (wage_bill + amortization + agent_fees) / revenue


squad_cost_ratio = squad_cost_ratio_calc


def ffp_status_from_ratio(ratio: float) -> str:
    if ratio > SCR_DANGER:
        return "HIGH_RISK"
    elif ratio > SCR_WARNING:
        return "WARNING"
    return "SAFE"


def break_even_result(seasons: list[SeasonFinancials]) -> float:
    total = 0.0
    for s in seasons[-3:]:
        operating = (
            s.revenue
            + s.sell_profit_loss
            - s.wage_bill
            - s.amortization
            - s.agent_fees
        )
        total += operating
    return total


def evaluate_break_even(ber: float, owner_injection: float = 0.0) -> tuple[bool, str]:
    if ber >= BER_LIMIT:
        return True, f"Break-even OK: €{ber/1e6:+.1f}M over 3 seasons"
    elif ber >= BER_EQUITY_LIMIT and owner_injection >= abs(ber):
        return True, f"Break-even covered by equity injection: €{owner_injection/1e6:.1f}M"
    else:
        return False, (
            f"Break-even deficit: €{ber/1e6:+.1f}M — "
            f"exceeds limit by €{max(0, abs(ber) - abs(BER_EQUITY_LIMIT))/1e6:.1f}M"
        )


def compute_squad_amortization_for_season(
    players: list[PlayerAmortEntry],
    target_year: int,
) -> tuple[float, float]:
    total_amort = 0.0
    total_sell_pl = 0.0
    for p in players:
        charge = amortization_for_season(
            fee=p.fee,
            contract_years=p.contract_years,
            acquisition_year=p.acquisition_year,
            target_season_year=target_year,
            is_sold=p.is_sold,
            sold_in_year=p.sold_in_year,
        )
        total_amort += charge
        if p.is_sold and p.sold_in_year == target_year and p.fee > 0:
            elapsed = p.sold_in_year - p.acquisition_year if p.acquisition_year else 0
            pl = book_profit_or_loss(p.sale_fee, p.fee, p.contract_years, elapsed)
            total_sell_pl += pl
    return round(total_amort, 2), round(total_sell_pl, 2)


def worst_case_status(projections: list[YearProjection]) -> FFPStatusResult:
    priority = {"HIGH_RISK": 2, "WARNING": 1, "SAFE": 0}
    worst = max(projections, key=lambda p: priority.get(p.ffp_status, 0))
    ratio = worst.squad_cost_ratio
    ber_total = sum(
        p.revenue + p.sell_profit_loss - p.wage_bill - p.amortization
        for p in projections[-3:]
    )
    ber_ok, ber_reason = evaluate_break_even(ber_total)
    reasons = []
    if ratio > SCR_DANGER:
        reasons.append(f"Squad cost ratio {ratio:.1%} exceeds UEFA 70% limit")
    elif ratio > SCR_WARNING:
        reasons.append(f"Squad cost ratio {ratio:.1%} approaching 70% limit")
    if not ber_ok:
        reasons.append(ber_reason)
    color_map = {"HIGH_RISK": "red", "WARNING": "amber", "SAFE": "green"}
    badge_map = {"HIGH_RISK": "🚨", "WARNING": "⚠️", "SAFE": "✅"}
    return FFPStatusResult(
        status=worst.ffp_status,
        color=color_map.get(worst.ffp_status, "green"),
        badge=badge_map.get(worst.ffp_status, "✅"),
        squad_cost_ratio=ratio,
        break_even_result=ber_total,
        break_even_ok=ber_ok,
        reasons=reasons,
    )


def build_projections(
    base_revenue: float,
    base_wage_bill: float,
    base_amortization: float,
    net_spend_year1: float,
    loan_fee_impact_year1: float,
    projection_years: int,
    start_year: int,
    agent_fees: float = 0.0,
    revenue_growth: float = REVENUE_GROWTH,
    amort_decay: float = AMORT_DECAY,
    owner_injection: float = 0.0,
    sell_profit_loss_year1: float = 0.0,
    past_seasons: Optional[list[SeasonFinancials]] = None,
    # KEY NEW PARAM: per-year wage bills computed from actual squad data
    # If provided, overrides base_wage_bill for each year
    # Index 0 = start_year, 1 = start_year+1, etc.
    per_year_wage_bills: Optional[list[float]] = None,
) -> tuple[list[YearProjection], FFPStatusResult]:
    """
    Build multi-year financial projections and evaluate FFP compliance.

    When per_year_wage_bills is provided:
      - Each year uses the exact wage bill for that year (expiring contracts,
        extensions, and loan end dates already factored in by ffp_service)
      - base_wage_bill is only used as fallback if the list is shorter
        than projection_years

    When per_year_wage_bills is NOT provided:
      - Uses base_wage_bill flat across all years (old behaviour)
    """
    validate_simulation_year(start_year)

    if base_revenue < 0:
        base_revenue = 0.0

    projections: list[YearProjection] = []
    season_data: list[SeasonFinancials] = list(past_seasons or [])

    revenue = base_revenue
    amortization = base_amortization

    for i in range(projection_years):
        year = start_year + i
        year_net_spend = net_spend_year1 if i == 0 else 0.0
        year_loan_impact = loan_fee_impact_year1 if i == 0 else 0.0
        year_sell_pl = sell_profit_loss_year1 if i == 0 else 0.0

        if i > 0:
            revenue *= (1 + revenue_growth)
            amortization *= (1 - amort_decay)

        # Use per-year wage bill if provided, else fall back to base
        if per_year_wage_bills and i < len(per_year_wage_bills):
            year_wage_bill = per_year_wage_bills[i]
        else:
            year_wage_bill = base_wage_bill

        # Add simulation buys to year 1 wage bill
        if i == 0:
            # net_spend already includes buy wages via ffp_service's extra_wages
            # year_wage_bill here is baseline only; total is computed in ffp_service
            pass

        scr = squad_cost_ratio_calc(revenue, year_wage_bill, amortization, agent_fees)
        squad_cost = year_wage_bill + amortization + agent_fees
        effective_revenue = revenue + year_sell_pl
        operating_result = effective_revenue - squad_cost

        season = SeasonFinancials(
            year=year,
            revenue=revenue,
            wage_bill=year_wage_bill,
            amortization=amortization,
            agent_fees=agent_fees,
            net_transfer_spend=year_net_spend,
            loan_fee_impact=year_loan_impact,
            sell_profit_loss=year_sell_pl,
        )
        season_data.append(season)

        ber = break_even_result(season_data)
        ber_ok, _ = evaluate_break_even(ber, owner_injection)

        status = ffp_status_from_ratio(scr)
        if not ber_ok and status == "SAFE":
            status = "WARNING"

        projections.append(YearProjection(
            year=year,
            revenue=round(revenue, 2),
            wage_bill=round(year_wage_bill, 2),
            amortization=round(amortization, 2),
            squad_cost=round(squad_cost, 2),
            squad_cost_ratio=round(scr, 4),
            net_transfer_spend=round(year_net_spend, 2),
            operating_result=round(operating_result, 2),
            ffp_status=status,
            sell_profit_loss=round(year_sell_pl, 2),
        ))

    overall = worst_case_status(projections)
    return projections, overall