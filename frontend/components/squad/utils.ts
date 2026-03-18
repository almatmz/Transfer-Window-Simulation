// ── Player data normalization ─────────────────────────────────

export const POS_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker', 'Unknown'] as const;

export function normalizePosition(pos: string | null | undefined): string {
  if (!pos) return 'Unknown';
  const p = pos.toUpperCase().trim();
  if (['GK','GOALKEEPER'].includes(p)) return 'Goalkeeper';
  if (['CB','LB','RB','LWB','RWB','DF','DEFENDER','BACK','CENTRE-BACK'].includes(p)) return 'Defender';
  if (['CM','CDM','CAM','DM','AM','MF','MIDFIELDER','LM','RM'].includes(p)) return 'Midfielder';
  if (['ST','CF','LW','RW','FW','SS','FORWARD','ATTACKER','STRIKER','WINGER'].includes(p)) return 'Attacker';
  return pos;
}

export function normalizePlayers(arr: any[]): any[] {
  return (arr ?? []).map(p => ({
    ...p,
    annual_salary: p.annual_salary ?? p.estimated_annual_salary ?? null,
    transfer_value: p.transfer_value ?? p.market_value ?? null,
    position: normalizePosition(p.position),
  }));
}

export function deduplicatePlayers(arr: any[]): any[] {
  const ids = new Set<string>();
  const apiIds = new Set<number>();
  return arr.filter(p => {
    if (p.id) { if (ids.has(p.id)) return false; ids.add(p.id); }
    if (p.api_football_id > 0) { if (apiIds.has(p.api_football_id)) return false; apiIds.add(p.api_football_id); }
    return true;
  });
}

export function extractSquad(data: any): { players: any[]; expired: any[] } {
  if (!data) return { players: [], expired: [] };
  const normalize = (a: any[]) => deduplicatePlayers(normalizePlayers(a));

  if (Array.isArray(data)) return { players: normalize(data), expired: [] };

  const PLAYER_KEYS = ['players', 'squad', 'results', 'data', 'items'];
  const EXPIRED_KEYS = ['expired_contracts', 'expired'];

  for (const key of PLAYER_KEYS) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      const expired: any[] = EXPIRED_KEYS.reduce((a: any[], k: string) => Array.isArray(data[k]) ? data[k] : a, [] as any[]);
      return { players: normalize(data[key]), expired: normalize(expired) };
    }
  }
  // Fallback: largest array in object
  let best = '', bestLen = 0, expired: any[] = [];
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    if (EXPIRED_KEYS.includes(key)) { expired = data[key]; continue; }
    if (data[key].length > bestLen) { bestLen = data[key].length; best = key; }
  }
  return best ? { players: normalize(data[best]), expired: normalize(expired) } : { players: [], expired: [] };
}
