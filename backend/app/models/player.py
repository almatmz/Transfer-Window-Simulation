from beanie import Document
from pydantic import Field
from datetime import datetime
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


    transfer_value: float = 0.0
    transfer_value_currency: str = "EUR"
    transfer_value_updated_at: datetime = Field(default_factory=datetime.utcnow)

    estimated_annual_salary: float = 0.0
    salary_source: str = "capology_estimate"   

    contract_expiry_year: int = 0
    contract_length_years: int = 0

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        indexes = ["api_football_id", "club_id"]