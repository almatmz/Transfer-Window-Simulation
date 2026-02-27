from fastapi import APIRouter, Depends
from app.schemas.ffp import FFPDashboardResponse
from app.services import ffp_service
from app.core.deps import get_optional_user
from app.models.user import User

router = APIRouter(prefix="/ffp", tags=["FFP Dashboard"])


@router.get(
    "/club/{api_football_id}",
    response_model=FFPDashboardResponse,
    summary="FFP compliance dashboard — UEFA Squad Cost Ratio + Break-Even",
    description="""
Returns full FFP analysis for a club.

**Important:** Set the club's annual revenue first via `PATCH /api/v1/clubs/{id}/revenue`
otherwise the calculation has no base and will show HIGH_RISK for everything.

**What's calculated:**
- **Squad Cost Ratio** = (wages + amortization) / revenue. UEFA limit: ≤ 70% from 2025/26
- **Break-Even Result** = 3-year rolling operating profit/loss. Limit: -€5M (or -€60M with equity)
- **3-year projection** = forward-looking compliance forecast

**squad_cost_ratio in response** is a decimal: `0.68` = 68% of revenue.

No auth required. Sport Directors see calculations using their private salary overrides.
""",
)
async def get_ffp_dashboard(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    return await ffp_service.get_ffp_dashboard_by_api_id(api_football_id, viewer)