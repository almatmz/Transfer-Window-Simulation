from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.schemas.ffp import FFPDashboardResponse
from app.services import ffp_service
from app.core.deps import get_optional_user
from app.models.user import User

router = APIRouter(prefix="/ffp", tags=["FFP Dashboard"])


@router.get("/club/{api_football_id}", response_model=FFPDashboardResponse,
    summary="FFP compliance dashboard",
    description="""
Returns full FFP analysis based on **real PlayerContracts** in the database.

Pass `?sim_id=<id>` to overlay a simulation on top and see FFP impact of those transfers.

**Status values:**
- `squad_cost_status`: `OK` (≤65%) | `WARNING` (65-70%) | `VIOLATION` (>70%)
- `overall_status`: `SAFE` | `MONITORING` | `HIGH_RISK`

**Requires:** Club revenue must be set via `PATCH /clubs/{id}/revenue` first.

Sport Directors see calculations based on real override salaries.
""")
async def get_ffp_dashboard(
    api_football_id: int,
    sim_id: Optional[str] = Query(None, description="Simulation ID to overlay on real squad"),
    viewer: User | None = Depends(get_optional_user),
):
    return await ffp_service.get_ffp_dashboard(api_football_id, viewer, sim_id)