from fastapi import APIRouter, Depends
from app.schemas.player import PlayerOverrideRequest, PlayerOverrideResponse
from app.services import player_service
from app.core.deps import get_optional_user, require_sport_director
from app.models.user import User

router = APIRouter(prefix="/players", tags=["Players"])


@router.get(
    "/{api_football_id}",
    summary="Get player by API-Football ID",
    description="""
Returns player data merged by priority:

| Viewer | Data shown |
|--------|-----------|
| **Guest / Regular user** | Raw DB data + Admin override applied (if any) |
| **Sport Director** | Admin override + their own SD override on top |
| **Admin** | Same as SD — sees all override layers |

Sport Directors and Admins also receive `admin_override_*` and `sd_override_*`
fields showing exactly what each layer has set.
""",
)
async def get_player(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    return await player_service.get_player_by_api_id(api_football_id, viewer)


@router.put(
    "/{api_football_id}/override",
    response_model=PlayerOverrideResponse,
    summary="Override player data — Sport Directors / Admins only",
    description="""
Override any subset of player fields. Send only the fields you want to change.

**Admin override** → visible to **everyone** including guests. One per player.

**SD override** → visible **only to you**. Stacks on top of admin override.
Your override takes priority over admin's for your FFP calculations.

All fields are optional — only fields you send are overridden.
""",
)
async def set_player_override(
    api_football_id: int,
    body: PlayerOverrideRequest,
    user: User = Depends(require_sport_director),
):
    return await player_service.set_player_override(api_football_id, body, user)


@router.delete(
    "/{api_football_id}/override",
    summary="Reset your override — falls back to admin override or raw data",
    description="""
Deletes YOUR override for this player.

- **Admin** deletes → removes admin override → everyone sees raw DB data
- **SD** deletes → removes your private override → you now see admin override
  (or raw DB data if admin hasn't set one)
""",
)
async def delete_player_override(
    api_football_id: int,
    user: User = Depends(require_sport_director),
):
    return await player_service.delete_player_override(api_football_id, user)


@router.get(
    "/{api_football_id}/overrides",
    summary="List all overrides for a player — Admin / SD only",
    description="""
- **Admin** sees: the admin override + every SD's override
- **SD** sees: the admin override + their own SD override only
""",
)
async def list_overrides(
    api_football_id: int,
    user: User = Depends(require_sport_director),
):
    return await player_service.get_all_overrides_for_player(api_football_id, user)