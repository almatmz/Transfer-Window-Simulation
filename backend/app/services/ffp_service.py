from __future__ import annotations

from fastapi import HTTPException

from app.core.security import UserRole
from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.loan_deal import LoanDeal
from app.models.contract_extension import ContractExtension
from app.models.transfer import TransferSimulation
from app.models.user import User
from app.schemas.ffp import FFPDashboardResponse, FFPStatus, YearlyProjection as YP
from app.utils.amortization import (
    calculate_annual_amortization,
    amortization_for_season,
    book_profit_or_loss,
)
from app.utils.ffp_calculator import (
    build_projections,
    squad_cost_ratio_calc,
    ffp_status_from_ratio,
    validate_simulation_year,
)

_NOW_YEAR = 2026


#  Bulk loader 

class SquadContext:
    """
    Holds all override/extension/loan data for a squad, loaded in 5 bulk queries.
    All lookups are O(1) dict access — zero additional DB calls in the main loop.
    """
    def __init__(
        self,
        admin_overrides: dict[str, PlayerOverride],      # player_id → override
        sd_overrides: dict[str, PlayerOverride],          # player_id → override
        admin_extensions: dict[str, ContractExtension],  # player_id → extension
        sd_extensions: dict[str, ContractExtension],     # player_id → extension
        user_extensions: dict[str, ContractExtension],   # player_id → extension
        admin_loans: dict[tuple, LoanDeal],               # (player_id, direction) → deal
        sd_loans: dict[tuple, LoanDeal],                  # (player_id, direction) → deal
    ):
        self.admin_overrides = admin_overrides
        self.sd_overrides = sd_overrides
        self.admin_extensions = admin_extensions
        self.sd_extensions = sd_extensions
        self.user_extensions = user_extensions
        self.admin_loans = admin_loans
        self.sd_loans = sd_loans

    def get_financials(
        self, player: Player, is_sd: bool, viewer_id: str | None
    ) -> tuple[float, int, float, int, str]:
        """
        Returns (salary, contract_years, acquisition_fee, acquisition_year, source)
        Priority: SD override > Admin override > raw DB
        """
        pid = str(player.id)

        if is_sd and viewer_id:
            ov = self.sd_overrides.get(pid)
            if ov:
                return (
                    ov.annual_salary or player.estimated_annual_salary,
                    ov.contract_length_years or player.contract_length_years,
                    ov.acquisition_fee if ov.acquisition_fee is not None else player.acquisition_fee,
                    ov.acquisition_year or player.acquisition_year or 0,
                    "sd_override",
                )

        ov = self.admin_overrides.get(pid)
        if ov:
            return (
                ov.annual_salary or player.estimated_annual_salary,
                ov.contract_length_years or player.contract_length_years,
                ov.acquisition_fee if ov.acquisition_fee is not None else player.acquisition_fee,
                ov.acquisition_year or player.acquisition_year or 0,
                "admin_override",
            )

        return (
            player.estimated_annual_salary,
            player.contract_length_years,
            player.acquisition_fee,
            player.acquisition_year or 0,
            player.salary_source or "position_estimate",
        )

    def get_extension(
        self, player_id: str, is_sd: bool, viewer_id: str | None
    ) -> ContractExtension | None:
        """Priority: SD > Admin > User's own"""
        if viewer_id:
            if is_sd:
                ext = self.sd_extensions.get(player_id)
                if ext:
                    return ext
            else:
                ext = self.user_extensions.get(player_id)
                if ext:
                    return ext
        return self.admin_extensions.get(player_id)

    def get_loan(
        self, player_id: str, direction: str, is_sd: bool, viewer_id: str | None
    ) -> LoanDeal | None:
        """Priority: SD > Admin"""
        if is_sd and viewer_id:
            deal = self.sd_loans.get((player_id, direction))
            if deal:
                return deal
        return self.admin_loans.get((player_id, direction))


