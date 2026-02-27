"""
Transfer Simulation Endpoints
==============================

WORKFLOW for a user:
  1. POST /simulations/                         → create empty simulation for a club + window
  2. POST /simulations/{id}/buys                → add a buy (search player name first)
  3. POST /simulations/{id}/sells               → add a sell (from your squad)
  4. POST /simulations/{id}/loans-in            → add loan in (from another club)
  5. POST /simulations/{id}/loans-out           → add loan out (your player to another club)
  6. DELETE /simulations/{id}/buys/{index}      → remove a transfer
  7. GET  /simulations/{id}                     → see full results + FFP projections
  8. GET  /simulations/{id}/summary             → quick view: net spend + FFP status

FINDING PLAYERS:
  - Your squad:        GET /clubs/{api_football_id}/squad
  - Other clubs:       GET /search/clubs?q=Barcelona  →  GET /search/clubs/{id}  →  GET /clubs/{id}/squad
  - Player details:    GET /players/{api_football_id}
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.schemas.transfer import (
    SimulationCreateRequest, SimulationResponse, SimulationSummary,
    AddBuyRequest, AddSellRequest, AddLoanInRequest, AddLoanOutRequest,
    UpdateSimulationMetaRequest,
)
from app.models.transfer import WindowType
from app.services import transfer_service
from app.core.deps import require_user
from app.models.user import User

router = APIRouter(prefix="/simulations", tags=["Transfer Simulations"])


# ── Create / List / Get ───────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=SimulationResponse,
    status_code=201,
    summary="Create a new simulation",
    description=(
        "Start a simulation for a club + transfer window. "
        "Add transfers one by one using the /buys, /sells, /loans-in, /loans-out endpoints below. "
        "FFP is recalculated every time you add or remove a transfer."
    ),
)
async def create_simulation(
    body: SimulationCreateRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.create_simulation(body, user)


@router.get(
    "/my",
    response_model=list[SimulationSummary],
    summary="List my simulations",
)
async def list_my(
    season: Optional[str] = Query(None, description="e.g. '2025/26'"),
    window_type: Optional[WindowType] = Query(None),
    user: User = Depends(require_user),
):
    return await transfer_service.list_my_simulations(user, season, window_type)


@router.get(
    "/{sim_id}",
    response_model=SimulationResponse,
    summary="Get full simulation — all transfers + FFP projections",
)
async def get_simulation(sim_id: str, user: User = Depends(require_user)):
    return await transfer_service.get_simulation(sim_id, user)


@router.patch(
    "/{sim_id}",
    response_model=SimulationResponse,
    summary="Rename simulation or change window/season",
)
async def update_meta(
    sim_id: str,
    body: UpdateSimulationMetaRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.update_meta(sim_id, body, user)


@router.delete("/{sim_id}", summary="Delete a simulation")
async def delete_simulation(sim_id: str, user: User = Depends(require_user)):
    return await transfer_service.delete_simulation(sim_id, user)


# ── BUY ───────────────────────────────────────────────────────────────────────

@router.post(
    "/{sim_id}/buys",
    response_model=SimulationResponse,
    summary="Add a player purchase",
    description="""
**Sign a new player.** Fee is amortized over the contract length. Full salary added to wage bill.

**To find a player from another club:**
1. `GET /api/v1/search/clubs?q=Barcelona` → get their `api_football_id`
2. `GET /api/v1/clubs/{id}/squad` → find the player, copy their `api_football_id`
3. Use that id as `api_football_player_id` here (optional but links to real data)

