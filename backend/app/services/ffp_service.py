from fastapi import HTTPException
from app.models.club import Club
from app.models.player_contract import PlayerContract, ContractType
from app.models.transfer import TransferSimulation, SimulationTransfer, TransferType
from app.models.user import User
from app.utils.financial_engine import engine, ContractSnapshot, TransferDelta, SquadFinancials
from app.utils.ffp_rules import SQUAD_COST_RATIO_LIMIT, SQUAD_COST_RATIO_WARNING, BREAK_EVEN_LIMIT, BREAK_EVEN_EQUITY_LIMIT
from app.schemas.ffp import FFPDashboardResponse, YearlyProjection
from app.core.security import UserRole


async def _get_club(api_football_id: int) -> Club:
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail=f"Club {api_football_id} not loaded.")
    if club.annual_revenue <= 0:
        raise HTTPException(
            status_code=422,
            detail="Revenue not configured. Set it via PATCH /clubs/{id}/revenue before using the FFP dashboard."
        )
    return club


async def _contracts_to_snapshots(
    club_id: str,
    viewer: User | None,
) -> list[ContractSnapshot]:
    """
    Load active contracts for a club and convert to ContractSnapshot objects.
    Sport Directors / Admins see all contracts.
    Regular users see same data (salary is not hidden in snapshots — only SD overrides matter at endpoint level).
    """
    contracts = await PlayerContract.find(
        PlayerContract.club_id == club_id,
        PlayerContract.is_active == True,
    ).to_list()

    snapshots = []
    for c in contracts:
        is_loan = c.contract_type == ContractType.LOAN
        contribution = c.loan_wage_contribution_pct if is_loan else 100.0
        snapshots.append(ContractSnapshot(
            player_name=c.player_name,
            annual_salary=c.annual_salary,
            acquisition_fee=c.acquisition_fee,
            contract_start_year=c.contract_start_year,
            contract_expiry_year=c.contract_expiry_year,
            is_loan=is_loan,
            loan_wage_contribution_pct=contribution,
        ))
    return snapshots


async def _sim_to_deltas(
    sim: TransferSimulation,
    club_id: str,
    current_season: int,
) -> list[TransferDelta]:
    """Convert simulation transfer entries into FinancialEngine TransferDelta objects."""
    entries = await SimulationTransfer.find(
        SimulationTransfer.simulation_id == str(sim.id)
    ).to_list()

    deltas = []
    for t in entries:
        d = TransferDelta()

        if t.type == TransferType.BUY:
            d.added_wage = t.annual_salary
            d.added_amortization = engine.amortization_for_buy(t.transfer_fee, t.contract_length_years)
            d.added_transfer_fee = t.transfer_fee

        elif t.type == TransferType.SELL:
            # Find existing contract to get actual salary + book value
            contract = None
            if t.player_id:
                contract = await PlayerContract.find_one(
                    PlayerContract.player_id == t.player_id,
                    PlayerContract.club_id == club_id,
                    PlayerContract.is_active == True,
                )
            if contract:
                d.removed_wage = contract.annual_salary
                d.removed_amortization = contract.amortization_per_year
                d.sell_book_value = contract.get_remaining_book_value(current_season)
            else:
                d.removed_wage = t.annual_salary
            d.sell_fee_received = t.transfer_fee
            d.sell_profit_loss = t.transfer_fee - d.sell_book_value

        elif t.type == TransferType.LOAN_IN:
            d.loan_in_wage = engine.loan_in_wage_cost(t.annual_salary, t.loan_wage_contribution_pct)
            d.loan_in_fee = t.loan_fee

        elif t.type == TransferType.LOAN_OUT:
            d.loan_out_wage_relief = engine.loan_out_wage_relief(t.annual_salary, t.loan_wage_contribution_pct)
            d.loan_out_fee_received = t.loan_fee_received

        deltas.append(d)
    return deltas


async def get_ffp_dashboard(
    api_football_id: int,
    viewer: User | None,
    sim_id: str | None = None,
) -> FFPDashboardResponse:
    club = await _get_club(api_football_id)
    club_id = str(club.id)
    current_season = club.season_year

    snapshots = await _contracts_to_snapshots(club_id, viewer)

    # Simulation overlay
    sim = None
    deltas = None
    if sim_id:
        from beanie import PydanticObjectId
        try:
            sim = await TransferSimulation.get(PydanticObjectId(sim_id))
        except Exception:
            raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found.")
        if sim.club_api_football_id != api_football_id:
            raise HTTPException(status_code=400, detail="Simulation belongs to a different club.")
        deltas = await _sim_to_deltas(sim, club_id, current_season)

    # Calculate
    fin: SquadFinancials = engine.calculate_squad_financials(
        contracts=snapshots,
        revenue=club.annual_revenue,
        current_season=current_season,
        transfer_deltas=deltas,
    )

    # Projections
    proj_raw = engine.build_projections(
        contracts=snapshots,
        revenue=club.annual_revenue,
        current_season=current_season,
        transfer_deltas=deltas,
        years=3,
    )
    projections = [
        YearlyProjection(
            year=p.year,
            revenue=p.revenue,
            wage_bill=p.wage_bill,
            amortization=p.amortization,
            squad_cost=p.squad_cost,
            squad_cost_ratio=p.squad_cost_ratio,
            net_transfer_spend=p.net_transfer_spend,
            operating_result=p.operating_result,
            ffp_status=p.ffp_status,
            squad_cost_status=p.squad_cost_status,
        )
        for p in proj_raw
    ]

    return FFPDashboardResponse(
        club_id=club_id,
        club_name=club.name,
        annual_revenue=club.annual_revenue,
        season_year=current_season,
        contract_count=len(snapshots),

        wage_bill=fin.wage_bill,
        total_amortization=fin.total_amortization,
        squad_cost=fin.squad_cost,
        squad_cost_ratio=fin.squad_cost_ratio,

        squad_cost_status=fin.ffp_status.squad_cost_status,
        break_even_result=fin.break_even_result,
        break_even_status=fin.ffp_status.break_even_status,
        overall_status=fin.ffp_status.overall_status,

        squad_cost_ratio_pct=fin.ffp_status.squad_cost_ratio_pct,
        break_even_label=fin.ffp_status.break_even_eur_label,

        projections=projections,

        squad_cost_ratio_limit=SQUAD_COST_RATIO_LIMIT,
        squad_cost_ratio_warning=SQUAD_COST_RATIO_WARNING,
        break_even_limit_eur=BREAK_EVEN_LIMIT,
        break_even_equity_limit_eur=BREAK_EVEN_EQUITY_LIMIT,

        simulation_id=sim_id,
        simulation_name=sim.name if sim else None,
        sim_added_wages=fin.sim_added_wages if sim else None,
        sim_added_amortization=fin.sim_added_amortization if sim else None,
        sim_removed_wages=fin.sim_removed_wages if sim else None,
        sim_net_spend=fin.sim_net_spend if sim else None,
    )