async def _load_squad_context(
    player_ids: list[str],
    is_sd: bool,
    viewer_id: str | None,
    viewer_role: str,
) -> SquadContext:
    """
    5 bulk queries to load all data needed for FFP calculations.
    No matter how large the squad, this is always exactly 5 queries.
    """
    if not player_ids:
        return SquadContext({}, {}, {}, {}, {}, {}, {})

    # Query 1: Admin PlayerOverrides for all players
    admin_ovs_list = await PlayerOverride.find(
        {"player_id": {"$in": player_ids}, "set_by_role": "admin"}
    ).to_list()
    admin_overrides = {ov.player_id: ov for ov in admin_ovs_list}

    # Query 2: This viewer's SD overrides (only if SD/Admin)
    sd_overrides: dict[str, PlayerOverride] = {}
    if is_sd and viewer_id:
        sd_ovs_list = await PlayerOverride.find(
            {"player_id": {"$in": player_ids}, "set_by_user_id": viewer_id, "set_by_role": "sport_director"}
        ).to_list()
        sd_overrides = {ov.player_id: ov for ov in sd_ovs_list}

    # Query 3: All ContractExtensions for these players
    # Load admin + viewer's own in one query, split by role
    if viewer_id:
        if is_sd:
            extensions_list = await ContractExtension.find(
                {"player_id": {"$in": player_ids}, "set_by_role": {"$in": ["admin", "sport_director"]},
                 "$or": [{"set_by_role": "admin"}, {"set_by_user_id": viewer_id}]}
            ).to_list()
        else:
            extensions_list = await ContractExtension.find(
                {"player_id": {"$in": player_ids},
                 "$or": [{"set_by_role": "admin"}, {"set_by_user_id": viewer_id, "set_by_role": "user"}]}
            ).to_list()
    else:
        extensions_list = await ContractExtension.find(
            {"player_id": {"$in": player_ids}, "set_by_role": "admin"}
        ).to_list()

    admin_extensions: dict[str, ContractExtension] = {}
    sd_extensions: dict[str, ContractExtension] = {}
    user_extensions: dict[str, ContractExtension] = {}
    for ext in extensions_list:
        if ext.set_by_role == "admin":
            admin_extensions[ext.player_id] = ext
        elif ext.set_by_role == "sport_director" and ext.set_by_user_id == viewer_id:
            sd_extensions[ext.player_id] = ext
        elif ext.set_by_role == "user" and ext.set_by_user_id == viewer_id:
            user_extensions[ext.player_id] = ext

    # Query 4: Admin LoanDeals for all players
    admin_loans_list = await LoanDeal.find(
        {"player_id": {"$in": player_ids}, "set_by_role": "admin", "is_active": True}
    ).to_list()
    admin_loans = {(d.player_id, d.loan_direction): d for d in admin_loans_list}

    # Query 5: Viewer's SD LoanDeals (only if SD/Admin)
    sd_loans: dict[tuple, LoanDeal] = {}
    if is_sd and viewer_id:
        sd_loans_list = await LoanDeal.find(
            {"player_id": {"$in": player_ids}, "set_by_user_id": viewer_id,
             "set_by_role": "sport_director", "is_active": True}
        ).to_list()
        sd_loans = {(d.player_id, d.loan_direction): d for d in sd_loans_list}

    return SquadContext(
        admin_overrides=admin_overrides,
        sd_overrides=sd_overrides,
        admin_extensions=admin_extensions,
        sd_extensions=sd_extensions,
        user_extensions=user_extensions,
        admin_loans=admin_loans,
        sd_loans=sd_loans,
    )


#  Player wage helper 

