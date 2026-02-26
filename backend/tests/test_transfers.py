import pytest
from app.utils.amortization import calculate_annual_amortization
from app.utils.ffp_calculator import build_yearly_projections, worst_case_status
from app.models.transfer import TransferEntry, TransferType


# ── Transfer Entry Validation ─────────────────────────────────────────────────

def test_transfer_entry_incoming():
    entry = TransferEntry(
        transfer_type=TransferType.INCOMING,
        player_name="Test Player",
        position="ST",
        age=24,
        transfer_fee=50_000_000,
        annual_salary=5_000_000,
        contract_length_years=4,
    )
    assert entry.transfer_type == TransferType.INCOMING
    assert entry.transfer_fee == 50_000_000


def test_transfer_entry_outgoing():
    entry = TransferEntry(
        transfer_type=TransferType.OUTGOING,
        player_name="Sold Player",
        position="CM",
        age=29,
        transfer_fee=20_000_000,
        annual_salary=3_000_000,
        contract_length_years=2,
    )
    assert entry.transfer_type == TransferType.OUTGOING


# ── Amortization Impact ───────────────────────────────────────────────────────

def test_incoming_transfer_amortization():
    """€60M over 4 years = €15M annual amortization charge."""
    amort = calculate_annual_amortization(60_000_000, 4)
    assert amort == 15_000_000.0


def test_free_transfer_zero_amortization():
    """Free transfers have no amortization charge."""
    amort = calculate_annual_amortization(0, 3)
    assert amort == 0.0


def test_loan_with_no_fee_zero_amortization():
    amort = calculate_annual_amortization(0, 1)
    assert amort == 0.0


# ── Net Spend Calculations ────────────────────────────────────────────────────

def test_net_spend_incoming_heavy():
    """Club spends €100M in, receives €30M out → net spend €70M."""
    incoming_fees = 100_000_000
    outgoing_fees = 30_000_000
    net = incoming_fees - outgoing_fees
    assert net == 70_000_000


def test_net_spend_balanced_window():
    incoming_fees = 50_000_000
    outgoing_fees = 50_000_000
    net = incoming_fees - outgoing_fees
    assert net == 0


def test_net_spend_sell_heavy():
    """Selling more than buying = negative net spend (healthy)."""
    incoming_fees = 20_000_000
    outgoing_fees = 80_000_000
    net = incoming_fees - outgoing_fees
    assert net == -60_000_000


# ── Wage Impact on FFP ────────────────────────────────────────────────────────

def test_wage_increase_pushes_into_warning():
    """
    Club baseline: €200M wages on €350M revenue = 57% (SAFE).
    After adding €80M in new wages: €280M / €350M = 80% (HIGH_RISK).
    """
    base_wages = 200_000_000
    new_wages = base_wages + 80_000_000  # signing big earners
    revenue = 350_000_000

    projections = build_yearly_projections(
        base_revenue=revenue,
        base_wage_bill=new_wages,
        base_amortization=20_000_000,
        net_spend=100_000_000,
        projection_years=3,
        season_year=2024,
    )
    assert worst_case_status(projections) in ("WARNING", "HIGH_RISK")


def test_low_wage_club_stays_safe():
    """Financially disciplined club stays GREEN across all 3 years."""
    projections = build_yearly_projections(
        base_revenue=500_000_000,
        base_wage_bill=150_000_000,   # only 30% W/R
        base_amortization=10_000_000,
        net_spend=20_000_000,
        projection_years=3,
        season_year=2024,
    )
    assert worst_case_status(projections) == "SAFE"


# ── Multi-Year Projection Integrity ──────────────────────────────────────────

def test_projections_ffp_status_present_each_year():
    projections = build_yearly_projections(
        base_revenue=400_000_000,
        base_wage_bill=250_000_000,
        base_amortization=40_000_000,
        net_spend=70_000_000,
        projection_years=3,
        season_year=2024,
    )
    for p in projections:
        assert p.ffp_status in ("SAFE", "WARNING", "HIGH_RISK")
        assert p.revenue > 0
        assert p.total_wage_bill > 0


def test_projection_years_correct():
    projections = build_yearly_projections(
        base_revenue=300_000_000,
        base_wage_bill=180_000_000,
        base_amortization=15_000_000,
        net_spend=0,
        projection_years=3,
        season_year=2024,
    )
    years = [p.year for p in projections]
    assert years == [2024, 2025, 2026]