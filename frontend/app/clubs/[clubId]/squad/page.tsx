"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { clubsApi, CURRENT_SEASON } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { ErrorMessage, PositionBadge, Skeleton } from "@/components/ui";
import { formatEur } from "@/lib/utils";
import { Users, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const POS_ORDER = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Attacker",
  "Unknown",
];
const ALL_POS = [...POS_ORDER];

// Safely extract players from ANY response shape the backend returns
function extractPlayers(data: any): { players: any[]; expired: any[] } {
  if (!data) return { players: [], expired: [] };

  // Flat array
  if (Array.isArray(data))
    return { players: normalizePlayers(data), expired: [] };

  // Known named keys
  const playerKeys = [
    "players",
    "squad",
    "results",
    "data",
    "items",
    "members",
  ];
  const expiredKeys = ["expired_contracts", "expired", "expired_players"];

  for (const key of playerKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      const expiredArr = expiredKeys.reduce<any[]>(
        (acc, k) => (data[k] && Array.isArray(data[k]) ? data[k] : acc),
        [],
      );
      return {
        players: normalizePlayers(data[key]),
        expired: normalizePlayers(expiredArr),
      };
    }
  }

  // Last resort: find the LARGEST array in the object
  let bestKey = "";
  let bestLen = 0;
  let expiredArr: any[] = [];
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      if (expiredKeys.includes(key)) {
        expiredArr = data[key];
      } else if ((data[key] as any[]).length > bestLen) {
        bestLen = (data[key] as any[]).length;
        bestKey = key;
      }
    }
  }
  if (bestKey)
    return {
      players: normalizePlayers(data[bestKey]),
      expired: normalizePlayers(expiredArr),
    };

  return { players: [], expired: [] };
}

// Normalize player fields — backend uses different field names than the UI expects
function normalizePlayers(arr: any[]): any[] {
  if (!arr?.length) return [];
  return arr.map((p: any) => ({
    ...p,
    // Salary: backend uses estimated_annual_salary, SD override uses annual_salary
    annual_salary: p.annual_salary ?? p.estimated_annual_salary ?? null,
    // Transfer value
    transfer_value: p.transfer_value ?? p.market_value ?? null,
    // Normalize short position codes to full names
    position: normalizePosition(p.position),
    // Loan: backend uses loaned_out for players loaned OUT from this club
    is_on_loan: p.is_on_loan ?? false,
    loaned_out: p.loaned_out ?? false,
  }));
}

function normalizePosition(pos: string | null | undefined): string {
  if (!pos) return "Unknown";
  const p = pos.toUpperCase().trim();
  // Goalkeeper
  if (p === "GK" || p === "GOALKEEPER" || p === "PORTERO") return "Goalkeeper";
  // Defenders
  if (
    [
      "CB",
      "LB",
      "RB",
      "LWB",
      "RWB",
      "DF",
      "DEFENDER",
      "BACK",
      "CENTRE-BACK",
      "CENTRE BACK",
    ].includes(p)
  )
    return "Defender";
  // Midfielders
  if (
    [
      "CM",
      "CDM",
      "CAM",
      "DM",
      "AM",
      "MF",
      "MIDFIELDER",
      "MIDFIELD",
      "LM",
      "RM",
    ].includes(p)
  )
    return "Midfielder";
  // Attackers
  if (
    [
      "ST",
      "CF",
      "LW",
      "RW",
      "FW",
      "FORWARD",
      "ATTACKER",
      "STRIKER",
      "WINGER",
    ].includes(p)
  )
    return "Attacker";
  // Already a full name
  if (["GOALKEEPER", "DEFENDER", "MIDFIELDER", "ATTACKER"].includes(p))
    return p.charAt(0) + p.slice(1).toLowerCase();
  return pos; // keep original if unknown
}

