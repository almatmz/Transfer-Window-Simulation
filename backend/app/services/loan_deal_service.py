from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from app.models.loan_deal import LoanDeal
from app.models.player import Player
from app.models.user import User
from app.core.security import UserRole
from app.schemas.loan_deal import (
    LoanDealRequest,
    LoanDealResponse,
    ExerciseOptionRequest,
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


async def _get_admin_deal(player_id: str, direction: str) -> Optional[LoanDeal]:
    return await LoanDeal.find_one(
        LoanDeal.player_id == player_id,
        LoanDeal.loan_direction == direction,
        LoanDeal.set_by_role == "admin",
        LoanDeal.is_active == True,  # noqa: E712
    )


async def _get_sd_deal(
    player_id: str, direction: str, user_id: str
) -> Optional[LoanDeal]:
    return await LoanDeal.find_one(
        LoanDeal.player_id == player_id,
        LoanDeal.loan_direction == direction,
        LoanDeal.set_by_user_id == user_id,
        LoanDeal.set_by_role == "sport_director",
        LoanDeal.is_active == True,  # noqa: E712
    )


def _compute_wage_impact(deal: LoanDeal) -> float:
    """
    Returns the net wage impact of this deal for FFP purposes.
    Positive = wage cost added, Negative = wage relief.
    """
    effective = deal.annual_salary * deal.wage_contribution_pct / 100
    if deal.loan_direction == "in":
        return effective          # cost
    else:
        return -effective         # relief


def _serialize(deal: LoanDeal, player_name: str) -> LoanDealResponse:
    return LoanDealResponse(
        id=str(deal.id),
        player_id=deal.player_id,
        player_name=player_name,
        club_id=deal.club_id,
        club_api_football_id=deal.club_api_football_id,
        set_by_role=deal.set_by_role,
        set_by_user_id=deal.set_by_user_id,
        loan_direction=deal.loan_direction,
        counterpart_club_name=deal.counterpart_club_name,
        counterpart_club_api_football_id=deal.counterpart_club_api_football_id,
        loan_start_date=deal.loan_start_date,
        loan_end_date=deal.loan_end_date,
        loan_season=deal.loan_season,
        loan_fee=deal.loan_fee,
        annual_salary=deal.annual_salary,
        wage_contribution_pct=deal.wage_contribution_pct,
        effective_wage_impact=_compute_wage_impact(deal),
        has_option_to_buy=deal.has_option_to_buy,
        option_to_buy_fee=deal.option_to_buy_fee,
        option_is_obligation=deal.option_is_obligation,
        option_contract_years=deal.option_contract_years,
        option_annual_salary=deal.option_annual_salary,
        option_exercised=deal.option_exercised,
        option_exercised_at=deal.option_exercised_at,
        notes=deal.notes,
        is_active=deal.is_active,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


# ─────────────────────── CRUD ────────────────────────────────────────────────

async def set_loan_deal(
    api_football_id: int,
    data: LoanDealRequest,
    setter: User,
) -> LoanDealResponse:
    """
    Create or update a loan deal for a player.
    Admin → one deal per (player, direction) globally.
    SD   → one deal per (player, direction, user).
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(setter)
    now = datetime.utcnow()

    # Find club_id from player
    club_id = player.club_id
    club_api_football_id = player.api_football_club_id or 0

    if role == "admin":
        existing = await _get_admin_deal(player_id, data.loan_direction)
    else:
        existing = await _get_sd_deal(player_id, data.loan_direction, str(setter.id))

    deal_data = data.model_dump()
    deal_data["updated_at"] = now

    if existing:
        await existing.set(deal_data)
        await existing.sync()
        deal = existing
    else:
        deal = LoanDeal(
            player_id=player_id,
            player_api_football_id=api_football_id,
            club_id=club_id,
            club_api_football_id=club_api_football_id,
            set_by_user_id=str(setter.id),
            set_by_role=role,
            **deal_data,
        )
        await deal.insert()

    # If loan_in: update player's is_on_loan flag (admin only, so everyone sees it)
    if role == "admin":
        if data.loan_direction == "in":
            await player.set({
                "is_on_loan": True,
                "loan_from_club": data.counterpart_club_name,
                "loan_end_date": data.loan_end_date,
                "loan_fee": data.loan_fee,
                "loan_option_to_buy": data.has_option_to_buy,
                "loan_option_to_buy_fee": data.option_to_buy_fee,
                "loan_wage_contribution_pct": data.wage_contribution_pct,
            })
        elif data.loan_direction == "out":
            await player.set({
                "loaned_out": True,
                "loaned_out_to_club": data.counterpart_club_name,
                "loaned_out_to_club_id": str(data.counterpart_club_api_football_id or ""),
                "loaned_out_start_date": data.loan_start_date,
                "loaned_out_end_date": data.loan_end_date,
                "loaned_out_fee": data.loan_fee,
                "loaned_out_option_to_buy": data.has_option_to_buy,
                "loaned_out_option_to_buy_fee": data.option_to_buy_fee,
                "loaned_out_wage_contribution_pct": data.wage_contribution_pct,
            })

    return _serialize(deal, player.name)


async def get_loan_deals(
    api_football_id: int,
    viewer: User,
) -> dict:
    """
    Returns loan deals visible to this viewer.
    Admin sees all deals for this player.
    SD sees admin deals + their own SD deals.
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(viewer)

    admin_in = await _get_admin_deal(player_id, "in")
    admin_out = await _get_admin_deal(player_id, "out")

    result = {
        "player_api_football_id": api_football_id,
        "player_name": player.name,
        "loan_in": {
            "admin": _serialize(admin_in, player.name) if admin_in else None,
            "sd": None,
        },
        "loan_out": {
            "admin": _serialize(admin_out, player.name) if admin_out else None,
            "sd": None,
        },
    }

    if role == "admin":
        all_sd = await LoanDeal.find(
            LoanDeal.player_id == player_id,
            LoanDeal.set_by_role == "sport_director",
            LoanDeal.is_active == True,  # noqa: E712
        ).to_list()
        result["all_sd_deals"] = [_serialize(d, player.name) for d in all_sd]
    else:
        viewer_id = str(viewer.id)
        sd_in = await _get_sd_deal(player_id, "in", viewer_id)
        sd_out = await _get_sd_deal(player_id, "out", viewer_id)
        result["loan_in"]["sd"] = _serialize(sd_in, player.name) if sd_in else None
        result["loan_out"]["sd"] = _serialize(sd_out, player.name) if sd_out else None

    return result


async def delete_loan_deal(
    api_football_id: int,
    direction: str,
    deleter: User,
) -> dict:
    """
    Delete YOUR loan deal for this player+direction.
    Admin deletes → everyone loses that deal.
    SD deletes → only their private deal removed.
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(deleter)

    if role == "admin":
        deal = await _get_admin_deal(player_id, direction)
        # Clear player flags too
        if deal and direction == "in":
            await player.set({"is_on_loan": False, "loan_from_club": None})
        elif deal and direction == "out":
            await player.set({"loaned_out": False, "loaned_out_to_club": None})
    else:
        deal = await _get_sd_deal(player_id, direction, str(deleter.id))

    if not deal:
        raise HTTPException(status_code=404, detail="No active loan deal found to delete.")

    await deal.delete()
    return {
        "message": f"Loan {direction} deal deleted for {player.name}.",
        "player_api_football_id": api_football_id,
        "direction": direction,
    }


async def exercise_option(
    api_football_id: int,
    direction: str,
    data: ExerciseOptionRequest,
    user: User,
) -> LoanDealResponse:
    """
    Mark a loan option to buy as exercised.
    - loan_in option exercised  → this club is permanently buying the player
    - loan_out option exercised → receiving club is buying the player (player leaves)

    Updates player's is_sold / acquisition fields accordingly (admin only).
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = _role(user)
    now = datetime.utcnow()

    if role == "admin":
        deal = await _get_admin_deal(player_id, direction)
    else:
        deal = await _get_sd_deal(player_id, direction, str(user.id))

    if not deal:
        raise HTTPException(status_code=404, detail="No active loan deal found.")
    if not deal.has_option_to_buy:
        raise HTTPException(status_code=400, detail="This loan has no option to buy.")
    if deal.option_exercised:
        raise HTTPException(status_code=400, detail="Option already exercised.")

    await deal.set({
        "option_exercised": True,
        "option_exercised_at": now,
        "notes": (deal.notes + f"\n[Option exercised {now.date()}] {data.notes}").strip(),
        "updated_at": now,
    })

    # Admin exercising loan_out option → player is sold
    if role == "admin" and direction == "out":
        await player.set({
            "is_sold": True,
            "sold_for": deal.option_to_buy_fee or 0.0,
            "sold_in_year": now.year,
            "loaned_out": False,
        })

    # Admin exercising loan_in option → player becomes permanent signing
    if role == "admin" and direction == "in":
        await player.set({
            "is_on_loan": False,
            "loan_from_club": None,
            "acquisition_fee": deal.option_to_buy_fee or 0.0,
            "acquisition_year": now.year,
            "contract_length_years": deal.option_contract_years or player.contract_length_years,
            "estimated_annual_salary": deal.option_annual_salary or player.estimated_annual_salary,
        })

    await deal.sync()
    return _serialize(deal, player.name)


# ─────────────────────── FFP helpers (called by ffp_service) ─────────────────

async def get_effective_loan_in(
    player_id: str,
    is_sd: bool,
    viewer_id: str | None,
) -> Optional[LoanDeal]:
    """Returns the effective loan_in deal for FFP, applying SD > Admin priority."""
    if is_sd and viewer_id:
        sd = await LoanDeal.find_one(
            LoanDeal.player_id == player_id,
            LoanDeal.loan_direction == "in",
            LoanDeal.set_by_user_id == viewer_id,
            LoanDeal.set_by_role == "sport_director",
            LoanDeal.is_active == True,  # noqa: E712
        )
        if sd:
            return sd
    return await LoanDeal.find_one(
        LoanDeal.player_id == player_id,
        LoanDeal.loan_direction == "in",
        LoanDeal.set_by_role == "admin",
        LoanDeal.is_active == True,  # noqa: E712
    )


async def get_effective_loan_out(
    player_id: str,
    is_sd: bool,
    viewer_id: str | None,
) -> Optional[LoanDeal]:
    """Returns the effective loan_out deal for FFP, applying SD > Admin priority."""
    if is_sd and viewer_id:
        sd = await LoanDeal.find_one(
            LoanDeal.player_id == player_id,
            LoanDeal.loan_direction == "out",
            LoanDeal.set_by_user_id == viewer_id,
            LoanDeal.set_by_role == "sport_director",
            LoanDeal.is_active == True,  # noqa: E712
        )
        if sd:
            return sd
    return await LoanDeal.find_one(
        LoanDeal.player_id == player_id,
        LoanDeal.loan_direction == "out",
        LoanDeal.set_by_role == "admin",
        LoanDeal.is_active == True,  # noqa: E712
    )