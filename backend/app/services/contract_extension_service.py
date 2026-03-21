from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from app.models.contract_extension import ContractExtension
from app.models.player import Player
from app.models.user import User
from app.schemas.contract_extension import (
    ContractExtensionRequest,
    ContractExtensionResponse,
)



async def _find_player(api_football_id: int) -> Player:
    player = await Player.find_one(Player.api_football_id == api_football_id)
    if not player:
        raise HTTPException(
            status_code=404,
            detail=f"Player {api_football_id} not found. Load their club squad first.",
        )
    return player


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


async def _get_admin_extension(player_id: str) -> Optional[ContractExtension]:
    return await ContractExtension.find_one(
        ContractExtension.player_id == player_id,
        ContractExtension.set_by_role == "admin",
    )


async def _get_sd_extension(player_id: str, user_id: str) -> Optional[ContractExtension]:
    return await ContractExtension.find_one(
        ContractExtension.player_id == player_id,
        ContractExtension.set_by_user_id == user_id,
        ContractExtension.set_by_role == "sport_director",
    )


async def _get_user_extension(player_id: str, user_id: str) -> Optional[ContractExtension]:
    """Regular user's own private extension proposal."""
    return await ContractExtension.find_one(
        ContractExtension.player_id == player_id,
        ContractExtension.set_by_user_id == user_id,
        ContractExtension.set_by_role == "user",
    )


def _serialize(ext: ContractExtension, player_name: str) -> ContractExtensionResponse:
    return ContractExtensionResponse(
        id=str(ext.id),
        player_id=ext.player_id,
        player_name=player_name,
        club_id=ext.club_id,
        set_by_role=ext.set_by_role,
        set_by_user_id=ext.set_by_user_id,
        new_contract_expiry_year=ext.new_contract_expiry_year,
        new_contract_length_years=ext.new_contract_length_years,
        new_annual_salary=ext.new_annual_salary,
        extension_start_year=ext.extension_start_year,
        signing_bonus=ext.signing_bonus,
        signing_bonus_amortization=ext.signing_bonus_amortization,
        notes=ext.notes,
        created_at=ext.created_at,
        updated_at=ext.updated_at,
    )


# CRUD 

async def set_contract_extension(
    api_football_id: int,
    data: ContractExtensionRequest,
    setter: User,
) -> ContractExtensionResponse:
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(setter)
    now = datetime.utcnow()

    amort = (
        data.signing_bonus / data.new_contract_length_years
        if data.signing_bonus > 0 and data.new_contract_length_years > 0
        else 0.0
    )

    if role == "admin":
        existing = await _get_admin_extension(player_id)
    elif role == "sport_director":
        existing = await _get_sd_extension(player_id, str(setter.id))
    else:
        # Regular user — stored as role="user", private to them
        role = "user"
        existing = await _get_user_extension(player_id, str(setter.id))

    ext_data = {
        "new_contract_expiry_year": data.new_contract_expiry_year,
        "new_contract_length_years": data.new_contract_length_years,
        "new_annual_salary": data.new_annual_salary,
        "extension_start_year": data.extension_start_year,
        "signing_bonus": data.signing_bonus,
        "signing_bonus_amortization": amort,
        "notes": data.notes,
        "updated_at": now,
    }

    if existing:
        await existing.set(ext_data)
        await existing.sync()
        ext = existing
    else:
        ext = ContractExtension(
            player_id=player_id,
            player_api_football_id=api_football_id,
            club_id=player.club_id,
            club_api_football_id=player.api_football_club_id or 0,
            set_by_user_id=str(setter.id),
            set_by_role=role,
            **ext_data,
        )
        await ext.insert()

    # Admin extension → update player's contract fields directly so squad sees it
    if role == "admin":
        update = {
            "contract_expiry_year": data.new_contract_expiry_year,
            "contract_length_years": data.new_contract_length_years,
        }
        if data.new_annual_salary is not None:
            update["estimated_annual_salary"] = data.new_annual_salary
            update["salary_source"] = "admin_extension"
        await player.set(update)

    return _serialize(ext, player.name)


