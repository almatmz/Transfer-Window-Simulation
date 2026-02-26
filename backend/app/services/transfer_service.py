"""
Transfer Simulation Engine
Core logic for computing the financial impact of a transfer window.

For each simulation:
1. Aggregate current squad wages + amortization (baseline)
2. Add incoming transfers: +wages, +amortization
3. Remove outgoing transfers: -wages, -remaining amortization
4. Compute net spend, W/R ratio, FFP status
5. Project 3 years forward
"""

from datetime import datetime
from fastapi import HTTPException

from app.models.club import Club
from app.models.player import Player
from app.models.transfer import TransferSimulation, TransferEntry, TransferType
from app.schemas.transfer import SimulationCreate, SimulationUpdate, SimulationResponse
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import build_yearly_projections, worst_case_status, evaluate_ffp_status


def _serialize(sim: TransferSimulation) -> SimulationResponse:
    return SimulationResponse(
        id=str(sim.id),
        club_id=sim.club_id,
        simulation_name=sim.simulation_name,
        transfers=sim.transfers,
        projections=sim.projections,
        total_incoming_fees=sim.total_incoming_fees,
        total_outgoing_fees=sim.total_outgoing_fees,
        net_spend=sim.net_spend,
        overall_ffp_status=sim.overall_ffp_status,
        created_at=sim.created_at,
        updated_at=sim.updated_at,
    )


async def _compute_simulation(
    club: Club,
    transfers: list[TransferEntry],
) -> dict:
    # --- 1. Baseline from existing squad ---
    existing_players = await Player.find(
        Player.club_id == str(club.id),
        Player.is_active == True,
    ).to_list()

    baseline_wages = sum(p.annual_salary for p in existing_players)
    baseline_amortization = sum(
        calculate_annual_amortization(p.acquisition_fee, p.contract_length_years)
        for p in existing_players
    )

    # --- 2. Process incoming transfers ---
    incoming_fees = 0.0
    incoming_wages = 0.0
    incoming_amortization = 0.0

    outgoing_fees = 0.0
    outgoing_wages = 0.0
    outgoing_amortization = 0.0

    for t in transfers:
        amort = calculate_annual_amortization(t.transfer_fee, t.contract_length_years)

        if t.transfer_type == TransferType.INCOMING:
            incoming_fees += t.transfer_fee
            incoming_wages += t.annual_salary
            incoming_amortization += amort
        else:
            outgoing_fees += t.transfer_fee
            # Rough estimate: outgoing player's wages / amortization are removed
            # In a real system you'd look them up by player_id
            outgoing_wages += t.annual_salary
            outgoing_amortization += amort

    # --- 3. Adjusted totals ---
    total_wage_bill = baseline_wages + incoming_wages - outgoing_wages
    total_amortization = baseline_amortization + incoming_amortization - outgoing_amortization
    net_spend = incoming_fees - outgoing_fees

    # --- 4. FFP Projections ---
    projections = build_yearly_projections(
        base_revenue=club.annual_revenue,
        base_wage_bill=total_wage_bill,
        base_amortization=total_amortization,
        net_spend=net_spend,
        projection_years=club.projection_years,
        season_year=club.season_year,
    )

    return {
        "total_incoming_fees": round(incoming_fees, 2),
        "total_outgoing_fees": round(outgoing_fees, 2),
        "net_spend": round(net_spend, 2),
        "projections": projections,
        "overall_ffp_status": worst_case_status(projections),
    }


async def create_simulation(data: SimulationCreate) -> SimulationResponse:
    club = await Club.get(data.club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    transfers = [TransferEntry(**t.model_dump()) for t in data.transfers]
    computed = await _compute_simulation(club, transfers)

    sim = TransferSimulation(
        club_id=data.club_id,
        simulation_name=data.simulation_name,
        transfers=transfers,
        **computed,
    )
    await sim.insert()
    return _serialize(sim)


async def get_simulation(simulation_id: str) -> SimulationResponse:
    sim = await TransferSimulation.get(simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return _serialize(sim)


async def list_simulations(club_id: str) -> list[SimulationResponse]:
    sims = await TransferSimulation.find(
        TransferSimulation.club_id == club_id
    ).to_list()
    return [_serialize(s) for s in sims]


async def update_simulation(simulation_id: str, data: SimulationUpdate) -> SimulationResponse:
    sim = await TransferSimulation.get(simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    club = await Club.get(sim.club_id)

    if data.transfers is not None:
        sim.transfers = [TransferEntry(**t.model_dump()) for t in data.transfers]

    if data.simulation_name:
        sim.simulation_name = data.simulation_name

    # Recompute on any change
    computed = await _compute_simulation(club, sim.transfers)
    sim.projections = computed["projections"]
    sim.total_incoming_fees = computed["total_incoming_fees"]
    sim.total_outgoing_fees = computed["total_outgoing_fees"]
    sim.net_spend = computed["net_spend"]
    sim.overall_ffp_status = computed["overall_ffp_status"]
    sim.updated_at = datetime.utcnow()

    await sim.save()
    return _serialize(sim)


async def delete_simulation(simulation_id: str) -> dict:
    sim = await TransferSimulation.get(simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    await sim.delete()
    return {"message": "Simulation deleted"}