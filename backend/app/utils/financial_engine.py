"""
FinancialEngine — single source of truth for all FFP calculations.

Formulas used:
  amortization_per_year  = acquisition_fee / contract_length_years
  remaining_book_value   = amortization_per_year × years_remaining
  wage_bill              = SUM(permanent salaries) + SUM(loan_in wage portions)
  squad_cost             = wage_bill + total_amortization
  squad_cost_ratio       = squad_cost / revenue
  sell_profit_loss       = transfer_fee - remaining_book_value
  break_even             = SUM(revenue - squad_cost - net_transfer_spend) over 3 years
"""
from dataclasses import dataclass, field
from typing import Optional
from app.utils.ffp_rules import (
    build_ffp_status, FFPStatus,
    SQUAD_COST_RATIO_LIMIT, SQUAD_COST_RATIO_WARNING
)


@dataclass
class ContractSnapshot:
    """Minimal data the engine needs per player — does not need full DB model."""
    player_name: str
    annual_salary: float
    acquisition_fee: float
    contract_start_year: int
    contract_expiry_year: int
    is_loan: bool = False
    loan_wage_contribution_pct: float = 100.0   # % YOUR club pays (permanent=100)

    def amortization_per_year(self) -> float:
        if self.is_loan:
            return 0.0
        years = max(self.contract_expiry_year - self.contract_start_year, 1)
        return self.acquisition_fee / years if self.acquisition_fee > 0 else 0.0

    def remaining_book_value(self, current_season: int) -> float:
        if self.is_loan:
            return 0.0
        years_left = max(self.contract_expiry_year - current_season, 0)
        return self.amortization_per_year() * years_left

    def effective_wage(self) -> float:
        """Wage cost to YOUR club after loan contribution split."""
        return self.annual_salary * (self.loan_wage_contribution_pct / 100.0)


@dataclass
class TransferDelta:
    """What a single simulated transfer adds/removes from the financial picture."""
    # BUY
    added_wage: float = 0.0
    added_amortization: float = 0.0
    added_transfer_fee: float = 0.0
    # SELL
    removed_wage: float = 0.0
    removed_amortization: float = 0.0
    sell_fee_received: float = 0.0
    sell_book_value: float = 0.0       # remaining book value at time of sale
    sell_profit_loss: float = 0.0      # transfer_fee - book_value
    # LOAN IN
    loan_in_wage: float = 0.0
    loan_in_fee: float = 0.0
    # LOAN OUT
    loan_out_wage_relief: float = 0.0
    loan_out_fee_received: float = 0.0


@dataclass
class SquadFinancials:
    """Full financial snapshot for a club (optionally with simulation overlay)."""
    revenue: float
    wage_bill: float
    total_amortization: float
    squad_cost: float
    squad_cost_ratio: float
    net_transfer_spend: float
    break_even_result: float
    ffp_status: FFPStatus

    # Breakdown
    permanent_wages: float = 0.0
    loan_in_wages: float = 0.0
    loan_out_relief: float = 0.0

    # Simulation breakdown (only set when sim applied)
    sim_added_wages: float = 0.0
    sim_added_amortization: float = 0.0
    sim_removed_wages: float = 0.0
    sim_net_spend: float = 0.0


@dataclass
class YearProjection:
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float
    net_transfer_spend: float
    operating_result: float
    ffp_status: str    # SAFE | MONITORING | HIGH_RISK
    squad_cost_status: str  # OK | WARNING | VIOLATION