**Example — sign Vinicius Jr:**
```json
{
  "player_name": "Vinicius Jr",
  "position": "LW",
  "age": 24,
  "transfer_fee": 150000000,
  "annual_salary": 20000000,
  "contract_length_years": 5,
  "api_football_player_id": 276  
}
```
""",
)
async def add_buy(
    sim_id: str,
    body: AddBuyRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.add_buy(sim_id, body, user)


@router.delete(
    "/{sim_id}/buys/{index}",
    response_model=SimulationResponse,
    summary="Remove a buy by its list index (0-based)",
)
async def remove_buy(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "buys", index, user)


# ── SELL ──────────────────────────────────────────────────────────────────────

@router.post(
    "/{sim_id}/sells",
    response_model=SimulationResponse,
    summary="Add a player sale",
    description="""
**Sell one of your players.** Removes their wages and amortization from your books.

**Tip:** Get your squad from `GET /api/v1/clubs/{api_football_id}/squad`.
Set `api_football_player_id` so the engine auto-loads their real salary and book value.

**Example — sell Rashford:**
```json
{
  "player_name": "M. Rashford",
  "position": "LW",
  "transfer_fee": 40000000,
  "api_football_player_id": 35845
}
```
If `api_football_player_id` not set, provide `annual_salary` manually.
""",
)
async def add_sell(
    sim_id: str,
    body: AddSellRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.add_sell(sim_id, body, user)


@router.delete(
    "/{sim_id}/sells/{index}",
    response_model=SimulationResponse,
    summary="Remove a sell by index",
)
async def remove_sell(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "sells", index, user)


# ── LOAN IN ───────────────────────────────────────────────────────────────────

@router.post(
    "/{sim_id}/loans-in",
    response_model=SimulationResponse,
    summary="Add a loan-in (take a player on loan)",
    description="""
**Bring a player on loan from another club.**

`wage_contribution_pct` = the % of their salary **your club** pays.
The parent club pays the rest.

| Your % | Meaning |
|--------|---------|
| 100    | You pay everything (rare) |
| 50     | Split 50/50 (common) |
| 30     | You pay 30%, parent pays 70% |
| 0      | Parent pays everything (rare) |

**Example — loan Zirkzee from Man Utd, you pay 60%:**
```json
{
  "player_name": "J. Zirkzee",
  "position": "ST",
  "age": 23,
  "annual_salary": 5200000,
  "wage_contribution_pct": 60,
  "loan_fee": 3000000,
  "contract_length_years": 1,
  "has_option_to_buy": true,
  "option_to_buy_fee": 35000000,
  "option_to_buy_year": 1
}
```
""",
)
async def add_loan_in(
    sim_id: str,
    body: AddLoanInRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.add_loan_in(sim_id, body, user)


@router.delete(
    "/{sim_id}/loans-in/{index}",
    response_model=SimulationResponse,
    summary="Remove a loan-in by index",
)
async def remove_loan_in(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "loans_in", index, user)


# ── LOAN OUT ──────────────────────────────────────────────────────────────────

@router.post(
    "/{sim_id}/loans-out",
    response_model=SimulationResponse,
    summary="Add a loan-out (send your player on loan)",
    description="""
**Send one of your players out on loan.**

`wage_contribution_pct` = the % of their salary **your club** still pays.
The loan club pays the rest.

| Your % | FFP impact |
|--------|------------|
| 0      | Fully off your wage bill ✅ |
| 30     | Still paying 30% (partial relief) |
| 100    | No wage relief at all ❌ |

**Example — loan out Hannibal, fully off your books:**
```json
{
  "player_name": "Hannibal Mejbri",
  "position": "CM",
  "api_football_player_id": 278166,
  "loan_fee_received": 1000000,
  "wage_contribution_pct": 0
}
```
""",
)
async def add_loan_out(
    sim_id: str,
    body: AddLoanOutRequest,
    user: User = Depends(require_user),
):
    return await transfer_service.add_loan_out(sim_id, body, user)


@router.delete(
    "/{sim_id}/loans-out/{index}",
    response_model=SimulationResponse,
    summary="Remove a loan-out by index",
)
async def remove_loan_out(sim_id: str, index: int, user: User = Depends(require_user)):
    return await transfer_service.remove_transfer(sim_id, "loans_out", index, user)