import pytest
from app.utils.ffp_calculator import evaluate_ffp_status, build_yearly_projections
from app.utils.amortization import calculate_annual_amortization, amortization_schedule



def test_amortization_basic():
    assert calculate_annual_amortization(60_000_000, 4) == 15_000_000.0


def test_amortization_zero_fee():
    assert calculate_annual_amortization(0, 4) == 0.0


def test_amortization_schedule_sums_to_fee():
    fee = 50_000_000
    years = 5
    schedule = amortization_schedule(fee, years, 2024)
    total = sum(s["charge"] for s in schedule)
    assert abs(total - fee) < 1  


def test_ffp_safe():
    status = evaluate_ffp_status(0.55, 30_000_000)
    assert status.status == "SAFE"
    assert status.color == "green"


def test_ffp_warning():
    status = evaluate_ffp_status(0.72, 30_000_000)
    assert status.status == "WARNING"
    assert status.color == "amber"


def test_ffp_high_risk_wage():
    status = evaluate_ffp_status(0.90, 30_000_000)
    assert status.status == "HIGH_RISK"
    assert status.color == "red"


def test_ffp_high_risk_spend():
    status = evaluate_ffp_status(0.60, 100_000_000)  
    assert status.status == "HIGH_RISK"


def test_projections_length():
    projections = build_yearly_projections(
        base_revenue=500_000_000,
        base_wage_bill=200_000_000,
        base_amortization=30_000_000,
        net_spend=50_000_000,
        projection_years=3,
        season_year=2024,
    )
    assert len(projections) == 3


def test_projections_revenue_grows():
    projections = build_yearly_projections(
        base_revenue=500_000_000,
        base_wage_bill=200_000_000,
        base_amortization=30_000_000,
        net_spend=0,
        projection_years=3,
        season_year=2024,
    )
    assert projections[1].revenue > projections[0].revenue
    assert projections[2].revenue > projections[1].revenue