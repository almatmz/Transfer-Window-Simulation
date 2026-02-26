def calculate_annual_amortization(acquisition_fee: float, contract_length_years: int) -> float:
    if contract_length_years <= 0 or acquisition_fee <= 0:
        return 0.0
    return round(acquisition_fee / contract_length_years, 2)


def calculate_remaining_book_value(
    acquisition_fee: float,
    contract_length_years: int,
    years_elapsed: int,
) -> float:
    """
    Remaining book value of a player asset on the balance sheet.

    Args:
        acquisition_fee: Total fee paid (EUR)
        contract_length_years: Original contract length
        years_elapsed: Years already served

    Returns:
        Remaining net book value (EUR)
    """
    if contract_length_years <= 0 or acquisition_fee <= 0:
        return 0.0
    annual = calculate_annual_amortization(acquisition_fee, contract_length_years)
    amortized = annual * min(years_elapsed, contract_length_years)
    return round(max(acquisition_fee - amortized, 0.0), 2)


def amortization_schedule(
    acquisition_fee: float,
    contract_length_years: int,
    start_year: int,
) -> list[dict]:
    """
    Full year-by-year amortization schedule.

    """
    annual = calculate_annual_amortization(acquisition_fee, contract_length_years)
    schedule = []
    book_value = acquisition_fee

    for i in range(contract_length_years):
        book_value -= annual
        schedule.append({
            "year": start_year + i,
            "charge": annual,
            "book_value_end": round(max(book_value, 0.0), 2),
        })

    return schedule