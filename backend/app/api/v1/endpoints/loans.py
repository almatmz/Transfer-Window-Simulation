from fastapi import APIRouter, Depends
from typing import Literal

from app.schemas.loan_deal import (
    LoanDealRequest,
    LoanDealResponse,
    ExerciseOptionRequest,
)
from app.services import loan_deal_service
from app.core.deps import require_sport_director
from app.models.user import User

router = APIRouter(prefix="/players", tags=["Loan Deals"])


@router.put(
    "/{api_football_id}/loan",
    response_model=LoanDealResponse,
    summary="Set a loan deal — Sport Directors / Admins only",
    description="""
Create or update a loan deal for a player.

**`loan_direction`:**
- `"in"` — your club is **receiving** this player on loan from another club
- `"out"` — your club is **sending** this player out on loan to another club

**Option to buy fields** (`has_option_to_buy: true`):
- `option_to_buy_fee` — fixed price to make the transfer permanent
- `option_is_obligation` — `true` = must buy at end of loan, `false` = optional
- `option_contract_years` — contract length if option exercised
- `option_annual_salary` — salary after permanent signing (may differ from loan salary)

**Admin deal** → updates player data globally, visible to everyone.  
**SD deal** → private, affects only your FFP simulation.
""",
)
async def set_loan_deal(
    api_football_id: int,
    body: LoanDealRequest,
    user: User = Depends(require_sport_director),
):
    return await loan_deal_service.set_loan_deal(api_football_id, body, user)


@router.get(
    "/{api_football_id}/loan",
    summary="Get loan deals for a player — Sport Directors / Admins only",
    description="""
Returns all loan deals visible to you:
- **Admin** sees admin deals + all SD deals
- **SD** sees admin deals + their own SD deal
""",
)
async def get_loan_deals(
    api_football_id: int,
    user: User = Depends(require_sport_director),
):
    return await loan_deal_service.get_loan_deals(api_football_id, user)


@router.delete(
    "/{api_football_id}/loan/{direction}",
    summary="Delete a loan deal — removes your deal for this direction",
    description="""
- **Admin** deletes → removes admin deal, player loan flags cleared
- **SD** deletes → removes your private deal only
""",
)
async def delete_loan_deal(
    api_football_id: int,
    direction: Literal["in", "out"],
    user: User = Depends(require_sport_director),
):
    return await loan_deal_service.delete_loan_deal(api_football_id, direction, user)


@router.post(
    "/{api_football_id}/loan/{direction}/exercise-option",
    response_model=LoanDealResponse,
    summary="Exercise the option to buy on a loan deal",
    description="""
Marks the option to buy as exercised.

- **loan_in** option exercised → player becomes a permanent signing at `option_to_buy_fee`
- **loan_out** option exercised → player is sold to the receiving club (`is_sold = true`)

Admin exercising the option updates the player document for everyone.
""",
)
async def exercise_option(
    api_football_id: int,
    direction: Literal["in", "out"],
    body: ExerciseOptionRequest,
    user: User = Depends(require_sport_director),
):
    return await loan_deal_service.exercise_option(api_football_id, direction, body, user)