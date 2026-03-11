from fastapi import APIRouter, Depends, Query
from typing import Optional
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