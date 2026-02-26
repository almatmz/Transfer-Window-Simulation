from fastapi import APIRouter
from app.schemas.ffp import FFPDashboardResponse
from app.services import ffp_service

router = APIRouter(prefix="/ffp", tags=["FFP Risk Dashboard"])


@router.get(
    "/club/{club_id}",
    response_model=FFPDashboardResponse,
    summary="Get FFP risk dashboard for a club",
    description=(
        "Returns current wage-to-revenue ratio, amortization burden, "
        "multi-year FFP projections, and a Red/Amber/Green risk indicator "
        "based on the club's existing squad — no simulation required."
    ),
)
async def get_ffp_dashboard(club_id: str):
    return await ffp_service.get_ffp_dashboard(club_id)