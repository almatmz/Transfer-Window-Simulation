from dataclasses import dataclass

# UEFA Thresholds 
SQUAD_COST_RATIO_LIMIT   = 0.70    # violation above this
SQUAD_COST_RATIO_WARNING = 0.65    # warning zone
BREAK_EVEN_LIMIT         = -5_000_000.0    # standard 3-year limit
BREAK_EVEN_EQUITY_LIMIT  = -60_000_000.0   # limit with approved equity injection

# Status strings
OK        = "OK"
WARNING   = "WARNING"
VIOLATION = "VIOLATION"

SAFE       = "SAFE"
MONITORING = "MONITORING"
HIGH_RISK  = "HIGH_RISK"


@dataclass
class FFPStatus:
    squad_cost_ratio: float
    break_even_result: float
    squad_cost_status: str    # OK | WARNING | VIOLATION
    break_even_status: str    # OK | WARNING | VIOLATION
    overall_status: str       # SAFE | MONITORING | HIGH_RISK
    squad_cost_ratio_pct: str = ""   # human label e.g. "46.9%"
    break_even_eur_label: str = ""   # human label e.g. "-€12.0M"

    def __post_init__(self):
        self.squad_cost_ratio_pct = f"{self.squad_cost_ratio:.1%}"
        sign = "+" if self.break_even_result >= 0 else ""
        self.break_even_eur_label = f"{sign}€{self.break_even_result/1_000_000:.1f}M"


def evaluate_squad_cost(ratio: float) -> str:
    if ratio > SQUAD_COST_RATIO_LIMIT:
        return VIOLATION
    if ratio > SQUAD_COST_RATIO_WARNING:
        return WARNING
    return OK


def evaluate_break_even(result: float, has_equity: bool = False) -> str:
    limit = BREAK_EVEN_EQUITY_LIMIT if has_equity else BREAK_EVEN_LIMIT
    if result < limit:
        return VIOLATION
    if result < BREAK_EVEN_LIMIT:
        return WARNING
    return OK


def overall_status(sc_status: str, be_status: str) -> str:
    if VIOLATION in (sc_status, be_status):
        return HIGH_RISK
    if WARNING in (sc_status, be_status):
        return MONITORING
    return SAFE


def build_ffp_status(
    squad_cost_ratio: float,
    break_even_result: float,
    has_equity_injection: bool = False,
) -> FFPStatus:
    sc = evaluate_squad_cost(squad_cost_ratio)
    be = evaluate_break_even(break_even_result, has_equity_injection)
    return FFPStatus(
        squad_cost_ratio=round(squad_cost_ratio, 4),
        break_even_result=round(break_even_result, 0),
        squad_cost_status=sc,
        break_even_status=be,
        overall_status=overall_status(sc, be),
    )