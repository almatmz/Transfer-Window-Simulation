"""
FFP Calculator — UEFA Squad Cost Rule (2025 onwards)
=====================================================

UEFA's Financial Sustainability Regulations (FSR), effective 2025:

RULE 1: Squad Cost Ratio (SCR)
  squad_cost = wage_bill + amortization + agent_fees + coach_salaries
  ratio = squad_cost / relevant_income
  Thresholds (phased in):
    2023/24: ≤ 90%
    2024/25: ≤ 80%
    2025/26: ≤ 70%   ← current
  This replaces the old wage/revenue ratio.

RULE 2: Break-Even Result (BER) — 3-year rolling
  break_even = (revenues - expenses) summed over 3 seasons
  Expenses exclude: infrastructure, youth development, women's football, community
  Acceptable deficit: €5M over 3 years (up to €60M if covered by equity injections)

RULE 3: No overdue payables
  Clubs must not have unpaid debts to other clubs, employees, or tax authorities.
  (We flag this as a manual reminder — not calculable from our data.)

REVENUE NOTE:
  "Relevant income" = matchday + broadcasting + commercial + player sales
  Player sale profit = transfer_fee_received - (remaining book value)
  We approximate: relevant_income ≈ annual_revenue + sell_proceeds_net

References:
  https://www.uefa.com/insideuefa/stakeholders/clubs/financial-sustainability/
"""

from dataclasses import dataclass, field
from typing import Optional



SCR_SAFE      = 0.70   
SCR_WARNING   = 0.65   
SCR_DANGER    = 0.70   
BER_LIMIT          = -5_000_000.0    
BER_EQUITY_LIMIT   = -60_000_000.0   

REVENUE_GROWTH     = 0.05   
AMORT_DECAY        = 0.10   



@dataclass
class SeasonFinancials:
    year: int
    revenue: float             
    wage_bill: float        
    amortization: float         
    agent_fees: float = 0.0     
    net_transfer_spend: float = 0.0 
    loan_fee_impact: float = 0.0


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
    squad_cost: float             # wage_bill + amortization + agent_fees
    squad_cost_ratio: float      
    net_transfer_spend: float
    operating_result: float       
    ffp_status: str


# Core calculation functions

def squad_cost_ratio(revenue: float, wage_bill: float, amortization: float, agent_fees: float = 0.0) -> float:
    """
    UEFA Squad Cost Ratio = (wages + amortization + agent_fees) / revenue
    Returns 1.0 (100%) if revenue is zero — automatic violation.
    Result is a decimal: 0.68 means 68%.
    """
    if revenue <= 0:
        return 1.0
    squad_cost = wage_bill + amortization + agent_fees
    return squad_cost / revenue


def ffp_status_from_ratio(ratio: float) -> str:
    """
    SAFE    = ratio ≤ 65%  (comfortable buffer below 70% limit)
    WARNING = 65% < ratio ≤ 70%  (within limit but approaching)
    HIGH_RISK = ratio > 70%  (exceeds UEFA limit)
    """
    if ratio > SCR_DANGER:
        return "HIGH_RISK"
    elif ratio > SCR_WARNING:
        return "WARNING"
    return "SAFE"


def break_even_result(seasons: list[SeasonFinancials]) -> float:
    """
    3-year rolling break-even result.
    Simplified: revenue - wages - amortization per season, summed.
    UEFA allows exclusions (youth, infrastructure) but we can't calculate those.
    """
    total = 0.0
    for s in seasons[-3:]:  # last 3 seasons
        operating = s.revenue - s.wage_bill - s.amortization - s.agent_fees
        total += operating
    return total


