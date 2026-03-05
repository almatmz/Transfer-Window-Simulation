"""
Transfer simulation service — unified entry management.
"""
import logging
from datetime import datetime
from fastapi import HTTPException
from beanie import PydanticObjectId

from app.models.transfer import TransferSimulation, SimulationTransfer, TransferType, WindowType
from app.models.club import Club
from app.models.player import Player
from app.models.player_contract import PlayerContract

logger = logging.getLogger(__name__)


async def create_simulation(
    user_id: str,
    club_api_football_id: int,
    name: str,
    season_year: int = 2025,
    window_type: str = "summer",
) -> TransferSimulation:
    club = await Club.find_one(Club.api_football_id == club_api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail=f"Club {club_api_football_id} not found.")

    sim = TransferSimulation(
        user_id=user_id,
        club_id=str(club.id),
        club_api_football_id=club_api_football_id,
        club_name=club.name,
        name=name,
        season_year=season_year,
        window_type=WindowType(window_type),
    )
    await sim.insert()
    return sim


async def get_simulation(sim_id: str, user_id: str) -> TransferSimulation:
    try:
        sim = await TransferSimulation.get(PydanticObjectId(sim_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Simulation not found.")
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found.")
    if sim.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your simulation.")
    return sim


async def get_simulation_transfers(sim_id: str) -> list[SimulationTransfer]:
    return await SimulationTransfer.find(
        SimulationTransfer.simulation_id == sim_id
    ).to_list()


async def add_transfer(
    sim_id: str,
    user_id: str,
    transfer_type: str,
    player_name: str,
    position: str = "UNKNOWN",
    age: int = 0,
    nationality: str = "",
    transfer_fee: float = 0.0,
    annual_salary: float = 0.0,
    contract_length_years: int = 1,
    loan_fee: float = 0.0,
    loan_fee_received: float = 0.0,
    loan_wage_contribution_pct: float = 50.0,
    option_to_buy_enabled: bool = False,
    option_to_buy_fee: float = 0.0,
    player_api_football_id: int | None = None,
) -> SimulationTransfer:
    sim = await get_simulation(sim_id, user_id)

    t_type = TransferType(transfer_type)

    # Validation per type
    if t_type == TransferType.BUY:
        if annual_salary <= 0:
            raise HTTPException(status_code=422, detail="BUY requires annual_salary > 0.")
        if contract_length_years < 1:
            raise HTTPException(status_code=422, detail="BUY requires contract_length_years >= 1.")

    if t_type == TransferType.LOAN_IN:
        if annual_salary <= 0:
            raise HTTPException(status_code=422, detail="LOAN_IN requires annual_salary > 0.")

    # Resolve player_id from squad if api_football_id given
    player_id = None
    if player_api_football_id:
        player = await Player.find_one(Player.api_football_id == player_api_football_id)
        if player:
            player_id = str(player.id)
            player_name = player_name or player.name
            position = position or player.position.value

    entry = SimulationTransfer(
        simulation_id=sim_id,
        type=t_type,
        player_id=player_id,
        player_api_football_id=player_api_football_id,
        player_name=player_name,
        position=position,
        age=age,
        nationality=nationality,
        transfer_fee=transfer_fee,
        annual_salary=annual_salary,
        contract_length_years=contract_length_years,
        loan_fee=loan_fee,
        loan_fee_received=loan_fee_received,
        loan_wage_contribution_pct=loan_wage_contribution_pct,
        option_to_buy_enabled=option_to_buy_enabled,
        option_to_buy_fee=option_to_buy_fee,
    )
    await entry.insert()
    await sim.set({"updated_at": datetime.utcnow()})
    logger.info(f"Added {t_type} transfer: {player_name} to sim '{sim.name}'")
    return entry


async def remove_transfer(sim_id: str, transfer_id: str, user_id: str) -> None:
    sim = await get_simulation(sim_id, user_id)
    try:
        entry = await SimulationTransfer.get(PydanticObjectId(transfer_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Transfer entry not found.")
    if entry.simulation_id != sim_id:
        raise HTTPException(status_code=400, detail="Transfer does not belong to this simulation.")
    await entry.delete()
    await sim.set({"updated_at": datetime.utcnow()})


async def delete_simulation(sim_id: str, user_id: str) -> None:
    sim = await get_simulation(sim_id, user_id)
    # Delete all transfers first
    await SimulationTransfer.find(SimulationTransfer.simulation_id == sim_id).delete()
    await sim.delete()


async def list_user_simulations(user_id: str) -> list[TransferSimulation]:
    """Get all simulations belonging to a user."""
    return await TransferSimulation.find(
        TransferSimulation.user_id == user_id
    ).sort(-TransferSimulation.updated_at).to_list()


async def list_user_simulations(user_id: str) -> list[TransferSimulation]:
    return await TransferSimulation.find(
        TransferSimulation.user_id == user_id
    ).sort(-TransferSimulation.updated_at).to_list()