async def get_contract_extension(
    api_football_id: int,
    viewer: User,
) -> dict:
    """
    Returns the player's current contract and all extensions visible to this viewer.

    Response structure:
      current   — the player's actual contract as it stands in the DB
      effective — the contract terms that will be used in FFP (after applying
                  the highest-priority extension: SD > Admin > User > none)
      extensions — list of extensions visible to this viewer, each tagged with
                   set_by_role so the frontend knows who set it
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(viewer)
    viewer_id = str(viewer.id)

    #  Load extensions visible to this viewer 
    admin_ext = await _get_admin_extension(player_id)
    my_ext: Optional[ContractExtension] = None

    if role == "admin":
        all_others = await ContractExtension.find(
            ContractExtension.player_id == player_id,
            ContractExtension.set_by_role != "admin",
        ).to_list()
    elif role == "sport_director":
        my_ext = await _get_sd_extension(player_id, viewer_id)
        all_others = []
    else:
        my_ext = await _get_user_extension(player_id, viewer_id)
        all_others = []

    #  Effective contract = highest-priority extension applied 
    effective_ext = await get_effective_extension(player_id, role == "sport_director", viewer_id, role)

    def _effective_value(ext_val, player_val):
        return ext_val if ext_val is not None else player_val

    effective_expiry_year = _effective_value(
        effective_ext.new_contract_expiry_year if effective_ext else None,
        player.contract_expiry_year,
    )
    effective_salary = _effective_value(
        effective_ext.new_annual_salary if effective_ext else None,
        player.estimated_annual_salary,
    )
    effective_length = _effective_value(
        effective_ext.new_contract_length_years if effective_ext else None,
        player.contract_length_years,
    )
    effective_bonus_amort = effective_ext.signing_bonus_amortization if effective_ext else 0.0

    #  Build extensions list (only non-null ones) 
    extensions = []
    if admin_ext:
        ext_dict = _serialize(admin_ext, player.name).model_dump()
        ext_dict["visibility"] = "everyone"
        extensions.append(ext_dict)

    if role == "admin":
        for e in all_others:
            ext_dict = _serialize(e, player.name).model_dump()
            ext_dict["visibility"] = f"only_{e.set_by_user_id}"
            extensions.append(ext_dict)
    elif my_ext:
        ext_dict = _serialize(my_ext, player.name).model_dump()
        ext_dict["visibility"] = "only_you"
        extensions.append(ext_dict)

    has_any_extension = bool(extensions)

    return {
        "player_api_football_id": api_football_id,
        "player_name": player.name,
        "player_position": player.position,
        "player_age": player.age,

        # The raw DB contract — what's actually signed
        "current_contract": {
            "expiry_year": player.contract_expiry_year,
            "length_years": player.contract_length_years,
            "annual_salary": player.estimated_annual_salary,
            "signing_date": player.contract_signing_date.isoformat() if player.contract_signing_date else None,
            "salary_source": player.salary_source,
        },

        # What FFP calculations will use for this viewer (extension applied if any)
        "effective_contract": {
            "expiry_year": effective_expiry_year,
            "length_years": effective_length,
            "annual_salary": effective_salary,
            "signing_bonus_annual_amortization": effective_bonus_amort,
            "extension_applied": has_any_extension and effective_ext is not None,
            "extension_set_by": effective_ext.set_by_role if effective_ext else None,
        },

        # All extensions visible to this viewer (empty list = no extensions set)
        "extensions": extensions,
        "has_extensions": has_any_extension,
    }


async def delete_contract_extension(
    api_football_id: int,
    deleter: User,
) -> dict:
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(deleter)

    if role == "admin":
        ext = await _get_admin_extension(player_id)
    elif role == "sport_director":
        ext = await _get_sd_extension(player_id, str(deleter.id))
    else:
        ext = await _get_user_extension(player_id, str(deleter.id))

    if not ext:
        raise HTTPException(status_code=404, detail="No contract extension found to delete.")

    await ext.delete()

    return {
        "message": f"Contract extension deleted for {player.name}.",
        "player_api_football_id": api_football_id,
        "deleted_role": role,
    }


#  FFP helper 

async def get_effective_extension(
    player_id: str,
    is_sd: bool,
    viewer_id: str | None,
    viewer_role: str = "user",
) -> Optional[ContractExtension]:
    """
    Returns the effective contract extension for FFP calculations.
    Priority: SD own > Admin > User's own > None
    """
    if viewer_id:
        if is_sd:
            sd = await _get_sd_extension(player_id, viewer_id)
            if sd:
                return sd
        else:
            # Regular user — check their own proposal
            user_ext = await _get_user_extension(player_id, viewer_id)
            if user_ext:
                return user_ext

    return await _get_admin_extension(player_id)