def _effective_wage(
    player: Player,
    ctx: SquadContext,
    is_sd: bool,
    viewer_id: str | None,
    start_year: int,
) -> tuple[float, int, float, int, str, float]:
    """
    Returns (salary, contract_years, fee, acq_year, source, extra_amort)
    applying all overrides, extensions, and loan adjustments — pure dict lookups.
    extra_amort = signing bonus amortization from contract extension.
    """
    pid = str(player.id)
    sal, yrs, fee, acq_year, src = ctx.get_financials(player, is_sd, viewer_id)
    extra_amort = 0.0

    # Contract extension
    ext = ctx.get_extension(pid, is_sd, viewer_id)
    if ext and ext.extension_start_year <= start_year:
        if ext.new_annual_salary is not None:
            sal = ext.new_annual_salary
            src = f"{ext.set_by_role}_extension"
        yrs = ext.new_contract_length_years
        extra_amort = ext.signing_bonus_amortization

    # Loan OUT: reduce our wage cost by receiving club's share
    loan_out = ctx.get_loan(pid, "out", is_sd, viewer_id)
    if loan_out and loan_out.is_active and not loan_out.option_exercised:
        sal = sal * (1 - loan_out.wage_contribution_pct / 100)

    # Loan IN: override salary with the actual loan contribution
    loan_in = ctx.get_loan(pid, "in", is_sd, viewer_id)
    if loan_in and loan_in.is_active and not loan_in.option_exercised:
        sal = loan_in.annual_salary * loan_in.wage_contribution_pct / 100
        src = f"loan_in_{loan_in.set_by_role}"

    return sal, yrs, fee, acq_year, src, extra_amort


#  Per-year wage bill 

def _player_active_in_year(
    player: Player,
    ctx: SquadContext,
    is_sd: bool,
    viewer_id: str | None,
    target_year: int,
) -> bool:
    """
    Returns True if a player is still under contract in target_year.
    Considers contract extensions (which push out the expiry year).
    Loans end when loan_end_date passes — loaned-out players still count
    for the parent club's wage bill at their reduced contribution.
    """
    pid = str(player.id)

    # Check contract extension first — it may extend the expiry year
    ext = ctx.get_extension(pid, is_sd, viewer_id)
    if ext and ext.extension_start_year <= target_year:
        # Extension is active — use extended expiry year
        return ext.new_contract_expiry_year >= target_year

    # Use merged override expiry year, else raw DB value
    _, _, _, _, src = ctx.get_financials(player, is_sd, viewer_id)
    ov = ctx.sd_overrides.get(pid) or ctx.admin_overrides.get(pid)
    expiry = (ov.contract_expiry_year if ov and ov.contract_expiry_year else None)              or player.contract_expiry_year

    if expiry and expiry > 0 and expiry < target_year:
        return False  # contract expired before this season

    return True


def _compute_yearly_wage_bill(
    active_players: list,
    loaned_in_players: list,
    loan_in_by_player: dict,
    ctx: "SquadContext",
    is_sd: bool,
    viewer_id: str | None,
    projection_years: int,
    start_year: int,
) -> list[float]:
    """
    Returns a list of wage bills, one per projection year.
    Each year filters out players whose contracts have expired,
    respects extensions, and adjusts for loans ending mid-projection.
    Zero DB calls — uses pre-loaded ctx.
    """
    wage_bills = []

    for i in range(projection_years):
        target_year = start_year + i
        year_wages = 0.0

        for player in active_players:
            if not _player_active_in_year(player, ctx, is_sd, viewer_id, target_year):
                continue  # contract expired — not in wage bill this year

            sal, yrs, fee, acq_year, src, _ = _effective_wage(
                player, ctx, is_sd, viewer_id, target_year
            )

            # Loan OUT expiry: if loan ended, full wage returns to parent club
            pid = str(player.id)
            loan_out = ctx.get_loan(pid, "out", is_sd, viewer_id)
            if loan_out and loan_out.loan_end_date:
                if loan_out.loan_end_date.year < target_year:
                    # Loan has ended — player back, pay full salary
                    sal, _, _, _, _, _ = _effective_wage(
                        player, ctx, is_sd, viewer_id, target_year
                    )
                    # Remove the loan_out reduction by re-computing without it
                    base_sal, _, _, _, _, _ = ctx.get_financials(player, is_sd, viewer_id)
                    ext = ctx.get_extension(pid, is_sd, viewer_id)
                    if ext and ext.extension_start_year <= target_year and ext.new_annual_salary:
                        base_sal = ext.new_annual_salary
                    sal = base_sal  # full salary, loan relief gone

            year_wages += sal

        # Loaned-in players: only count while loan is active
        for player in loaned_in_players:
            pid = str(player.id)
            deal = loan_in_by_player.get(pid)
            if deal:
                # Check if loan is still active this year
                if deal.loan_end_date and deal.loan_end_date.year < target_year:
                    continue  # loan ended
                wage_cost = deal.annual_salary * deal.wage_contribution_pct / 100
            else:
                # Direct loan from player fields
                lo_end = getattr(player, "loaned_out_end_date", None)
                if lo_end and lo_end.year < target_year:
                    continue  # loan ended
                pct = getattr(player, "loaned_out_wage_contribution_pct", 100.0)
                wage_cost = player.estimated_annual_salary * pct / 100
            year_wages += wage_cost

        wage_bills.append(round(year_wages, 2))

    return wage_bills


