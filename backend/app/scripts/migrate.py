import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate():
    import os
    from dotenv import load_dotenv
    load_dotenv()

    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "twsim")

    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    from app.models.user import User
    from app.models.club import Club
    from app.models.player import Player
    from app.models.player_contract import PlayerContract, ContractType, DataSource
    from app.models.transfer import TransferSimulation, SimulationTransfer, TransferType, WindowType

    await init_beanie(database=db, document_models=[
        User, Club, Player, PlayerContract, TransferSimulation, SimulationTransfer
    ])

    # Step 1: Migrate Player salary → PlayerContract 
    logger.info("Step 1: Migrating player salaries to PlayerContracts...")
    players_raw = await db["players"].find({}).to_list(length=None)
    contracts_created = 0
    for p_raw in players_raw:
        salary = p_raw.get("estimated_annual_salary", 0) or 0
        expiry = p_raw.get("contract_expiry_year", 0) or 0
        club_id = p_raw.get("club_id", "")
        if salary <= 0 or not club_id:
            continue

        # Check if contract already exists
        existing = await PlayerContract.find_one(
            PlayerContract.player_id == str(p_raw["_id"]),
            PlayerContract.club_id == club_id,
            PlayerContract.is_active == True,
        )
        if existing:
            continue

        season_year = 2025
        club = await Club.find_one(Club.id == club_id) if club_id else None
        if club:
            season_year = club.season_year or 2025

        contract = PlayerContract(
            player_id=str(p_raw["_id"]),
            club_id=club_id,
            player_name=p_raw.get("name", ""),
            player_api_id=p_raw.get("api_football_id", 0),
            contract_type=ContractType.PERMANENT,
            contract_start_year=season_year - 1,
            contract_expiry_year=expiry if expiry > season_year else season_year + 2,
            annual_salary=float(salary),
            acquisition_fee=0.0,
            acquisition_year=season_year - 1,
            data_source=DataSource.MIGRATED,
        )
        await contract.insert()
        contracts_created += 1

    logger.info(f"  Created {contracts_created} PlayerContracts")

    # ── Step 2: Migrate old simulations → SimulationTransfer documents ────────
    logger.info("Step 2: Migrating old simulations to unified SimulationTransfer...")
    sims_raw = await db["transfer_simulations"].find({}).to_list(length=None)
    transfers_created = 0

    for s_raw in sims_raw:
        sim_id = str(s_raw["_id"])

        # Check if already migrated
        existing_transfers = await SimulationTransfer.find(
            SimulationTransfer.simulation_id == sim_id
        ).to_list()
        if existing_transfers:
            continue

        # Find or fix club_id
        club_api_id = s_raw.get("club_api_football_id", 0)
        club = await Club.find_one(Club.api_football_id == club_api_id) if club_api_id else None
        if not club:
            continue

        # Upsert simulation with new structure
        existing_sim = await TransferSimulation.find_one(TransferSimulation.id == s_raw["_id"])
        if not existing_sim:
            sim = TransferSimulation(
                user_id=str(s_raw.get("user_id", "")),
                club_id=str(club.id),
                club_api_football_id=club_api_id,
                club_name=s_raw.get("club_name", ""),
                name=s_raw.get("simulation_name", "Migrated Simulation"),
                season_year=int(str(s_raw.get("season", "2025/26"))[:4]),
                window_type=WindowType(s_raw.get("window_type", "summer")),
            )
            await sim.insert()
            sim_id = str(sim.id)

        # Convert buys
        for b in s_raw.get("buys", []):
            t = SimulationTransfer(
                simulation_id=sim_id, type=TransferType.BUY,
                player_name=b.get("player_name", ""),
                position=b.get("position", "UNKNOWN"),
                age=b.get("age", 0),
                transfer_fee=float(b.get("transfer_fee", 0)),
                annual_salary=float(b.get("annual_salary", 0)),
                contract_length_years=int(b.get("contract_length_years", 1)),
            )
            await t.insert()
            transfers_created += 1

        # Convert sells
        for s in s_raw.get("sells", []):
            t = SimulationTransfer(
                simulation_id=sim_id, type=TransferType.SELL,
                player_name=s.get("player_name", ""),
                position=s.get("position", "UNKNOWN"),
                transfer_fee=float(s.get("transfer_fee", 0)),
                annual_salary=float(s.get("annual_salary", 0)),
                player_api_football_id=s.get("api_football_player_id"),
            )
            await t.insert()
            transfers_created += 1

        # Convert loans_in
        for li in s_raw.get("loans_in", []):
            t = SimulationTransfer(
                simulation_id=sim_id, type=TransferType.LOAN_IN,
                player_name=li.get("player_name", ""),
                position=li.get("position", "UNKNOWN"),
                annual_salary=float(li.get("annual_salary", 0)),
                loan_fee=float(li.get("loan_fee", 0)),
                loan_wage_contribution_pct=float(li.get("wage_contribution_pct", 50)),
                option_to_buy_enabled=li.get("has_option_to_buy", False),
                option_to_buy_fee=float(li.get("option_to_buy_fee", 0)),
            )
            await t.insert()
            transfers_created += 1

        # Convert loans_out
        for lo in s_raw.get("loans_out", []):
            t = SimulationTransfer(
                simulation_id=sim_id, type=TransferType.LOAN_OUT,
                player_name=lo.get("player_name", ""),
                position=lo.get("position", "UNKNOWN"),
                annual_salary=float(lo.get("annual_salary", 0)),
                loan_fee_received=float(lo.get("loan_fee_received", 0)),
                loan_wage_contribution_pct=float(lo.get("wage_contribution_pct", 0)),
            )
            await t.insert()
            transfers_created += 1

    logger.info(f"  Created {transfers_created} SimulationTransfer documents")
    logger.info("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())