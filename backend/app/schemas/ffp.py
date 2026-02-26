from pydantic import BaseModel, Field
from app.models.transfer import YearlyProjection


class FFPThresholds(BaseModel):
    """UEFA-inspired simplified FFP thresholds."""
    wage_to_revenue_warning: float = 0.70   # 70% — amber zone
    wage_to_revenue_danger: float = 0.85    # 85% — red zone
    max_net_transfer_loss_per_window: float = 90_000_000  # €90M simplified ceiling


class FFPStatus(BaseModel):
    status: str  # SAFE | WARNING | HIGH_RISK
    color: str   # green | amber | red
    badge: str   # emoji indicator
    reason: str


class FFPDashboardResponse(BaseModel):
    club_id: str
    club_name: str
    season_year: int
    current_wage_to_revenue: float
    current_amortization_burden: float
    current_net_spend: float
    overall_status: FFPStatus
    yearly_projections: list[YearlyProjection]
    thresholds: FFPThresholds