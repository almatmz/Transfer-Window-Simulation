from beanie import Document, Link
from pydantic import Field
from typing import Optional
from datetime import datetime
from enum import Enum


class Position(str, Enum):
    GK = "GK"
    CB = "CB"
    LB = "LB"
    RB = "RB"
    CDM = "CDM"
    CM = "CM"
    CAM = "CAM"
    LW = "LW"
    RW = "RW"
    CF = "CF"
    ST = "ST"


class Player(Document):
    club_id: str = Field(..., description="Reference to Club._id")

    # Identity
    name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=15, le=45)
    nationality: str = Field(..., min_length=2, max_length=60)
    position: Position

    # Contract
    annual_salary: float = Field(..., gt=0, description="Annual gross salary in EUR")
    contract_length_years: int = Field(..., ge=0, le=10, description="Remaining contract years")
    contract_expiry_year: int = Field(..., description="Year contract expires")

    # Market
    transfer_value: float = Field(..., ge=0, description="Current market value in EUR")
    acquisition_fee: float = Field(default=0.0, ge=0, description="Fee paid to acquire player (for amortization)")
    acquisition_year: int = Field(default=0, description="Year player was acquired")

    # Status
    is_active: bool = Field(default=True)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        indexes = [
            "club_id",
            "position",
        ]