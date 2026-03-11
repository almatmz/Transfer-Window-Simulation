"""
Amortization helpers for UEFA FFP.

Key rule:
  Annual charge = transfer_fee / contract_length_years  (straight-line)

When a player is SOLD before contract end:
  - Regular annual amortization STOPS from the sale year onward.
  - Book profit/loss = sale_fee - remaining_book_value
  - remaining_book_value = fee - (annual_charge × seasons_elapsed)
  - This profit/loss is counted as relevant income in the sale season.
"""
from __future__ import annotations


def calculate_annual_amortization(fee: float, contract_years: int) -> float:
    """Annual straight-line amortization charge."""
    if contract_years <= 0 or fee <= 0:
        return 0.0
    return round(fee / contract_years, 2)


def remaining_book_value(
    fee: float,
    contract_years: int,
    seasons_elapsed: int,
) -> float:
    """
    Remaining (unamortized) book value after `seasons_elapsed` seasons.
    Never goes below 0.
    """
    if contract_years <= 0 or fee <= 0:
        return 0.0
    annual = fee / contract_years
    return max(round(fee - annual * seasons_elapsed, 2), 0.0)


def book_profit_or_loss(
    sale_fee: float,
    fee: float,
    contract_years: int,
    seasons_elapsed: int,
) -> float:
    """
    Profit (positive) or loss (negative) on player sale.

    Example:
      Bought for €50M on 5-year contract → €10M/yr amortization.
      Sold after 2 years → remaining book value = €30M.
      Sold for €40M → profit = €40M - €30M = +€10M (relevant income).
      Sold for €20M → loss  = €20M - €30M = -€10M (expense).
    """
    rbv = remaining_book_value(fee, contract_years, seasons_elapsed)
    return round(sale_fee - rbv, 2)


def amortization_for_season(
    fee: float,
    contract_years: int,
    acquisition_year: int,
    target_season_year: int,
    is_sold: bool = False,
    sold_in_year: int = 0,
) -> float:
    """
    Returns the amortization charge applicable for `target_season_year`.

    - Returns 0 if the player was not yet acquired (target < acquisition_year).
    - Returns 0 if the player was sold before target_season_year.
    - Returns 0 if the contract has fully amortized.
    """
    if fee <= 0 or contract_years <= 0:
        return 0.0
    if acquisition_year <= 0:
        return 0.0
    if target_season_year < acquisition_year:
        return 0.0

    # Amortization stops in the season of sale and beyond
    if is_sold and sold_in_year > 0 and target_season_year >= sold_in_year:
        return 0.0

    seasons_elapsed = target_season_year - acquisition_year
    if seasons_elapsed >= contract_years:
        return 0.0  # fully amortized

    return calculate_annual_amortization(fee, contract_years)


def amortization_schedule(
    fee: float,
    contract_years: int,
    start_year: int,
    is_sold: bool = False,
    sold_in_year: int = 0,
    sale_fee: float = 0.0,
) -> list[dict]:
    """
    Full year-by-year schedule. Includes sale profit/loss in the sale year.
    """
    annual = calculate_annual_amortization(fee, contract_years)
    book_value = fee
    schedule = []
    for i in range(contract_years):
        year = start_year + i
        sold_this_year = is_sold and sold_in_year == year
        sold_before = is_sold and sold_in_year > 0 and year >= sold_in_year

        if sold_before and not sold_this_year:
            # Amortization completely stops after sale year
            break

        charge = annual if not sold_before else 0.0
        book_value = max(book_value - charge, 0.0)

        entry: dict = {
            "year": year,
            "charge": charge,
            "book_value_end": round(book_value, 2),
        }
        if sold_this_year:
            pl = book_profit_or_loss(sale_fee, fee, contract_years, i)
            entry["sale_profit_loss"] = pl
            entry["charge"] = charge  # last partial year charge still applies
            schedule.append(entry)
            break  # no more entries after sale

        schedule.append(entry)

    return schedule