from pydantic import BaseModel, Field
from typing import Optional


class YearlyProjection(BaseModel):
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float         # e.g. 0.68 = 68%. UEFA limit = 0.70
    net_transfer_spend: float
    operating_result: float
    ffp_status: str                 # SAFE | WARNING | HIGH_RISK


class FFPStatus(BaseModel):
    status: str                     # SAFE | WARNING | HIGH_RISK
    color: str                      # green | amber | red
    badge: str                      # ✅ | ⚠️ | 🚨
    reason: str
    squad_cost_ratio: float
    break_even_result: float
    break_even_ok: bool


class FFPDashboardResponse(BaseModel):
    club_id: str
    club_name: str
    annual_revenue: float
    season_year: int
    salary_data_source: str

    # Current squad snapshot (with simulation applied if sim_id provided)
    current_wage_bill: float
    current_amortization: float
    current_squad_cost: float
    current_squad_cost_ratio: float = Field(description="e.g. 0.19 = 19%. UEFA limit = 0.70")
    current_ffp_status: FFPStatus

    # 3-year projections
    projections: list[YearlyProjection]

    # UEFA reference thresholds
    squad_cost_ratio_limit: float = 0.70
    squad_cost_ratio_warning: float = 0.65
    break_even_limit_eur: float = -5_000_000.0
    break_even_equity_limit_eur: float = -60_000_000.0

    revenue_configured: bool

    # Simulation overlay fields (null when no sim_id passed)
    simulation_id: Optional[str] = None
    simulation_name: Optional[str] = None
    baseline_wage_bill: Optional[float] = Field(None, description="Real squad wages before simulation")
    simulation_extra_wages: Optional[float] = Field(None, description="Wages added by buys/loans-in")
    simulation_wage_relief: Optional[float] = Field(None, description="Wages removed by sells/loans-out")
    simulation_net_spend: Optional[float] = Field(None, description="Net transfer spend from simulation")