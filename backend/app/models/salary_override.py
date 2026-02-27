from beanie import Document
from pydantic import Field
from datetime import datetime


class SalaryOverride(Document):
    """
    Private, accurate salary data entered by Sport Directors.

    - NEVER returned to regular users or anonymous users.
    - Only the sport director who set it (or admins) can read/update it.
    - When a sport director runs an FFP simulation, this value is used
      instead of the Capology estimate.
    - One record per player. Updating creates a new version in history.
    """
    player_id: str = Field(..., description="Reference to Player._id")
    club_id: str = Field(..., description="Reference to Club._id")
    set_by_user_id: str = Field(..., description="User._id of the sport director")


    annual_salary: float = Field(..., gt=0, description="Annual gross salary EUR")
    contract_length_years: int = Field(..., ge=1, le=10)
    contract_expiry_year: int
    acquisition_fee: float = Field(default=0.0, ge=0)
    acquisition_year: int = Field(default=0)


    notes: str = ""                   
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "salary_overrides"
        indexes = ["player_id", "club_id", "set_by_user_id"]