class FinancialEngine:
    """
    Stateless calculation engine. Pass in data, get results back.
    Does NOT touch the database directly.
    """

    @staticmethod
    def amortization_for_buy(transfer_fee: float, contract_years: int) -> float:
        """Annual amortization for a new permanent signing."""
        if transfer_fee <= 0 or contract_years <= 0:
            return 0.0
        return transfer_fee / contract_years

    @staticmethod
    def remaining_book_value(
        acquisition_fee: float,
        contract_start_year: int,
        contract_expiry_year: int,
        current_season: int,
    ) -> float:
        total_years = max(contract_expiry_year - contract_start_year, 1)
        amort_per_year = acquisition_fee / total_years if acquisition_fee > 0 else 0.0
        years_left = max(contract_expiry_year - current_season, 0)
        return amort_per_year * years_left

    @staticmethod
    def sell_profit_loss(transfer_fee: float, book_value: float) -> float:
        return transfer_fee - book_value

    @staticmethod
    def loan_in_wage_cost(annual_salary: float, contribution_pct: float) -> float:
        """Wage cost to your club for a loan-in player."""
        return annual_salary * (contribution_pct / 100.0)

    @staticmethod
    def loan_out_wage_relief(annual_salary: float, contribution_pct: float) -> float:
        """Wage relief from loaning a player out (contribution_pct = % they pay)."""
        return annual_salary * (contribution_pct / 100.0)

    @staticmethod
    def recalculate_amortization_after_extension(
        remaining_book_value: float,
        new_total_years: int,
    ) -> float:
        """
        Contract extension formula:
        Don't create new contract — recalculate amortization over new total length.
        Example: €20M book value, extending for 5 years → 20M/5 = €4M/year
        """
        if new_total_years <= 0:
            return 0.0
        return remaining_book_value / new_total_years

    def calculate_squad_financials(
        self,
        contracts: list[ContractSnapshot],
        revenue: float,
        current_season: int,
        transfer_deltas: Optional[list[TransferDelta]] = None,
        break_even_history: Optional[list[float]] = None,
    ) -> SquadFinancials:
        """
        Core calculation: given a list of contracts + optional simulation deltas,
        return full financial picture.
        """
        if revenue <= 0:
            raise ValueError("Revenue must be > 0 to calculate FFP metrics.")

        # ── Baseline from real contracts ──────────────────────────────────────
        permanent_wages = 0.0
        loan_in_wages   = 0.0
        loan_out_relief = 0.0
        total_amort     = 0.0

        for c in contracts:
            if c.is_loan:
                # loan_in: your club pays contribution_pct
                # loan_out: your club pays (100 - contribution_pct)
                # Convention: positive contribution_pct = you pay that % for loan_in
                loan_in_wages += c.effective_wage()
            else:
                permanent_wages += c.annual_salary
                total_amort += c.amortization_per_year()

        wage_bill = permanent_wages + loan_in_wages - loan_out_relief
        squad_cost = wage_bill + total_amort
        net_spend = 0.0

        sim_added_wages = 0.0
        sim_added_amort = 0.0
        sim_removed_wages = 0.0

        # ── Simulation overlay ────────────────────────────────────────────────
        if transfer_deltas:
            for d in transfer_deltas:
                wage_bill   += d.added_wage - d.removed_wage
                wage_bill   += d.loan_in_wage - d.loan_out_wage_relief
                total_amort += d.added_amortization - d.removed_amortization
                net_spend   += d.added_transfer_fee - d.sell_fee_received
                net_spend   += d.loan_in_fee - d.loan_out_fee_received

                sim_added_wages   += d.added_wage + d.loan_in_wage
                sim_added_amort   += d.added_amortization
                sim_removed_wages += d.removed_wage + d.loan_out_wage_relief

            wage_bill   = max(wage_bill, 0.0)
            total_amort = max(total_amort, 0.0)
            squad_cost  = wage_bill + total_amort

        ratio = squad_cost / revenue

        # Break-even (3-year rolling)
        # operating_result = revenue - squad_cost - net_transfer_spend
        current_operating = revenue - squad_cost - net_spend
        if break_even_history:
            three_year = [current_operating] + list(break_even_history[-2:])
        else:
            three_year = [current_operating]
        break_even = sum(three_year)

        status = build_ffp_status(ratio, break_even)

        return SquadFinancials(
            revenue=revenue,
            wage_bill=round(wage_bill, 2),
            total_amortization=round(total_amort, 2),
            squad_cost=round(squad_cost, 2),
            squad_cost_ratio=round(ratio, 4),
            net_transfer_spend=round(net_spend, 2),
            break_even_result=round(break_even, 2),
            ffp_status=status,
            permanent_wages=round(permanent_wages, 2),
            loan_in_wages=round(loan_in_wages, 2),
            loan_out_relief=round(loan_out_relief, 2),
            sim_added_wages=round(sim_added_wages, 2),
            sim_added_amortization=round(sim_added_amort, 2),
            sim_removed_wages=round(sim_removed_wages, 2),
            sim_net_spend=round(net_spend, 2),
        )

    def build_projections(
        self,
        contracts: list[ContractSnapshot],
        revenue: float,
        current_season: int,
        transfer_deltas: Optional[list[TransferDelta]] = None,
        years: int = 3,
        revenue_growth_rate: float = 0.05,
    ) -> list[YearProjection]:
        """
        3-year forward projection.
        - Revenue grows at revenue_growth_rate per year
        - Amortization decreases as contracts expire
        - New buys (from deltas) only applied in year 1
        """
        projections = []
        proj_revenue = revenue

        for i in range(years):
            season = current_season + i
            apply_deltas = transfer_deltas if i == 0 else None

            # Filter out expired contracts
            active = [c for c in contracts if c.contract_expiry_year > season]

            try:
                fin = self.calculate_squad_financials(
                    contracts=active,
                    revenue=proj_revenue,
                    current_season=season,
                    transfer_deltas=apply_deltas,
                )
                status_obj = fin.ffp_status
                projections.append(YearProjection(
                    year=season,
                    revenue=round(proj_revenue, 0),
                    wage_bill=fin.wage_bill,
                    amortization=fin.total_amortization,
                    squad_cost=fin.squad_cost,
                    squad_cost_ratio=fin.squad_cost_ratio,
                    net_transfer_spend=fin.net_transfer_spend if i == 0 else 0.0,
                    operating_result=round(proj_revenue - fin.squad_cost - (fin.net_transfer_spend if i == 0 else 0.0), 2),
                    ffp_status=status_obj.overall_status,
                    squad_cost_status=status_obj.squad_cost_status,
                ))
            except ValueError:
                # Revenue not set — skip
                break

            proj_revenue *= (1 + revenue_growth_rate)

        return projections


engine = FinancialEngine()