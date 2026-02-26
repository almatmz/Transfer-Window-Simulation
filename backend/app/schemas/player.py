from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime
from app.models.player import Position


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Erling Haaland"])
    age: int = Field(..., ge=15, le=45, examples=[23])
    nationality: str = Field(..., examples=["Norwegian"])
    position: Position = Field(..., examples=[Position.ST])
    annual_salary: float = Field(..., gt=0, examples=[20_800_000], description="Annual gross salary EUR")
    contract_length_years: int = Field(..., ge=0, le=10, examples=[4])
    contract_expiry_year: int = Field(..., examples=[2027])
    transfer_value: float = Field(..., ge=0, examples=[180_000_000])
    acquisition_fee: float = Field(default=0.0, ge=0, examples=[51_200_000])
    acquisition_year: int = Field(default=0, examples=[2022])


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=15, le=45)
    position: Optional[Position] = None
    annual_salary: Optional[float] = Field(None, gt=0)
    contract_length_years: Optional[int] = Field(None, ge=0, le=10)
    contract_expiry_year: Optional[int] = None
    transfer_value: Optional[float] = Field(None, ge=0)


class PlayerResponse(BaseModel):
    id: str
    club_id: str
    name: str
    age: int
    nationality: str
    position: Position
    annual_salary: float
    contract_length_years: int
    contract_expiry_year: int
    transfer_value: float
    acquisition_fee: float
    annual_amortization: float  # computed
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayerBulkUploadResponse(BaseModel):
    total_rows: int
    success_count: int
    error_count: int
    errors: list[dict]