#  Main FFP function 

async def get_ffp_dashboard_by_api_id(
    api_football_id: int,
    viewer: User | None,
    sim_id: str | None = None,
    simulation_year: int | None = None,
) -> FFPDashboardResponse:

    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=f"Club {api_football_id} not loaded. Call GET /clubs/{api_football_id} first.",
        )

    start_year = simulation_year or club.season_year or _NOW_YEAR
    try:
        validate_simulation_year(start_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    players = await Player.find(Player.club_id == str(club.id)).to_list()
    is_sd = bool(viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN))
    viewer_id = str(viewer.id) if viewer else None
    viewer_role = viewer.role.value if viewer and hasattr(viewer.role, "value") else "user"

    # Revenue
    from app.services.club_service import get_effective_revenue
    annual_revenue = await get_effective_revenue(club, viewer_id)

    #  BULK LOAD: 5 queries for the entire squad 
    active_players = [p for p in players if not p.is_sold]

    # Also include loaned-IN players (belong to other clubs, but cost wages here)
    loan_in_deals = await LoanDeal.find({
        "club_api_football_id": api_football_id,
        "loan_direction": "in",
        "is_active": True,
        "option_exercised": False,
    }).to_list()

    # Deduplicate: SD deal wins over admin deal for same player
    loan_in_by_player: dict[str, LoanDeal] = {}
    for deal in loan_in_deals:
        if not is_sd and deal.set_by_role != "admin":
            continue
        existing = loan_in_by_player.get(deal.player_id)
        if existing is None:
            loan_in_by_player[deal.player_id] = deal
        elif deal.set_by_role == "sport_director" and deal.set_by_user_id == viewer_id:
            loan_in_by_player[deal.player_id] = deal

    # Fetch loaned-in player documents
    loaned_in_player_ids = list(loan_in_by_player.keys())
    loaned_in_players: list[Player] = []
    if loaned_in_player_ids:
        import bson
        loaned_in_players = await Player.find(
            {"_id": {"$in": [bson.ObjectId(pid) for pid in loaned_in_player_ids]}}
        ).to_list()

    all_active = active_players + loaned_in_players
    player_ids = [str(p.id) for p in all_active]

    ctx = await _load_squad_context(player_ids, is_sd, viewer_id, viewer_role)

    # Baseline loop: pure dict lookups, zero DB calls 
    baseline_wages = 0.0
    baseline_amort = 0.0
    sources_used: set[str] = set()

    for player in active_players:
        sal, yrs, fee, acq_year, src, extra_amort = _effective_wage(
            player, ctx, is_sd, viewer_id, start_year
        )
        baseline_wages += sal
        baseline_amort += extra_amort
        if fee > 0 and acq_year > 0:
            baseline_amort += amortization_for_season(
                fee=fee,
                contract_years=yrs,
                acquisition_year=acq_year,
                target_season_year=start_year,
            )
        sources_used.add(src)

    # Loaned-in players: add this club's wage contribution to wage bill
    # (they don't appear in own players, so handle separately)
    for player in loaned_in_players:
        pid = str(player.id)
        deal = loan_in_by_player.get(pid)
        if not deal:
            continue
        # Wage cost = annual_salary * this club's contribution %
        wage_cost = deal.annual_salary * deal.wage_contribution_pct / 100
        baseline_wages += wage_cost
        # Loan fee amortized over contract years if option to buy exists
        if deal.has_option_to_buy and deal.option_to_buy_fee and deal.option_contract_years:
            baseline_amort += amortization_for_season(
                fee=deal.option_to_buy_fee,
                contract_years=deal.option_contract_years,
                acquisition_year=deal.loan_start_date.year if deal.loan_start_date else start_year,
                target_season_year=start_year,
            )
        sources_used.add(f"loan_in_{deal.set_by_role}")

    # Build player lookup map for simulation (by api_football_id)
    player_map = {p.api_football_id: p for p in players + loaned_in_players}

    #  Simulation overlay
    sim = None
    net_spend = 0.0
    loan_fee_impact = 0.0
    extra_wages = 0.0
    extra_amort = 0.0
    sell_wages = 0.0
    sell_amort_relief = 0.0
    sell_profit_loss = 0.0

    if sim_id:
        from beanie import PydanticObjectId
        try:
            sim = await TransferSimulation.get(PydanticObjectId(sim_id))
        except Exception:
            raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")

        if sim.club_api_football_id != api_football_id:
            raise HTTPException(
                status_code=400,
                detail=f"Simulation {sim_id} belongs to club {sim.club_api_football_id}",
            )

        # Buys
        for b in sim.buys:
            extra_wages += b.annual_salary
            extra_amort += calculate_annual_amortization(b.transfer_fee, b.contract_length_years)
            net_spend += b.transfer_fee

        # Sells — use ctx for financials (no extra DB calls)
        for s in sim.sells:
            sell_player = player_map.get(s.api_football_player_id) if s.api_football_player_id else None
            if sell_player:
                sal, yrs, fee, acq, src, _ = _effective_wage(
                    sell_player, ctx, is_sd, viewer_id, start_year
                )
                sell_wages += sal
                if fee > 0 and yrs > 0 and acq > 0:
                    sell_amort_relief += amortization_for_season(
                        fee=fee, contract_years=yrs,
                        acquisition_year=acq, target_season_year=start_year,
                    )
                    sell_profit_loss += book_profit_or_loss(
                        s.transfer_fee, fee, yrs, start_year - acq
                    )
                else:
                    sell_profit_loss += s.transfer_fee
            else:
                sell_wages += s.annual_salary
                sell_amort_relief += calculate_annual_amortization(
                    s.transfer_fee, s.contract_length_years
                )
                sell_profit_loss += s.transfer_fee
            net_spend -= s.transfer_fee

        # Loans in
        for li in sim.loans_in:
            extra_wages += li.annual_salary * (li.wage_contribution_pct / 100)
            extra_amort += calculate_annual_amortization(li.loan_fee, li.contract_length_years)
            loan_fee_impact += li.loan_fee
            net_spend += li.loan_fee

        # Loans out — use ctx for salary (no extra DB calls)
        for lo in sim.loans_out:
            lo_player = player_map.get(lo.api_football_player_id) if lo.api_football_player_id else None
            if lo_player:
                full_sal, _, _, _, _, _ = _effective_wage(
                    lo_player, ctx, is_sd, viewer_id, start_year
                )
            else:
                full_sal = lo.annual_salary
            sell_wages += full_sal * ((100 - lo.wage_contribution_pct) / 100)
            loan_fee_impact -= lo.loan_fee_received
            net_spend -= lo.loan_fee_received

    #  Final totals 
    total_wages = max(baseline_wages + extra_wages - sell_wages, 0.0)
    total_amort = max(baseline_amort + extra_amort - sell_amort_relief, 0.0)
    current_scr = squad_cost_ratio_calc(annual_revenue, total_wages, total_amort)
    current_squad_cost = total_wages + total_amort
    current_status_str = ffp_status_from_ratio(current_scr)

    # Per-year wage bills — accounts for expiring contracts, extensions, loan end dates
    per_year_wages = _compute_yearly_wage_bill(
        active_players=active_players,
        loaned_in_players=loaned_in_players,
        loan_in_by_player=loan_in_by_player,
        ctx=ctx,
        is_sd=is_sd,
        viewer_id=viewer_id,
        projection_years=3,
        start_year=start_year,
    )

    # Apply simulation wage delta to year 1 of per-year projections
    # (per_year_wages is baseline only; sim buys/sells shift year 1)
    if per_year_wages and sim:
        sim_wage_delta = extra_wages - sell_wages  # net wage change from transfers
        per_year_wages[0] = max(per_year_wages[0] + sim_wage_delta, 0.0)

    projections, overall = build_projections(
        base_revenue=annual_revenue,
        base_wage_bill=total_wages,
        base_amortization=total_amort,
        net_spend_year1=net_spend,
        loan_fee_impact_year1=loan_fee_impact,
        projection_years=3,
        start_year=start_year,
        sell_profit_loss_year1=sell_profit_loss,
        per_year_wage_bills=per_year_wages,
    )

    proj_models = [
        YP(
            year=p.year, revenue=p.revenue, wage_bill=p.wage_bill,
            amortization=p.amortization, squad_cost=p.squad_cost,
            squad_cost_ratio=p.squad_cost_ratio,
            net_transfer_spend=p.net_transfer_spend,
            operating_result=p.operating_result, ffp_status=p.ffp_status,
        )
        for p in projections
    ]

    color_map = {"HIGH_RISK": "red", "WARNING": "amber", "SAFE": "green"}
    badge_map = {"HIGH_RISK": "🚨", "WARNING": "⚠️", "SAFE": "✅"}

    current_ffp = FFPStatus(
        status=current_status_str,
        color=color_map.get(current_status_str, "green"),
        badge=badge_map.get(current_status_str, "✅"),
        reason="",
        squad_cost_ratio=current_scr,
        break_even_result=0.0,
        break_even_ok=current_scr <= 0.70,
    )

    if "sd_override" in sources_used or any("sd_" in s for s in sources_used):
        salary_data_source = "sd_override"
    elif "admin_override" in sources_used or any("admin_" in s for s in sources_used):
        salary_data_source = "admin_override"
    elif "capology_estimate" in sources_used:
        salary_data_source = "capology_estimate"
    elif "groq_estimate" in sources_used:
        salary_data_source = "groq_estimate"
    else:
        salary_data_source = "position_estimate"

    return FFPDashboardResponse(
        club_id=str(club.id),
        club_name=club.name,
        annual_revenue=annual_revenue,
        season_year=start_year,
        salary_data_source=salary_data_source,
        current_wage_bill=round(total_wages, 2),
        current_amortization=round(total_amort, 2),
        current_squad_cost=round(current_squad_cost, 2),
        current_squad_cost_ratio=round(current_scr, 4),
        current_ffp_status=current_ffp,
        projections=proj_models,
        revenue_configured=club.revenue_configured or (annual_revenue > 0),
        simulation_id=str(sim.id) if sim else None,
        simulation_name=sim.simulation_name if sim else None,
        baseline_wage_bill=round(baseline_wages, 2) if sim else None,
        simulation_extra_wages=round(extra_wages, 2) if sim else None,
        simulation_wage_relief=round(sell_wages, 2) if sim else None,
        simulation_net_spend=round(net_spend, 2) if sim else None,
    )