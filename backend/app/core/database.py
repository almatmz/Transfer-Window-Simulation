from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User
from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.squad_override import SquadOverride
from app.models.loan_deal import LoanDeal
from app.models.contract_extension import ContractExtension
from app.models.transfer import TransferSimulation
from app.models.user_revenue_override import UserRevenueOverride


async def init_db() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DATABASE_NAME],
        document_models=[
            User,
            Club,
            Player,
            PlayerOverride,
            SquadOverride,
            LoanDeal,
            ContractExtension,
            TransferSimulation,
            UserRevenueOverride,
        ],
    )