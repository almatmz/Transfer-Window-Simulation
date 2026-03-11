from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from app.schemas.ffp import FFPDashboardResponse
from app.services import ffp_service
from app.core.deps import get_optional_user
from app.models.user import User
from app.core.config import settings

_CURRENT_YEAR = 2026
_MAX_YEAR = _CURRENT_YEAR + settings.MAX_SIMULATION_FUTURE_YEARS  # 2029

router = APIRouter(prefix="/ffp", tags=["FFP Dashboard"])


@router.get(
    "/club/{api_football_id}",
    response_model=FFPDashboardResponse,
    summary="FFP compliance dashboard",
    description=f"""
Returns FFP analysis for the club's **current real squad**.

Optionally overlay a saved simulation via `?sim_id=<id>`.

**Simulation year** (`simulation_year`): the season start year to project from.
- Defaults to the club's configured season year.
- **Maximum allowed: {_MAX_YEAR}** (current year {_CURRENT_YEAR} + 3 years).
  Beyond 3 years too many unpredictable events can affect FFP — projection is unreliable.
- When simulating e.g. the **2027 summer window**, FFP will consider 2026 and 2025 as
  past seasons in the break-even rolling calculation.

**What's calculated:**
- **Squad Cost Ratio** (wages + amortization) / revenue. UEFA limit: ≤ 70%
- **Break-Even Result**: 3-year rolling. Limit: -€5M (or -€60M with equity injection)
- **Sell profit/loss**: crystallized when player is sold — amortization stops, book P&L counts as relevant income
- **3-year forward projection**

No auth required for public data. Sport Directors see SD override salary calculations.
""",
)
async def get_ffp_dashboard(
    api_football_id: int,
    sim_id: Optional[str] = Query(None, description="Simulation ID to overlay on real squad FFP"),
    simulation_year: Optional[int] = Query(
        None,
        description=f"Season start year for projection (default: club season year). Max: {_MAX_YEAR}",
        ge=2020,
        le=_MAX_YEAR,
    ),
    viewer: User | None = Depends(get_optional_user),
):
    if simulation_year and simulation_year > _MAX_YEAR:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot simulate beyond {_MAX_YEAR} "
                   f"({settings.MAX_SIMULATION_FUTURE_YEARS} years from {_CURRENT_YEAR}). "
                   f"Too many unpredictable events affect FFP accuracy.",
        )
    return await ffp_service.get_ffp_dashboard_by_api_id(
        api_football_id, viewer, sim_id, simulation_year
    )