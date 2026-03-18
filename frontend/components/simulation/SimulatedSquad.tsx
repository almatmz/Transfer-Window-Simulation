"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { simulationsApi } from "@/lib/api/client";
import type { SimulationResponse } from "@/lib/api/client";
import { Skeleton } from "@/components/ui";
import { formatEur } from "@/lib/utils";
import { TrendingDown, ArrowRightLeft, Eye } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { extractSquad, normalizePosition } from "@/components/squad/utils";
import { TransferForm } from "./TransferForm";

const POS = ["Goalkeeper", "Defender", "Midfielder", "Attacker", "Unknown"];

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
        Could not load simulated squad. The backend may not support this
        endpoint yet.
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-primary">
        <Eye className="w-3.5 h-3.5 shrink-0" />
        Squad <strong>after</strong> all simulation transfers are applied (
        {players.length} players). Click a player to sell or loan out.
      </div>

      {players.length === 0 && !isLoading && (
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
              {group.map((p: any) => (
                <div
                  key={p.id ?? p.api_football_id ?? p.name}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/20 transition-all"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.nationality}
                      {p.age ? ` · ${p.age}` : ""}
                    </p>
                  </div>
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
                  <div className="flex gap-1 shrink-0">
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
                      Loan Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

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
