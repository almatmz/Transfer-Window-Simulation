from pydantic import BaseModel, Field
from typing import Optional


class FFPStatus(BaseModel):
    status: str        # SAFE | WARNING | HIGH_RISK
    color: str         # green | amber | red
    badge: str         # ✅ | ⚠️ | 🚨
    reason: str
    squad_cost_ratio: float = Field(description="Decimal e.g. 0.68 = 68%. UEFA limit = 70%")
    break_even_result: float = Field(description="3-year rolling profit/loss in EUR")
    break_even_ok: bool


class YearlyProjection(BaseModel):
    year: int
    revenue: float                  = Field(description="Projected revenue in EUR")
    wage_bill: float                = Field(description="Annual wages in EUR")
    amortization: float             = Field(description="Annual transfer amortization in EUR")
    squad_cost: float               = Field(description="wages + amortization + agent fees")
    squad_cost_ratio: float         = Field(description="squad_cost / revenue. e.g. 0.68 = 68%")
    net_transfer_spend: float       = Field(description="Net spend this season (year 1 only)")
    operating_result: float         = Field(description="revenue - squad_cost (simplified)")
    ffp_status: str                 = Field(description="SAFE | WARNING | HIGH_RISK")


class FFPDashboardResponse(BaseModel):
    club_id: str
    club_name: str
    annual_revenue: float           = Field(description="Club revenue in EUR. Set via PATCH /clubs/{id}/revenue")
    season_year: int
    salary_data_source: str         = Field(description="capology_estimates | sd_overrides | mixed")

    # Current snapshot
    current_wage_bill: float
    current_amortization: float
    current_squad_cost: float
    current_squad_cost_ratio: float = Field(description="e.g. 0.68 = 68% of revenue. UEFA limit = 70%")
    current_ffp_status: FFPStatus

    # 3-year projections
    projections: list[YearlyProjection]

    # UEFA thresholds for reference
    squad_cost_ratio_limit: float = 0.70
    squad_cost_ratio_warning: float = 0.65
    break_even_limit_eur: float = -5_000_000.0
    break_even_equity_limit_eur: float = -60_000_000.0

    # Data quality warning
    revenue_configured: bool = Field(
        description="False if club revenue hasn't been set — FFP results will be unreliable"
    )