"use client";
import { useQuery } from "@tanstack/react-query";
import { simulationsApi } from "@/lib/api/client";
import type { SimulationResponse } from "@/lib/api/client";
import { Skeleton } from "@/components/ui";
import { formatEur } from "@/lib/utils";
import {
  TrendingDown,
  ArrowRightLeft,
  Eye,
  ShoppingBag,
  UserCheck,
} from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { extractSquad, normalizePosition } from "@/components/squad/utils";
import { TransferForm } from "./TransferForm";

const POS = ["Goalkeeper", "Defender", "Midfielder", "Attacker", "Unknown"];

//  Transfer status for a player
type TransferStatus =
  | { type: "sold"; item: any }
  | { type: "loaned_out"; item: any }
  | { type: "bought"; item: any }
  | { type: "loaned_in"; item: any }
  | null;

/** Match a squad player against a list of transfer entries */
function matchPlayer(player: any, entries: any[]): any | null {
  const apiId = Number(player.api_football_id);
  const name = player.name?.toLowerCase().trim();
  return (
    entries.find((e) => {
      if (
        apiId > 0 &&
        e.api_football_player_id &&
        e.api_football_player_id === apiId
      )
        return true;
      return e.player_name?.toLowerCase().trim() === name;
    }) ?? null
  );
}

function buildStatus(player: any, sim: SimulationResponse): TransferStatus {
  const sold = matchPlayer(player, sim.sells ?? []);
  if (sold) return { type: "sold", item: sold };
  const loanedOut = matchPlayer(player, sim.loans_out ?? []);
  if (loanedOut) return { type: "loaned_out", item: loanedOut };
  const bought = matchPlayer(player, sim.buys ?? []);
  if (bought) return { type: "bought", item: bought };
  const loanedIn = matchPlayer(player, sim.loans_in ?? []);
  if (loanedIn) return { type: "loaned_in", item: loanedIn };
  return null;
}

//  Status badge + details strip
function StatusBadge({ status }: { status: TransferStatus }) {
  if (!status) return null;

  const config = {
    sold: {
      label: "SOLD",
      bg: "bg-red-500/15",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/25",
    },
    loaned_out: {
      label: "LOANED OUT",
      bg: "bg-orange-500/15",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/25",
    },
    bought: {
      label: "NEW SIGNING",
      bg: "bg-emerald-500/15",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/25",
    },
    loaned_in: {
      label: "LOAN IN",
      bg: "bg-blue-500/15",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/25",
    },
  }[status.type];

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0",
        config.bg,
        config.text,
        config.border,
      )}
    >
      {config.label}
    </span>
  );
}

/** One-line detail under player name showing key transfer info */
function TransferDetail({ status }: { status: TransferStatus }) {
  if (!status) return null;
  const { type, item } = status;

  const parts: string[] = [];
  if (type === "sold") {
    if (item.transfer_fee)
      parts.push(`Fee: ${formatEur(item.transfer_fee, true)}`);
  } else if (type === "loaned_out") {
    if (item.loan_fee_received)
      parts.push(`Rcvd: ${formatEur(item.loan_fee_received, true)}`);
    if (item.wage_contribution_pct != null)
      parts.push(`${item.wage_contribution_pct}% wages`);
    if (item.has_option_to_sell) parts.push("Option to sell");
  } else if (type === "bought") {
    if (item.transfer_fee)
      parts.push(`Fee: ${formatEur(item.transfer_fee, true)}`);
    if (item.contract_length_years)
      parts.push(`${item.contract_length_years}yr contract`);
  } else if (type === "loaned_in") {
    if (item.loan_fee) parts.push(`Fee: ${formatEur(item.loan_fee, true)}`);
    if (item.wage_contribution_pct != null)
      parts.push(`${item.wage_contribution_pct}% wages`);
    if (item.has_option_to_buy) parts.push("Option to buy");
  }

  if (!parts.length) return null;
  return (
    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
      {parts.join(" · ")}
    </p>
  );
}

interface Props {
  simId: string;
  sim: SimulationResponse;
}

