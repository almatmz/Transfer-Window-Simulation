from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.transfer import (
    WindowType, BuyEntry, SellEntry, LoanInEntry, LoanOutEntry, YearlyProjection
)


class SimulationCreateRequest(BaseModel):
    club_api_football_id: int = Field(
        ..., description="e.g. 33 = Man Utd, 541 = Real Madrid, 165 = Borussia Dortmund"
    )
    simulation_name: str = Field(..., min_length=2, max_length=100, description='e.g. "Summer 2026 rebuild"')
    window_type: WindowType = Field(default=WindowType.SUMMER)
    season: str = Field(default="2025/26", description='e.g. "2025/26" or "2026/27"')
    is_public: bool = False


class UpdateSimulationMetaRequest(BaseModel):
    simulation_name: Optional[str] = None
    window_type: Optional[WindowType] = None
    season: Optional[str] = None
    is_public: Optional[bool] = None



class AddBuyRequest(BuyEntry):
    pass


class AddSellRequest(SellEntry):
    pass


class AddLoanInRequest(LoanInEntry):
    pass


class AddLoanOutRequest(LoanOutEntry):
    pass


#  Responses

class SimulationResponse(BaseModel):
    id: str
    user_id: str
    club_api_football_id: int
    club_name: str
    simulation_name: str
    window_type: WindowType
    season: str

    buys: list[BuyEntry]
    sells: list[SellEntry]
    loans_in: list[LoanInEntry]
    loans_out: list[LoanOutEntry]

    used_salary_overrides: bool
    projections: list[YearlyProjection]

    total_buy_fees: float
    total_sell_fees: float
    total_loan_fees_paid: float
    total_loan_fees_received: float
    net_spend: float
    overall_ffp_status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SimulationSummary(BaseModel):
    """Quick listing — no transfer details, just headline numbers."""
    id: str
    club_name: str
    club_api_football_id: int
    simulation_name: str
    window_type: WindowType
    season: str
    total_buys: int
    total_sells: int
    total_loans_in: int
    total_loans_out: int
    net_spend: float
    overall_ffp_status: str
    is_public: bool
    created_at: datetime