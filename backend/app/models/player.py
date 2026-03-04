from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum


class Position(str, Enum):
    GK = "GK"; CB = "CB"; LB = "LB"; RB = "RB"
    CDM = "CDM"; CM = "CM"; CAM = "CAM"
    LW = "LW"; RW = "RW"; CF = "CF"; ST = "ST"
    UNKNOWN = "UNKNOWN"


class Player(Document):
    api_football_id: int = Field(..., description="API-Football player ID")
    name: str
    age: int = 0
    position: Position = Position.UNKNOWN
    nationality: str = ""
    photo_url: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        indexes = ["api_football_id"]