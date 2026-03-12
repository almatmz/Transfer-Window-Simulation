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
    full_name: str = ""
    first_name: str = ""
    last_name: str = ""
    date_of_birth: Optional[date] = None
    age: int = 0
    nationality: str = ""
    second_nationality: str = ""
    position: Position = Position.UNKNOWN
    photo_url: str = ""

    # ── Market value from Transfermarkt (Apify)
    transfer_value: float = 0.0
    transfer_value_currency: str = "EUR"
    transfer_value_updated_at: datetime = Field(default_factory=datetime.utcnow)

    # ── Contract data — sourced from Transfermarkt (Apify) preferred, API-Football fallback
    acquisition_fee: float = 0.0
    acquisition_year: int = 0
    contract_signing_date: Optional[date] = None
    contract_expiry_year: int = 0
    contract_expiry_date: Optional[date] = None    # exact date from Transfermarkt
    contract_length_years: int = 0

    # ── Loan status — detected from Transfermarkt transferHistory
    is_on_loan: bool = False
    loan_from_club: Optional[str] = None           # parent club name
    loan_from_club_id: Optional[str] = None        # Transfermarkt club ID
    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_fee: Optional[float] = None

    # ── Transfermarkt identifiers
    transfermarkt_url: Optional[str] = None
    transfermarkt_id: Optional[str] = None
    transfermarkt_synced_at: Optional[str] = None  # ISO string from Apify scrapedAt

    estimated_annual_salary: float = 0.0
    # capology_estimate | position_estimate | groq_estimate | sd_override | apify_estimate
    salary_source: str = "position_estimate"

    is_sold: bool = False
    sold_for: float = 0.0
    sold_in_year: int = 0

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        indexes = [
            "api_football_id",
            "club_id",
            "is_sold",
            "transfermarkt_id",
            "is_on_loan",
        ]