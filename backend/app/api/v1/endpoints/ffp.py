from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.schemas.ffp import FFPDashboardResponse
from app.services import ffp_service
from app.core.deps import get_optional_user
from app.models.user import User

router = APIRouter(prefix="/ffp", tags=["FFP Dashboard"])


@router.get(
    "/club/{api_football_id}",
    response_model=FFPDashboardResponse,
    summary="FFP compliance dashboard — real squad + optional simulation overlay",
    description="""
Returns FFP analysis based on the club's **real current squad**.

Optionally pass `?sim_id=<simulation_id>` to overlay a simulation on top —
this shows what FFP would look like **if you executed those transfers**.

**What's calculated:**
- **Squad Cost Ratio** = (wages + amortization) / revenue. UEFA limit: ≤ 70%
- **Break-Even Result** = 3-year rolling profit/loss. Limit: -€5M (or -€60M with equity)
- **3-year projection** = forward-looking compliance forecast

**With simulation overlay:**
- Buys → add wages + amortization to squad cost
- Sells → remove player wages + amortization
- Loans in → add % of wages based on `wage_contribution_pct`
- Loans out → remove % of wages based on `wage_contribution_pct`

`squad_cost_ratio` is a decimal: `0.19` = 19% of revenue.

No auth required for public data. Sport Directors see salary override calculations.
""",
)
async def get_ffp_dashboard(
    api_football_id: int,
    sim_id: Optional[str] = Query(None, description="Simulation ID to overlay on real squad FFP"),
    viewer: User | None = Depends(get_optional_user),
):
    return await ffp_service.get_ffp_dashboard_by_api_id(api_football_id, viewer, sim_id)