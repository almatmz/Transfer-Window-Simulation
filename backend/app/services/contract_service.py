import logging
from datetime import datetime
from fastapi import HTTPException

from app.models.player_contract import PlayerContract, ContractType, DataSource
from app.models.player import Player
from app.models.club import Club
from app.utils.financial_engine import engine

logger = logging.getLogger(__name__)


async def get_active_contracts(club_id: str) -> list[PlayerContract]:
    return await PlayerContract.find(
        PlayerContract.club_id == club_id,
        PlayerContract.is_active == True,
    ).to_list()


async def get_player_contract(club_id: str, player_id: str) -> PlayerContract | None:
    return await PlayerContract.find_one(
        PlayerContract.club_id == club_id,
        PlayerContract.player_id == player_id,
        PlayerContract.contract_type == ContractType.PERMANENT,
        PlayerContract.is_active == True,
    )


async def create_contract(
    player: Player,
    club: Club,
    annual_salary: float,
    contract_start_year: int,
    contract_expiry_year: int,
    acquisition_fee: float = 0.0,
    acquisition_year: int | None = None,
    data_source: DataSource = DataSource.OVERRIDE,
    contract_type: ContractType = ContractType.PERMANENT,
    parent_club_id: str | None = None,
    loan_fee: float = 0.0,
    loan_wage_contribution_pct: float = 50.0,
    option_to_buy_enabled: bool = False,
    option_to_buy_fee: float = 0.0,
) -> PlayerContract:
    """Create a new contract. Enforces one active permanent per player per club."""
    # Check for duplicate permanent contract
    if contract_type == ContractType.PERMANENT:
        existing = await get_player_contract(str(club.id), str(player.id))
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"{player.name} already has an active permanent contract at {club.name}. "
                       f"Terminate it first or use PATCH to extend."
            )

    if contract_type == ContractType.LOAN and not parent_club_id:
        raise HTTPException(status_code=422, detail="Loan contracts require parent_club_id.")

    contract = PlayerContract(
        player_id=str(player.id),
        club_id=str(club.id),
        player_name=player.name,
        player_api_id=player.api_football_id,
        contract_type=contract_type,
        contract_start_year=contract_start_year,
        contract_expiry_year=contract_expiry_year,
        annual_salary=annual_salary,
        acquisition_fee=acquisition_fee,
        acquisition_year=acquisition_year or contract_start_year,
        parent_club_id=parent_club_id,
        loan_fee=loan_fee,
        loan_wage_contribution_pct=loan_wage_contribution_pct,
        option_to_buy_enabled=option_to_buy_enabled,
        option_to_buy_fee=option_to_buy_fee,
        data_source=data_source,
    )
    await contract.insert()
    logger.info(f"Created {contract_type} contract: {player.name} @ {club.name} "
                f"salary=€{annual_salary/1e6:.2f}M fee=€{acquisition_fee/1e6:.2f}M")
    return contract


async def extend_contract(
    contract: PlayerContract,
    new_expiry_year: int,
    new_annual_salary: float,
    current_season: int,
) -> PlayerContract:
    """
    Contract extension — do NOT create new contract.
    Recalculate amortization: remaining_book_value / new_total_years_remaining.
    """
    if new_expiry_year <= current_season:
        raise HTTPException(status_code=422, detail="New expiry year must be in the future.")

    remaining_bv = contract.get_remaining_book_value(current_season)
    new_years = new_expiry_year - current_season
    new_amort = engine.recalculate_amortization_after_extension(remaining_bv, new_years)

    await contract.set({
        "contract_expiry_year": new_expiry_year,
        "annual_salary": new_annual_salary,
        "amortization_per_year": new_amort,
        "remaining_book_value": remaining_bv,
        "updated_at": datetime.utcnow(),
    })
    logger.info(f"Extended contract: {contract.player_name} → {new_expiry_year}, "
                f"new amort=€{new_amort/1e6:.2f}M/yr")
    return contract


async def terminate_contract(contract: PlayerContract, reason: str = "sold") -> PlayerContract:
    await contract.set({
        "is_active": False,
        "terminated_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    logger.info(f"Terminated contract: {contract.player_name} ({reason})")
    return contract


async def execute_option_to_buy(
    loan_contract: PlayerContract,
    club: Club,
    current_season: int,
) -> PlayerContract:
    """
    Trigger option-to-buy:
    1. Terminate loan contract
    2. Create new permanent contract with option_fee as acquisition_fee
    """
    if not loan_contract.option_to_buy_enabled or loan_contract.option_to_buy_fee <= 0:
        raise HTTPException(status_code=422, detail="No option to buy on this loan contract.")

    # Terminate loan
    await terminate_contract(loan_contract, reason="option_to_buy_triggered")

    # Find the player
    player = await Player.get(loan_contract.player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")

    # Create permanent contract
    return await create_contract(
        player=player,
        club=club,
        annual_salary=loan_contract.annual_salary,
        contract_start_year=current_season,
        contract_expiry_year=current_season + 4,  # default 4-year deal, SD can adjust
        acquisition_fee=loan_contract.option_to_buy_fee,
        acquisition_year=current_season,
        data_source=DataSource.OVERRIDE,
        contract_type=ContractType.PERMANENT,
    )