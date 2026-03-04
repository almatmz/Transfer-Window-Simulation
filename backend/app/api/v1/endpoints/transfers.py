from fastapi import APIRouter, Depends
from app.schemas.transfer import (
    CreateSimulationRequest, AddTransferRequest,
    SimulationResponse, SimulationTransferResponse
)
from app.services import transfer_service
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/simulations", tags=["Simulations"])


@router.post("", response_model=SimulationResponse,
    summary="Create new simulation")
async def create_simulation(body: CreateSimulationRequest, user: User = Depends(get_current_user)):
    sim = await transfer_service.create_simulation(
        user_id=str(user.id),
        club_api_football_id=body.club_api_football_id,
        name=body.name,
        season_year=body.season_year,
        window_type=body.window_type.value,
    )
    transfers = await transfer_service.get_simulation_transfers(str(sim.id))
    return _to_response(sim, transfers)


@router.get("/{sim_id}", response_model=SimulationResponse,
    summary="Get simulation with all transfers")
async def get_simulation(sim_id: str, user: User = Depends(get_current_user)):
    sim = await transfer_service.get_simulation(sim_id, str(user.id))
    transfers = await transfer_service.get_simulation_transfers(sim_id)
    return _to_response(sim, transfers)


@router.delete("/{sim_id}", status_code=204,
    summary="Delete simulation and all its transfers")
async def delete_simulation(sim_id: str, user: User = Depends(get_current_user)):
    await transfer_service.delete_simulation(sim_id, str(user.id))


@router.post("/{sim_id}/transfers", response_model=SimulationTransferResponse,
    summary="Add transfer to simulation",
    description="""
Add any transfer type using the unified endpoint:

| type | Required fields |
|------|----------------|
| `buy` | player_name, annual_salary, contract_length_years. transfer_fee=0 for free transfer |
| `sell` | player_name, transfer_fee. Salary auto-loaded if player_api_football_id given |
| `loan_in` | player_name, annual_salary, loan_wage_contribution_pct (% your club pays) |
| `loan_out` | player_name, loan_wage_contribution_pct (% your club still pays) |
""")
async def add_transfer(
    sim_id: str,
    body: AddTransferRequest,
    user: User = Depends(get_current_user),
):
    entry = await transfer_service.add_transfer(
        sim_id=sim_id,
        user_id=str(user.id),
        transfer_type=body.type.value,
        player_name=body.player_name,
        position=body.position,
        age=body.age,
        nationality=body.nationality,
        transfer_fee=body.transfer_fee,
        annual_salary=body.annual_salary,
        contract_length_years=body.contract_length_years,
        loan_fee=body.loan_fee,
        loan_fee_received=body.loan_fee_received,
        loan_wage_contribution_pct=body.loan_wage_contribution_pct,
        option_to_buy_enabled=body.option_to_buy_enabled,
        option_to_buy_fee=body.option_to_buy_fee,
        player_api_football_id=body.player_api_football_id,
    )
    return _transfer_to_response(entry)


@router.delete("/{sim_id}/transfers/{transfer_id}", status_code=204,
    summary="Remove a transfer entry from simulation")
async def remove_transfer(sim_id: str, transfer_id: str, user: User = Depends(get_current_user)):
    await transfer_service.remove_transfer(sim_id, transfer_id, str(user.id))


def _transfer_to_response(t) -> SimulationTransferResponse:
    return SimulationTransferResponse(
        id=str(t.id), simulation_id=t.simulation_id,
        type=t.type.value, player_name=t.player_name,
        position=t.position, age=t.age,
        transfer_fee=t.transfer_fee, annual_salary=t.annual_salary,
        contract_length_years=t.contract_length_years,
        loan_fee=t.loan_fee, loan_fee_received=t.loan_fee_received,
        loan_wage_contribution_pct=t.loan_wage_contribution_pct,
        option_to_buy_enabled=t.option_to_buy_enabled,
        option_to_buy_fee=t.option_to_buy_fee,
        created_at=t.created_at,
    )


def _to_response(sim, transfers) -> SimulationResponse:
    return SimulationResponse(
        id=str(sim.id), club_name=sim.club_name,
        club_api_football_id=sim.club_api_football_id,
        name=sim.name, season_year=sim.season_year,
        window_type=sim.window_type.value,
        transfers=[_transfer_to_response(t) for t in transfers],
        is_public=sim.is_public,
        created_at=sim.created_at, updated_at=sim.updated_at,
    )