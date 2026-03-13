from fastapi import APIRouter, Depends

from app.schemas.contract_extension import (
    ContractExtensionRequest,
    ContractExtensionResponse,
)
from app.services import contract_extension_service
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/players", tags=["Contract Extensions"])


@router.put(
    "/{api_football_id}/contract-extension",
    response_model=ContractExtensionResponse,
    summary="Propose a contract extension — any authenticated user",
    description="""
Propose a contract extension for a player.

**Admin** → updates player document globally, visible to everyone in the squad.

**Sport Director** → private. Affects only your FFP simulations.

**Regular user** → private proposal. Affects only your own FFP view.
Useful for personal "what if we renew X?" scenarios.

A signing bonus can be added — it is amortized over the new contract length for FFP.
""",
)
async def set_contract_extension(
    api_football_id: int,
    body: ContractExtensionRequest,
    user: User = Depends(get_current_user),
):
    return await contract_extension_service.set_contract_extension(
        api_football_id, body, user
    )


@router.get(
    "/{api_football_id}/contract-extension",
    summary="Get contract extensions for a player",
    description="""
Returns contract extension data visible to you.
- **Admin** → sees all extensions from all users
- **SD** → sees admin extension + their own
- **User** → sees admin extension (read-only) + their own proposal
""",
)
async def get_contract_extension(
    api_football_id: int,
    user: User = Depends(get_current_user),
):
    return await contract_extension_service.get_contract_extension(api_football_id, user)


@router.delete(
    "/{api_football_id}/contract-extension",
    summary="Delete your contract extension proposal",
    description="""
- **Admin** deletes → reverts player contract to original DB values
- **SD** deletes → removes your private SD extension
- **User** deletes → removes your own personal proposal
""",
)
async def delete_contract_extension(
    api_football_id: int,
    user: User = Depends(get_current_user),
):
    return await contract_extension_service.delete_contract_extension(
        api_football_id, user
    )