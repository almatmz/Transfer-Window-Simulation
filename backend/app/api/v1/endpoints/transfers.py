from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.deps import get_current_user
from app.schemas.transfer import (
    SimulationCreateRequest, SimulationResponse, SimulationSummary,
    AddBuyRequest, AddSellRequest, AddLoanInRequest, AddLoanOutRequest,
    UpdateBuyRequest, UpdateSellRequest, UpdateLoanInRequest, UpdateLoanOutRequest,
    UpdateSimulationMetaRequest,
)
from app.models.transfer import WindowType
from app.services import transfer_service
from app.core.deps import require_user
from app.models.user import User

router = APIRouter(prefix="/simulations", tags=["Transfer Simulations"])


# Create / List / Get / Meta 

@router.post("/", response_model=SimulationResponse, status_code=201, summary="Create a new simulation")
async def create_simulation(body: SimulationCreateRequest, user: User = Depends(require_user)):
    return await transfer_service.create_simulation(body, user)


@router.get("/my", response_model=list[SimulationSummary], summary="List my simulations")
async def list_my(
    season: Optional[str] = Query(None),
    window_type: Optional[WindowType] = Query(None),
    user: User = Depends(require_user),
):
    return await transfer_service.list_my_simulations(user, season, window_type)


@router.get("/{sim_id}", response_model=SimulationResponse, summary="Get full simulation")
async def get_simulation(sim_id: str, user: User = Depends(require_user)):
    return await transfer_service.get_simulation(sim_id, user)


@router.patch("/{sim_id}", response_model=SimulationResponse, summary="Rename simulation or change window/season")
async def update_meta(sim_id: str, body: UpdateSimulationMetaRequest, user: User = Depends(require_user)):
    return await transfer_service.update_meta(sim_id, body, user)


@router.delete("/{sim_id}", summary="Delete a simulation")
async def delete_simulation(sim_id: str, user: User = Depends(require_user)):
    return await transfer_service.delete_simulation(sim_id, user)


# BUY 

@router.post("/{sim_id}/buys", response_model=SimulationResponse, summary="Add a player purchase")
async def add_buy(sim_id: str, body: AddBuyRequest, user: User = Depends(require_user)):
    return await transfer_service.add_buy(sim_id, body, user)


@router.patch("/{sim_id}/buys/{index}", response_model=SimulationResponse, summary="Edit a buy by index (0-based)")
async def update_buy(sim_id: str, index: int, body: UpdateBuyRequest, user: User = Depends(require_user)):
    return await transfer_service.update_transfer(sim_id, "buys", index, body, user)


@router.delete("/{sim_id}/buys/{index}", response_model=SimulationResponse, summary="Remove a buy by index (0-based)")
async def remove_buy(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "buys", index, user)


# SELL 

@router.post("/{sim_id}/sells", response_model=SimulationResponse, summary="Add a player sale")
async def add_sell(sim_id: str, body: AddSellRequest, user: User = Depends(require_user)):
    return await transfer_service.add_sell(sim_id, body, user)


@router.patch("/{sim_id}/sells/{index}", response_model=SimulationResponse, summary="Edit a sell by index (0-based)")
async def update_sell(sim_id: str, index: int, body: UpdateSellRequest, user: User = Depends(require_user)):
    return await transfer_service.update_transfer(sim_id, "sells", index, body, user)


@router.delete("/{sim_id}/sells/{index}", response_model=SimulationResponse, summary="Remove a sell by index (0-based)")
async def remove_sell(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "sells", index, user)


# LOAN IN 

@router.post("/{sim_id}/loans-in", response_model=SimulationResponse, summary="Add a loan-in")
async def add_loan_in(sim_id: str, body: AddLoanInRequest, user: User = Depends(require_user)):
    return await transfer_service.add_loan_in(sim_id, body, user)


@router.patch("/{sim_id}/loans-in/{index}", response_model=SimulationResponse, summary="Edit a loan-in by index (0-based)")
async def update_loan_in(sim_id: str, index: int, body: UpdateLoanInRequest, user: User = Depends(require_user)):
    return await transfer_service.update_transfer(sim_id, "loans_in", index, body, user)


@router.delete("/{sim_id}/loans-in/{index}", response_model=SimulationResponse, summary="Remove a loan-in by index (0-based)")
async def remove_loan_in(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "loans_in", index, user)


#  LOAN OUT 

@router.post("/{sim_id}/loans-out", response_model=SimulationResponse, summary="Add a loan-out")
async def add_loan_out(sim_id: str, body: AddLoanOutRequest, user: User = Depends(require_user)):
    return await transfer_service.add_loan_out(sim_id, body, user)


@router.patch("/{sim_id}/loans-out/{index}", response_model=SimulationResponse, summary="Edit a loan-out by index (0-based)")
async def update_loan_out(sim_id: str, index: int, body: UpdateLoanOutRequest, user: User = Depends(require_user)):
    return await transfer_service.update_transfer(sim_id, "loans_out", index, body, user)


@router.delete("/{sim_id}/loans-out/{index}", response_model=SimulationResponse, summary="Remove a loan-out by index (0-based)")
async def remove_loan_out(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "loans_out", index, user)


@router.get(
    "/simulations/{sim_id}/squad",
    summary="Get simulated squad with all transfers applied",
    description="""
Returns the projected squad for this simulation's target season.
 
**Three endpoints — three views:**
 
| Endpoint | What you see |
|----------|-------------|
| `GET /clubs/{id}/squad` | Real squad, no simulation |
| `GET /squad-overrides/clubs/{id}/effective` | Real squad + admin/SD overrides |
| `GET /transfers/simulations/{id}/squad` | ← **This endpoint**: overridden squad + your transfers |
 
**Every player has a `sim_status` field:**
- `null` — unaffected squad member
- `"sold"` — sold in this simulation (shown with sale fee)
- `"loaned_out"` — loaned out (shown with wage contribution %)
- `"bought"` — purchased in this simulation (shown with transfer fee)
- `"loan_in"` — loaned in (shown with loan fee and wage cost)
 
Sold and loaned-out players are **included** in the response so the frontend
can display them with visual markers — they are already excluded from
FFP calculations in the simulation engine.
 
**Auth:** Only the simulation owner can access their private simulations.
Public simulations are visible to everyone.
""",
)
async def get_simulation_squad(
    sim_id: str,
    viewer: User = Depends(get_current_user),
):
    return await transfer_service.get_simulation_squad_projection(sim_id, viewer)
 