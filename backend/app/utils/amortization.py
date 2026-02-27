def calculate_annual_amortization(fee: float, contract_years: int) -> float:
    if contract_years <= 0 or fee <= 0:
        return 0.0
    return round(fee / contract_years, 2)


def amortization_schedule(fee: float, contract_years: int, start_year: int) -> list[dict]:
    annual = calculate_annual_amortization(fee, contract_years)
    book_value = fee
    schedule = []
    for i in range(contract_years):
        book_value = max(book_value - annual, 0.0)
        schedule.append({
            "year": start_year + i,
            "charge": annual,
            "book_value_end": round(book_value, 2),
        })
    return schedule