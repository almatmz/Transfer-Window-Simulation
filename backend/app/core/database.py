from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.club import Club
from app.models.player import Player
from app.models.transfer import TransferSimulation


async def init_db() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[Club, Player, TransferSimulation],
    )


async def close_db(client: AsyncIOMotorClient) -> None:
    client.close()