from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional
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
    UNKNOWN = "UNKNOWN"


class Player(Document):
    api_football_id: int = Field(..., description="API-Football player ID")
    club_id: str = Field(..., description="Reference to Club._id")
    api_football_club_id: int

    name: str
    first_name: str = ""
    last_name: str = ""
    age: int = 0
    nationality: str = ""
    position: Position = Position.UNKNOWN
    photo_url: str = ""

    transfer_value: float = 0.0                  # current market value (€)
    transfer_value_currency: str = "EUR"
    transfer_value_updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Transfer fee paid when club acquired this player (for amortization)
    acquisition_fee: float = 0.0
    acquisition_year: int = 0                    # calendar year of signing
    contract_signing_date: Optional[date] = None # exact signing date
    contract_expiry_year: int = 0
    contract_length_years: int = 0               # total length at signing

    estimated_annual_salary: float = 0.0
    # capology_estimate | position_estimate | groq_estimate | sd_override
    salary_source: str = "position_estimate"

    # When a player is sold, we mark them sold so amortization stops and
    # book profit/loss is calculated for that season.
    is_sold: bool = False
    sold_for: float = 0.0                        # transfer fee received
    sold_in_year: int = 0                        # calendar year of sale

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        indexes = ["api_football_id", "club_id", "is_sold"]