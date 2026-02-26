from fastapi import APIRouter
from app.schemas.transfer import SimulationCreate, SimulationUpdate, SimulationResponse
from app.services import transfer_service

router = APIRouter(prefix="/simulations", tags=["Transfer Simulations"])


@router.post(
    "/",
    response_model=SimulationResponse,
    status_code=201,
    summary="Create transfer window simulation",
    description=(
        "Define a set of incoming/outgoing transfers. "
        "The engine auto-calculates amortization, net spend, wage ratios, "
        "and 3-year FFP projections."
    ),
)
async def create_simulation(body: SimulationCreate):
    return await transfer_service.create_simulation(body)


@router.get(
    "/club/{club_id}",
    response_model=list[SimulationResponse],
    summary="List all simulations for a club",
)
async def list_simulations(club_id: str):
    return await transfer_service.list_simulations(club_id)


@router.get(
    "/{simulation_id}",
    response_model=SimulationResponse,
    summary="Get simulation details",
)
async def get_simulation(simulation_id: str):
    return await transfer_service.get_simulation(simulation_id)


@router.patch(
    "/{simulation_id}",
    response_model=SimulationResponse,
    summary="Update simulation transfers and recompute",
)
async def update_simulation(simulation_id: str, body: SimulationUpdate):
    return await transfer_service.update_simulation(simulation_id, body)


@router.delete("/{simulation_id}", summary="Delete a simulation")
async def delete_simulation(simulation_id: str):
    return await transfer_service.delete_simulation(simulation_id)