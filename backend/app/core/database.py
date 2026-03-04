from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User
from app.models.club import Club
from app.models.player import Player
from app.models.player_contract import PlayerContract
from app.models.transfer import TransferSimulation, SimulationTransfer


async def init_db() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[
            User, Club, Player, PlayerContract,
            TransferSimulation, SimulationTransfer,
        ],
    )