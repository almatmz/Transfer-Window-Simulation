from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.transfer import TransferType, TransferEntry, YearlyProjection


class TransferEntryInput(BaseModel):
    transfer_type: TransferType
    player_name: str = Field(..., examples=["Kylian Mbappé"])
    position: str = Field(..., examples=["LW"])
    age: int = Field(..., ge=15, le=45, examples=[25])
    transfer_fee: float = Field(..., ge=0, examples=[100_000_000])
    annual_salary: float = Field(..., gt=0, examples=[25_000_000])
    contract_length_years: int = Field(..., ge=1, le=10, examples=[5])


class SimulationCreate(BaseModel):
    club_id: str
    simulation_name: str = Field(..., min_length=2, max_length=100, examples=["Summer 2025 Window"])
    transfers: list[TransferEntryInput] = Field(..., min_length=1)


class SimulationUpdate(BaseModel):
    simulation_name: Optional[str] = None
    transfers: Optional[list[TransferEntryInput]] = None


class SimulationResponse(BaseModel):
    id: str
    club_id: str
    simulation_name: str
    transfers: list[TransferEntry]
    projections: list[YearlyProjection]
    total_incoming_fees: float
    total_outgoing_fees: float
    net_spend: float
    overall_ffp_status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}