export function SimulatedSquad({ simId, sim }: Props) {
  const [sellPlayer, setSellPlayer] = useState<any>(null);
  const [loanPlayer, setLoanPlayer] = useState<any>(null);

  const {
    data: raw,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sim-squad", simId],
    queryFn: () => simulationsApi.getSimulatedSquad(simId),
    staleTime: 0,
    retry: 1,
  });

  const { players } = extractSquad(raw);

  // Pre-compute status for every player
  const playerStatuses = useMemo(
    () =>
      Object.fromEntries(
        players.map((p) => [
          p.id ?? p.api_football_id ?? p.name,
          buildStatus(p, sim),
        ]),
      ),
    [players, sim],
  );

  const byPos: Record<string, any[]> = {};
  players.forEach((p) => {
    const pos = normalizePosition(p.position) || "Unknown";
    (byPos[pos] ??= []).push(p);
  });

  if (isLoading)
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl text-sm text-destructive">
        Could not load simulated squad.
      </div>
    );

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground">
        <Eye className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
        <span>
          Squad <strong className="text-foreground">after</strong> all transfers
          — {players.length} players. Sold/loaned-out players are greyed and
          locked.
        </span>
      </div>

      {players.length === 0 && (
        <p className="text-center py-8 text-sm text-muted-foreground">
          No squad data returned from server.
        </p>
      )}

      {POS.map((pos) => {
        const group = byPos[pos];
        if (!group?.length) return null;
        return (
          <div key={pos}>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              {pos}s ({group.length})<span className="h-px flex-1 bg-border" />
            </p>
            <div className="space-y-1">
              {group.map((p: any) => {
                const key = p.id ?? p.api_football_id ?? p.name;
                const status = playerStatuses[key];
                const isGone =
                  status?.type === "sold" || status?.type === "loaned_out";

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-xl transition-all",
                      isGone
                        ? "bg-muted/30 border-border/40 opacity-60"
                        : status?.type === "bought"
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : status?.type === "loaned_in"
                            ? "bg-blue-500/5 border-blue-500/20"
                            : "bg-card border-border hover:border-primary/20",
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                      {p.photo_url ? (
                        <Image
                          src={p.photo_url}
                          alt={p.name}
                          width={32}
                          height={32}
                          className="object-cover rounded-full"
                          unoptimized
                        />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {p.name?.[0]}
                        </span>
                      )}
                    </div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={cn(
                            "font-medium text-sm truncate",
                            isGone && "line-through text-muted-foreground",
                          )}
                        >
                          {p.name}
                        </p>
                        <StatusBadge status={status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {p.nationality}
                          {p.age ? ` · ${p.age}` : ""}
                        </p>
                        <TransferDetail status={status} />
                      </div>
                    </div>

                    {/* Salary */}
                    <div className="hidden sm:block text-right text-xs mr-2 shrink-0">
                      <p className="font-medium">
                        {(p.annual_salary ?? p.estimated_annual_salary)
                          ? formatEur(
                              p.annual_salary ?? p.estimated_annual_salary,
                              true,
                            ) + "/yr"
                          : "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {p.contract_expiry_year
                          ? `Exp. ${p.contract_expiry_year}`
                          : ""}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 shrink-0">
                      {isGone ? (
                        // Already transferred — show locked state
                        <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-lg bg-secondary/50">
                          {status?.type === "sold" ? "✓ Sold" : "✓ Out on loan"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSellPlayer(p)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                          >
                            <TrendingDown className="w-3 h-3" />
                            Sell
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoanPlayer(p)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors font-medium"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            Loan
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Transfer forms */}
      {sellPlayer && (
        <TransferForm
          open
          simId={simId}
          tab="sells"
          editIdx={null}
          editData={{
            player_name: sellPlayer.name,
            position: sellPlayer.position,
            annual_salary:
              sellPlayer.annual_salary ?? sellPlayer.estimated_annual_salary,
            api_football_player_id:
              sellPlayer.api_football_id > 0
                ? sellPlayer.api_football_id
                : undefined,
          }}
          clubSquad={[]}
          onClose={() => setSellPlayer(null)}
        />
      )}
      {loanPlayer && (
        <TransferForm
          open
          simId={simId}
          tab="loans_out"
          editIdx={null}
          editData={{
            player_name: loanPlayer.name,
            position: loanPlayer.position,
            annual_salary:
              loanPlayer.annual_salary ?? loanPlayer.estimated_annual_salary,
            api_football_player_id:
              loanPlayer.api_football_id > 0
                ? loanPlayer.api_football_id
                : undefined,
          }}
          clubSquad={[]}
          onClose={() => setLoanPlayer(null)}
        />
      )}
    </div>
  );
}
