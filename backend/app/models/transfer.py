from beanie import Document
from pydantic import Field, BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class TransferType(str, Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"


class TransferEntry(BaseModel):
    """A single incoming or outgoing transfer in a simulation."""
    transfer_type: TransferType
    player_name: str
    position: str
    age: int
    transfer_fee: float = Field(..., ge=0, description="Fee in EUR")
    annual_salary: float = Field(..., gt=0, description="Annual salary in EUR")
    contract_length_years: int = Field(..., ge=1, le=10)


class YearlyProjection(BaseModel):
    """Computed financial snapshot for one season."""
    year: int
    total_wage_bill: float
    amortization_cost: float
    revenue: float
    wage_to_revenue_ratio: float  # e.g. 0.65 = 65%
    net_transfer_spend: float
    ffp_status: str  # "SAFE" | "WARNING" | "HIGH_RISK"


class TransferSimulation(Document):
    club_id: str = Field(..., description="Reference to Club._id")
    simulation_name: str = Field(..., min_length=2, max_length=100)

    # Transfers being simulated
    transfers: list[TransferEntry] = Field(default_factory=list)

    # results
    projections: list[YearlyProjection] = Field(default_factory=list)

    total_incoming_fees: float = Field(default=0.0)
    total_outgoing_fees: float = Field(default=0.0)
    net_spend: float = Field(default=0.0)
    overall_ffp_status: str = Field(default="PENDING")  # SAFE | WARNING | HIGH_RISK

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transfer_simulations"
        indexes = [
            "club_id",
        ]