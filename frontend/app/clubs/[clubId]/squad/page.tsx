"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clubsApi, squadOverridesApi, CURRENT_SEASON } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  ErrorMessage,
  PositionBadge,
  Skeleton,
  Button,
  Badge,
} from "@/components/ui";
import { formatEur } from "@/lib/utils";
import {
  Users,
  Lock,
  ArrowLeft,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractSquad, POS_ORDER } from "@/components/squad/utils";
import { AddPlayerModal } from "@/components/squad/AddPlayerModal";

export default function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role } = useAuth();
  const qc = useQueryClient();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const [viewSeason, setViewSeason] = useState(CURRENT_SEASON);
  const [posFilter, setPosFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────
  const {
    data: rawData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["squad", id, viewSeason],
    queryFn: () => clubsApi.squad(id, viewSeason),
    enabled: !!id,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: overrides } = useQuery({
    queryKey: ["squad-overrides", id],
    queryFn: () => squadOverridesApi.list(id),
    enabled: !!id && isSdOrAdmin,
    staleTime: 1000 * 30,
  });

  // ── Mutations ──────────────────────────────────────────────
  const invalidate = () => {
    qc.removeQueries({ queryKey: ["squad", id] });
    qc.removeQueries({ queryKey: ["squad-overrides", id] });
  };

  const deleteOverride = useMutation({
    mutationFn: (ovId: string) => squadOverridesApi.delete(ovId),
    onSuccess: () => {
      invalidate();
      toast.success("Player removed from squad");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addRemoveOverride = useMutation({
    mutationFn: ({
      playerId,
      playerName,
    }: {
      playerId: number;
      playerName: string;
    }) =>
      squadOverridesApi.create(id, {
        action: "remove",
        season_year: viewSeason,
        api_football_player_id: playerId,
        player_name: playerName,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Player removed from squad");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetOverrides = useMutation({
    mutationFn: async () => {
      // Collect IDs from both the overrides list AND embedded squad data
      const fromList = (overrides ?? [])
        .filter((o: any) => o.is_active)
        .map((o: any) => o.id);
      const fromSquad: string[] = [];
      const squadData = rawData as any;
      [
        ...(squadData?.players ?? []),
        ...(squadData?.admin_additions ?? []),
      ].forEach((p: any) => {
        if (
          p.data_source?.startsWith("squad_override") &&
          p.id &&
          !fromList.includes(p.id)
        )
          fromSquad.push(p.id);
      });
      const all = [...fromList, ...fromSquad];
      if (!all.length) throw new Error("no_overrides");
      const results = await Promise.allSettled(
        all.map((oid) => squadOverridesApi.delete(oid)),
      );
      return results.filter((r) => r.status === "fulfilled").length;
    },
    onSuccess: (n: number) => {
      invalidate();
      toast.success(`Reset ${n} override${n !== 1 ? "s" : ""}`);
    },
    onError: (e: any) => {
      if (e.message === "no_overrides") toast("No overrides found");
      else toast.error(e.message);
    },
  });

  // ── Derived state ──────────────────────────────────────────
  const { players, expired } = extractSquad(rawData);

  const overrideIdByApiId = new Map<number, string>();
  const overrideIdByName = new Map<string, string>();
  (overrides ?? [])
    .filter((o: any) => o.action === "add" && o.is_active)
    .forEach((o: any) => {
      if (o.api_football_player_id > 0)
        overrideIdByApiId.set(o.api_football_player_id, o.id);
      if (o.player_name)
        overrideIdByName.set(o.player_name.toLowerCase(), o.id);
    });

  const visiblePositions = [
    "All",
    ...POS_ORDER.filter((p) => players.some((pl) => pl.position === p)),
  ];
  const filtered =
    posFilter === "All"
      ? players
      : players.filter((p) => p.position === posFilter);
  const byPos: Record<string, any[]> = {};
  filtered.forEach((p) => {
    const pos = p.position || "Unknown";
    (byPos[pos] ??= []).push(p);
  });

  // ── Handlers ──────────────────────────────────────────────
  const handleRemove = (p: any) => {
    if (
      !confirm(
        `Remove ${p.name} from the ${viewSeason}/${String(viewSeason + 1).slice(2)} squad?`,
      )
    )
      return;
    if (p.data_source?.startsWith("squad_override") && p.id) {
      deleteOverride.mutate(p.id);
    } else {
      const overrideId =
        (p.api_football_id > 0
          ? overrideIdByApiId.get(p.api_football_id)
          : undefined) ?? overrideIdByName.get(p.name?.toLowerCase());
      if (overrideId) deleteOverride.mutate(overrideId);
      else if (p.api_football_id > 0)
        addRemoveOverride.mutate({
          playerId: p.api_football_id,
          playerName: p.name,
        });
      else toast.error("Cannot remove — no player ID");
    }
  };

  // ── Render ─────────────────────────────────────────────────
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
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Season {viewSeason}/{String(viewSeason + 1).slice(2)} ·{" "}
            {players.length} players
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          {isSdOrAdmin && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                loading={resetOverrides.isPending}
                onClick={() =>
                  confirm(
                    "Reset all your squad overrides? This cannot be undone.",
                  ) && resetOverrides.mutate()
                }
              >
                Reset
              </Button>
              <Button
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setAddOpen(true)}
              >
                Add Player
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Position filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {visiblePositions.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              posFilter === pos
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {!isSdOrAdmin && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Salary data is estimated. Sport Directors & Admins see real salaries.
        </div>
      )}

      {/* Loading skeleton */}
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

      {!isLoading && !error && players.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No players found</p>
          <p className="text-xs mt-1">
            Try syncing the club from the club page.
          </p>
        </div>
      )}

      {/* Players by position */}
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
                {group.map((p) => {
                  const isOverride =
                    p.api_football_id === 0 ||
                    p.data_source?.startsWith("squad_override");
                  const playerHref =
                    p.api_football_id > 0
                      ? `/players/${p.api_football_id}`
                      : null;

                  const row = (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-3 bg-card border rounded-xl transition-all",
                        playerHref && "hover:border-primary/30 hover:shadow-sm",
                        isOverride
                          ? "border-violet-500/30 bg-violet-500/5"
                          : "border-border",
                      )}
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
                            {p.name?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.is_on_loan && (
                            <span className="loan-badge">LOAN IN</span>
                          )}
                          {p.loaned_out && (
                            <span className="loan-badge">LOANED OUT</span>
                          )}
                          {isOverride && (
                            <Badge
                              variant="violet"
                              className="text-[10px] py-0"
                            >
                              Override
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.nationality}
                          {p.age ? ` · Age ${p.age}` : ""}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2.5 shrink-0 text-right">
                        <div>
                          <p className="text-xs font-medium">
                            {p.annual_salary ? (
                              formatEur(p.annual_salary, true) + "/yr"
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
                      <div className="sm:hidden">
                        <PositionBadge position={p.position} />
                      </div>
                      {isSdOrAdmin && (
                        <button
                          type="button"
                          title="Remove from squad"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(p);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );

                  return (
                    <div key={p.id ?? p.api_football_id ?? p.name}>
                      {playerHref ? <Link href={playerHref}>{row}</Link> : row}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Expired contracts */}
      {!isLoading && expired.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            Expired before {viewSeason} ({expired.length})
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="space-y-1 opacity-50">
            {expired.map((p) => (
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

      <AddPlayerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clubId={id}
        clubName={(rawData as any)?.club_name}
        season={viewSeason}
      />
    </div>
  );
}