def evaluate_break_even(ber: float, owner_injection: float = 0.0) -> tuple[bool, str]:
    """Returns (is_ok, reason_string)."""
    if ber >= BER_LIMIT:
        return True, f"Break-even OK: €{ber/1e6:+.1f}M over 3 years (limit: €{BER_LIMIT/1e6:.0f}M)"
    elif ber >= BER_EQUITY_LIMIT and owner_injection >= abs(ber):
        return True, f"Break-even covered by equity injection: €{owner_injection/1e6:.1f}M"
    else:
        gap = abs(ber) - min(abs(BER_EQUITY_LIMIT), abs(ber))
        return False, f"Break-even deficit: €{ber/1e6:+.1f}M — exceeds limit by €{max(0, abs(ber) - abs(BER_EQUITY_LIMIT))/1e6:.1f}M"


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
) -> tuple[list[YearProjection], FFPStatusResult]:
    """
    Build multi-year financial projections and evaluate FFP compliance.

    Returns (projections, overall_ffp_status).

    Key assumptions:
    - Revenue grows at `revenue_growth` % per year (default 5%)
    - Amortization decays at `amort_decay` % per year as contracts run down
    - Net transfer spend and loan fees only apply in year 1 (the simulated window)
    - Wages are flat across projection years (conservative — no pay rises)
    """
    if base_revenue <= 0:
        # Club has no revenue set — flag clearly rather than silently dividing by 1
        base_revenue = 0.0 

    projections = []
    season_data = []
    revenue = base_revenue
    amortization = base_amortization

    for i in range(projection_years):
        year = start_year + i

        if i > 0:
            revenue = revenue * (1 + revenue_growth)
            amortization = max(amortization * (1 - amort_decay), 0)
            net_spend = 0.0
            loan_impact = 0.0
        else:
            net_spend = net_spend_year1
            loan_impact = loan_fee_impact_year1

        ratio = squad_cost_ratio(revenue, base_wage_bill, amortization, agent_fees)
        status = ffp_status_from_ratio(ratio)
        squad_cost = base_wage_bill + amortization + agent_fees
        operating = revenue - squad_cost

        sf = SeasonFinancials(
            year=year,
            revenue=revenue,
            wage_bill=base_wage_bill,
            amortization=amortization,
            agent_fees=agent_fees,
            net_transfer_spend=net_spend,
            loan_fee_impact=loan_impact,
        )
        season_data.append(sf)

        projections.append(YearProjection(
            year=year,
            revenue=round(revenue, 0),
            wage_bill=round(base_wage_bill, 0),
            amortization=round(amortization, 0),
            squad_cost=round(squad_cost, 0),
            squad_cost_ratio=round(ratio, 4),   # 0.6823 = 68.23%
            net_transfer_spend=round(net_spend, 0),
            operating_result=round(operating, 0),
            ffp_status=status,
        ))

    # Overall FFP assessment
    ber = break_even_result(season_data)
    ber_ok, ber_reason = evaluate_break_even(ber, owner_injection)

    # Worst SCR across all years
    worst_ratio = max(p.squad_cost_ratio for p in projections)
    worst_status = ffp_status_from_ratio(worst_ratio)

    # Final status = worst of SCR and BER
    if worst_status == "HIGH_RISK" or not ber_ok:
        final_status = "HIGH_RISK"
    elif worst_status == "WARNING":
        final_status = "WARNING"
    else:
        final_status = "SAFE"

    reasons = []
    if base_revenue <= 0:
        reasons.append("⚠️ Club revenue not set — set it via PATCH /clubs/{id}/revenue for accurate FFP")
        final_status = "HIGH_RISK"
    if worst_status == "HIGH_RISK":
        reasons.append(f"Squad cost ratio {worst_ratio:.1%} exceeds 70% UEFA limit")
    elif worst_status == "WARNING":
        reasons.append(f"Squad cost ratio {worst_ratio:.1%} approaching 70% limit")
    if not ber_ok:
        reasons.append(ber_reason)

    badges = {"SAFE": "✅", "WARNING": "⚠️", "HIGH_RISK": "🚨"}
    colors = {"SAFE": "green", "WARNING": "amber", "HIGH_RISK": "red"}

    result = FFPStatusResult(
        status=final_status,
        color=colors[final_status],
        badge=badges[final_status],
        squad_cost_ratio=worst_ratio,
        break_even_result=round(ber, 0),
        break_even_ok=ber_ok,
        reasons=reasons,
    )

    return projections, result


def worst_case_status(projections: list) -> str:
    priority = {"HIGH_RISK": 3, "WARNING": 2, "SAFE": 1}
    if not projections:
        return "SAFE"
    return max(projections, key=lambda p: priority.get(
        p.ffp_status if hasattr(p, "ffp_status") else p.get("ffp_status", "SAFE"), 0
    )).ffp_status if hasattr(projections[0], "ffp_status") else max(
        projections, key=lambda p: priority.get(p.get("ffp_status", "SAFE"), 0)
    )["ffp_status"]