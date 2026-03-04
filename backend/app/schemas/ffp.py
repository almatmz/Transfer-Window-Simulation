from pydantic import BaseModel, Field
from typing import Optional


class YearlyProjection(BaseModel):
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float          # e.g. 0.469 = 46.9%. UEFA limit = 0.70
    net_transfer_spend: float
    operating_result: float
    ffp_status: str                  # SAFE | MONITORING | HIGH_RISK
    squad_cost_status: str           # OK | WARNING | VIOLATION


class FFPDashboardResponse(BaseModel):
    club_id: str
    club_name: str
    annual_revenue: float
    season_year: int
    contract_count: int              # number of active contracts used in calculation

    # Current financials
    wage_bill: float
    total_amortization: float
    squad_cost: float
    squad_cost_ratio: float = Field(description="Decimal, e.g. 0.469 = 46.9%")

    # Status
    squad_cost_status: str           # OK | WARNING | VIOLATION
    break_even_result: float
    break_even_status: str           # OK | WARNING | VIOLATION
    overall_status: str              # SAFE | MONITORING | HIGH_RISK

    # Human-readable labels
    squad_cost_ratio_pct: str        # "46.9%"
    break_even_label: str            # "+€2.0M" or "-€12.0M"

    # 3-year projections (calculated fresh, never stored)
    projections: list[YearlyProjection]

    # UEFA thresholds (for frontend reference)
    squad_cost_ratio_limit: float = 0.70
    squad_cost_ratio_warning: float = 0.65
    break_even_limit_eur: float = -5_000_000.0
    break_even_equity_limit_eur: float = -60_000_000.0

    # Simulation overlay fields (null when no sim_id passed)
    simulation_id: Optional[str] = None
    simulation_name: Optional[str] = None
    sim_added_wages: Optional[float] = None
    sim_added_amortization: Optional[float] = None
    sim_removed_wages: Optional[float] = None
    sim_net_spend: Optional[float] = None