export default function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role } = useAuth();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const [viewSeason, setViewSeason] = useState(CURRENT_SEASON);
  const [posFilter, setPosFilter] = useState("All");

  const {
    data: rawData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["squad", id, viewSeason],
    queryFn: () => clubsApi.squad(id, viewSeason),
    enabled: !!id,
    staleTime: 1000 * 60 * 10, // 10 min cache
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const { players, expired } = extractPlayers(rawData);

  const allPositions = [
    "All",
    ...POS_ORDER.filter((p) =>
      players.some((pl: any) => (pl.position || "Unknown") === p),
    ),
  ];
  const filtered =
    posFilter === "All"
      ? players
      : players.filter((p: any) => (p.position || "Unknown") === posFilter);
  const byPos: Record<string, any[]> = {};
  filtered.forEach((p: any) => {
    const pos = p.position || "Unknown";
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(p);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/clubs/${id}`}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Squad
            {isFetching && !isLoading && (
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse ml-1" />
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Season {viewSeason}/{String(viewSeason + 1).slice(2)} ·{" "}
            {players.length} players
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground hidden sm:block">
            View season:
          </label>
          <select
            value={viewSeason}
            onChange={(e) => setViewSeason(Number(e.target.value))}
            className="h-8 px-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {Array.from({ length: 6 }, (_, i) => CURRENT_SEASON + i).map(
              (y) => (
                <option key={y} value={y}>
                  {y}/{String(y + 1).slice(2)}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {/* Position filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {allPositions.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              posFilter === pos
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {!isSdOrAdmin && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Salary data is estimated (Capology). Sport Directors & Admins see
          verified salaries.
        </div>
      )}

      {/* Skeleton while loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(11)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
            >
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-10 rounded" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorMessage message={(error as Error).message} />}

      {/* No players found (loaded but empty) */}
      {!isLoading && !error && players.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No players found</p>
          <p className="text-xs mt-1">
            The backend may still be syncing this club's data.
          </p>
          <Link
            href={`/clubs/${id}`}
            className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
          >
            ← Go back to club to trigger a sync
          </Link>
        </div>
      )}

      {/* Player groups by position */}
      {!isLoading &&
        !error &&
        POS_ORDER.map((pos) => {
          const group = byPos[pos];
          if (!group?.length) return null;
          return (
            <div key={pos}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                {pos}s ({group.length})
                <span className="h-px flex-1 bg-border" />
              </h3>
              <div className="space-y-1">
                {group.map((p: any) => (
                  <Link
                    key={p.api_football_id ?? p.id ?? p.player_id ?? p.name}
                    href={
                      p.api_football_id ? `/players/${p.api_football_id}` : "#"
                    }
                    className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                      {p.photo_url ? (
                        <Image
                          src={p.photo_url}
                          alt={p.name}
                          width={36}
                          height={36}
                          className="object-cover rounded-full"
                          unoptimized
                        />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {p.name?.[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        {p.is_on_loan && (
                          <span className="loan-badge shrink-0">LOAN</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.nationality}
                        {p.age ? ` · Age ${p.age}` : ""}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-medium">
                          {p.annual_salary ? (
                            <span
                              className={
                                isSdOrAdmin ? "" : "text-muted-foreground"
                              }
                            >
                              {formatEur(p.annual_salary, true)}/yr
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.contract_expiry_year
                            ? `Exp. ${p.contract_expiry_year}`
                            : "No contract"}
                        </p>
                      </div>
                      <PositionBadge position={p.position} />
                    </div>
                    <div className="flex sm:hidden">
                      <PositionBadge position={p.position} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

      {/* Expired contracts section */}
      {!isLoading && expired.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            Contract expired before {viewSeason} ({expired.length})
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="space-y-1 opacity-50">
            {expired.map((p: any) => (
              <div
                key={p.api_football_id ?? p.name}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
              >
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {p.name?.[0]}
                  </span>
                </div>
                <p className="text-sm line-through text-muted-foreground flex-1">
                  {p.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Exp. {p.contract_expiry_year}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
