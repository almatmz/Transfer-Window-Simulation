"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  clubsApi,
  squadOverridesApi,
  playersApi,
  CURRENT_SEASON,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  ErrorMessage,
  PositionBadge,
  Skeleton,
  Button,
  Badge,
  Modal,
} from "@/components/ui";
import { formatEur, formatDate, friendlyError } from "@/lib/utils";
import {
  Users,
  Lock,
  ArrowLeft,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Edit,
  ArrowRightLeft,
  FileText,
  TrendingUp,
  Shield,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractSquad, POS_ORDER } from "@/components/squad/utils";
import { AddPlayerModal } from "@/components/squad/AddPlayerModal";
import { OverrideModal } from "@/components/player/OverrideModal";
import { ContractModal } from "@/components/player/ContractModal";

// Row helper
function Row({ l, v, hl }: { l: string; v: React.ReactNode; hl?: boolean }) {
  if (v === null || v === undefined || v === "" || v === "—") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{l}</span>
      <span className={cn("font-medium text-right", hl && "text-primary")}>
        {v}
      </span>
    </div>
  );
}

//  Per-player detail panel (loaded on expand)
function PlayerDetailPanel({
  player: squadPlayer,
  isSdOrAdmin,
  isAuthenticated,
  onOverrideClick,
  onExtensionClick,
}: {
  player: any;
  isSdOrAdmin: boolean;
  isAuthenticated: boolean;
  onOverrideClick: () => void;
  onExtensionClick: (ext: any) => void;
}) {
  const apiId = squadPlayer.api_football_id;
  const canFetch = !!apiId && apiId > 0;

  // Fetch live player data — gets overrides applied immediately after save
  const { data: livePlayer } = useQuery({
    queryKey: ["player", apiId],
    queryFn: () => playersApi.get(apiId),
    enabled: canFetch,
    staleTime: 0,
  });

  // Merge: live player data takes priority over squad snapshot
  const player = { ...squadPlayer, ...(livePlayer ?? {}) };

  const { data: loansRaw } = useQuery({
    queryKey: ["player-loans", apiId],
    queryFn: () => playersApi.getLoan(apiId),
    enabled: canFetch && isSdOrAdmin,
    staleTime: 0,
  });

  const { data: extensions } = useQuery({
    queryKey: ["player-contracts", apiId],
    queryFn: () => playersApi.getContractExtension(apiId),
    enabled: canFetch,
    staleTime: 0,
  });

  const loansArr: any[] = Array.isArray(loansRaw)
    ? loansRaw
    : loansRaw && "id" in (loansRaw as any)
      ? [loansRaw]
      : [];
  const activeLoan = loansArr.find((l: any) => l.is_active);
  // New response: { current_contract, effective_contract, extensions[], has_extensions }
  const extData = extensions as any;
  const currentContract = extData?.current_contract ?? null;
  const effectiveContract = extData?.effective_contract ?? null;
  const extensionsList = extData?.extensions ?? [];
  const hasExtension = extData?.has_extensions ?? false;
  const myExt =
    extensionsList.find((e: any) => e.visibility === "only_you") ?? null;
  const adminExt =
    extensionsList.find((e: any) => e.visibility === "everyone") ?? null;
  const activeExtension = adminExt ?? myExt;

  // Override data takes priority for loan status
  const isLoanIn = activeLoan?.loan_direction === "in" || player.is_on_loan;
  const isLoanOut = activeLoan?.loan_direction === "out" || player.loaned_out;

  return (
    <div className="px-4 pb-3 pt-1 bg-secondary/20 border-t border-border/40 space-y-3 animate-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Contract */}
        <div className="space-y-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Contract
          </p>
          <Row
            l="Annual Salary"
            v={
              (player.annual_salary ?? player.estimated_annual_salary)
                ? formatEur(
                    (player.annual_salary ?? player.estimated_annual_salary)!,
                    true,
                  ) + "/yr"
                : null
            }
            hl
          />
          <Row l="Expires" v={player.contract_expiry_year ?? null} />
          <Row
            l="Length"
            v={
              player.contract_length_years
                ? `${player.contract_length_years}yr`
                : null
            }
          />
          <Row
            l="Signed"
            v={
              player.contract_signing_date
                ? formatDate(player.contract_signing_date)
                : null
            }
          />
          <Row
            l="Transfer Value"
            v={
              player.transfer_value
                ? formatEur(player.transfer_value, true)
                : null
            }
          />
        </div>

        {/* Acquisition */}
        <div className="space-y-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Acquisition
          </p>
          <Row
            l="Fee Paid"
            v={
              player.acquisition_fee
                ? formatEur(player.acquisition_fee, true)
                : null
            }
          />
          <Row l="Year" v={player.acquisition_year ?? null} />
          {!player.acquisition_fee && !player.acquisition_year && (
            <p className="text-xs text-muted-foreground italic">
              No acquisition data
            </p>
          )}
        </div>

        {/* Loan status */}
        <div className="space-y-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3" />
            Loan
          </p>
          {!isLoanIn && !isLoanOut && (
            <p className="text-xs text-muted-foreground italic">
              No active loan
            </p>
          )}
          {isLoanIn && (
            <>
              <Row
                l="Status"
                v={<span className="loan-badge text-[9px]">ON LOAN IN</span>}
              />
              <Row
                l="From Club"
                v={
                  player.loan_from_club ||
                  activeLoan?.counterpart_club_name ||
                  null
                }
              />
              <Row
                l="Ends"
                v={
                  player.loan_end_date
                    ? formatDate(player.loan_end_date)
                    : activeLoan?.loan_end_date
                      ? formatDate(activeLoan.loan_end_date)
                      : null
                }
              />
              {/* Show from override fields if no active loan deal */}
              <Row
                l="Loan Fee"
                v={
                  (player.loan_fee || activeLoan?.loan_fee) > 0
                    ? formatEur(player.loan_fee ?? activeLoan?.loan_fee, true)
                    : null
                }
              />
              <Row
                l="Wages"
                v={
                  (player.loan_wage_contribution_pct ??
                    activeLoan?.wage_contribution_pct) != null
                    ? `${player.loan_wage_contribution_pct ?? activeLoan?.wage_contribution_pct}%`
                    : null
                }
              />
              {(player.loan_option_to_buy || activeLoan?.has_option_to_buy) && (
                <Row
                  l="Option to Buy"
                  v={
                    player.loan_option_to_buy_fee ||
                    activeLoan?.option_to_buy_fee
                      ? formatEur(
                          player.loan_option_to_buy_fee ??
                            activeLoan?.option_to_buy_fee,
                          true,
                        )
                      : "Yes"
                  }
                  hl
                />
              )}
            </>
          )}
          {isLoanOut && (
            <>
              <Row
                l="Status"
                v={<span className="loan-badge text-[9px]">LOANED OUT</span>}
              />
              <Row
                l="To Club"
                v={
                  player.loaned_out_to_club ||
                  activeLoan?.counterpart_club_name ||
                  null
                }
              />
              <Row
                l="Ends"
                v={
                  player.loaned_out_end_date
                    ? formatDate(player.loaned_out_end_date)
                    : activeLoan?.loan_end_date
                      ? formatDate(activeLoan.loan_end_date)
                      : null
                }
              />
              <Row
                l="Fee Received"
                v={
                  (player.loaned_out_fee || activeLoan?.loan_fee) > 0
                    ? formatEur(
                        player.loaned_out_fee ?? activeLoan?.loan_fee,
                        true,
                      )
                    : null
                }
              />
              <Row
                l="Wages"
                v={
                  (player.loaned_out_wage_contribution_pct ??
                    activeLoan?.wage_contribution_pct) != null
                    ? `${player.loaned_out_wage_contribution_pct ?? activeLoan?.wage_contribution_pct}%`
                    : null
                }
              />
              {(player.loaned_out_option_to_buy ||
                activeLoan?.has_option_to_buy) && (
                <Row
                  l="Option to Buy Back"
                  v={
                    player.loaned_out_option_to_buy_fee ||
                    activeLoan?.option_to_buy_fee
                      ? formatEur(
                          player.loaned_out_option_to_buy_fee ??
                            activeLoan?.option_to_buy_fee,
                          true,
                        )
                      : "Yes"
                  }
                  hl
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Contract extension */}
      {(hasExtension || currentContract) && (
        <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {hasExtension ? "Extension Proposed" : "Contract"}
          </p>
          {currentContract && (
            <>
              <Row l="Current Expiry" v={currentContract.expiry_year} />
              <Row
                l="Current Salary"
                v={
                  currentContract.annual_salary
                    ? formatEur(currentContract.annual_salary, true) + "/yr"
                    : null
                }
              />
            </>
          )}
          {effectiveContract?.extension_applied && (
            <>
              <Row l="Effective Expiry" v={effectiveContract.expiry_year} hl />
              <Row
                l="Set by"
                v={effectiveContract.extension_set_by?.replace("_", " ")}
              />
            </>
          )}
          {activeExtension && (
            <>
              <Row
                l={
                  activeExtension.visibility === "everyone"
                    ? "👥 Admin proposal"
                    : "🔒 Your proposal"
                }
                v=""
              />
              <Row
                l="New Expiry"
                v={activeExtension.new_contract_expiry_year}
              />
              <Row
                l="New Salary"
                v={
                  activeExtension.new_annual_salary
                    ? formatEur(activeExtension.new_annual_salary, true) + "/yr"
                    : null
                }
              />
              <Row l="Starts" v={activeExtension.extension_start_year} />
              <Row
                l="Signing Bonus"
                v={
                  activeExtension.signing_bonus
                    ? formatEur(activeExtension.signing_bonus, true)
                    : null
                }
              />
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canFetch && (
        <div className="flex justify-end gap-2">
          {isAuthenticated && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onExtensionClick(myExt ?? null)}
            >
              {myExt ? "Update My Extension" : "Propose Extension"}
            </Button>
          )}
          {isSdOrAdmin && (
            <Button
              size="sm"
              variant="outline"
              icon={<Edit className="w-3.5 h-3.5" />}
              onClick={onOverrideClick}
            >
              Edit Player Data
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Player row with expand/collapse ──────────────────────────
function PlayerRow({
  p,
  isSdOrAdmin,
  isAuthenticated,
  onRemove,
  removing,
  clubId,
}: {
  p: any;
  isSdOrAdmin: boolean;
  isAuthenticated: boolean;
  onRemove: (p: any) => void;
  removing: boolean;
  clubId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [activeExtension, setActiveExtension] = useState<any>(null);
  const isOverride =
    p.api_football_id === 0 || p.data_source?.startsWith("squad_override");
  const playerHref =
    p.api_football_id && p.api_football_id > 0
      ? `/players/${p.api_football_id}`
      : null;

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-all",
        isOverride
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-border bg-card",
        expanded && "shadow-sm",
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Avatar */}
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

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {playerHref ? (
              <Link
                href={playerHref}
                className="font-medium text-sm hover:text-primary transition-colors"
              >
                {p.name}
              </Link>
            ) : (
              <span className="font-medium text-sm">{p.name}</span>
            )}
            {p.is_on_loan && (
              <span className="loan-badge text-[9px]">LOAN IN</span>
            )}
            {p.loaned_out && (
              <span className="loan-badge text-[9px]">LOANED OUT</span>
            )}
            {isOverride && (
              <Badge variant="violet" className="text-[9px] py-0">
                Override
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {p.nationality}
            {p.age ? ` · Age ${p.age}` : ""}
          </p>
        </div>

        {/* Salary + expiry */}
        <div className="hidden sm:block text-right shrink-0 mr-1">
          <p className="text-xs font-medium">
            {p.annual_salary ? formatEur(p.annual_salary, true) + "/yr" : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {p.contract_expiry_year
              ? `Exp. ${p.contract_expiry_year}`
              : "No contract"}
          </p>
        </div>

        {/* Position badge */}
        <PositionBadge position={p.position} />

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
          title={expanded ? "Collapse" : "View details"}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Remove button */}
        {isSdOrAdmin && (
          <button
            type="button"
            title="Remove from squad"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(p);
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <PlayerDetailPanel
          player={p}
          isSdOrAdmin={isSdOrAdmin}
          isAuthenticated={isAuthenticated}
          onOverrideClick={() => setOverrideOpen(true)}
          onExtensionClick={(ext) => {
            setActiveExtension(ext);
            setContractOpen(true);
          }}
        />
      )}

      {/* Override modal */}
      {isSdOrAdmin && overrideOpen && p.api_football_id > 0 && (
        <OverrideModal
          open={overrideOpen}
          onClose={() => setOverrideOpen(false)}
          playerId={p.api_football_id}
          player={p}
          clubId={clubId}
        />
      )}
      {/* Contract extension modal */}
      {isAuthenticated && contractOpen && p.api_football_id > 0 && (
        <ContractModal
          open={contractOpen}
          onClose={() => setContractOpen(false)}
          playerId={p.api_football_id}
          existing={activeExtension}
        />
      )}
    </div>
  );
}

// ── Main Squad Page ───────────────────────────────────────────
export default function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { role, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const isSdOrAdmin = role === "sport_director" || role === "admin";
  const [viewSeason, setViewSeason] = useState(CURRENT_SEASON);
  const [posFilter, setPosFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);

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

  // Invalidate so mounted components refetch
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["squad", id] });
    qc.invalidateQueries({ queryKey: ["squad-overrides", id] });
  };

  const deleteOverride = useMutation({
    mutationFn: (ovId: string) => squadOverridesApi.delete(ovId),
    onSuccess: () => {
      invalidate();
      toast.success("Player removed from squad");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
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
      toast.success("Player removed for this season");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  const resetOverrides = useMutation({
    mutationFn: async () => {
      const fresh = await squadOverridesApi.list(id);
      const active = fresh.filter((o: any) => o.is_active);
      const squadData = rawData as any;
      const extraIds: string[] = [];
      [
        ...(squadData?.players ?? []),
        ...(squadData?.admin_additions ?? []),
      ].forEach((p: any) => {
        if (
          p.data_source?.startsWith("squad_override") &&
          p.id &&
          !active.find((o: any) => o.id === p.id)
        )
          extraIds.push(p.id);
      });
      const all = [...active.map((o: any) => o.id), ...extraIds];
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
      else toast.error(friendlyError(e.message));
    },
  });

  const { players, expired } = extractSquad(rawData);

  // Lookup maps
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
    ...POS_ORDER.filter((pos) => players.some((pl) => pl.position === pos)),
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
      const ovId =
        (p.api_football_id > 0
          ? overrideIdByApiId.get(p.api_football_id)
          : undefined) ?? overrideIdByName.get(p.name?.toLowerCase());
      if (ovId) deleteOverride.mutate(ovId);
      else if (p.api_football_id > 0)
        addRemoveOverride.mutate({
          playerId: p.api_football_id,
          playerName: p.name,
        });
      else toast.error("Cannot remove — no player ID");
    }
  };

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
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Season {viewSeason}/{String(viewSeason + 1).slice(2)} ·{" "}
            {players.length} players
            {isSdOrAdmin && (
              <span className="ml-2 text-muted-foreground/60">
                · Click ↕ to view/edit player details
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
                  confirm("Reset all squad overrides? Cannot be undone.") &&
                  resetOverrides.mutate()
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

      {/* Position filter pills */}
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

      {/* Skeletons */}
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

      {error && (
        <ErrorMessage message={friendlyError((error as Error).message)} />
      )}

      {!isLoading && !error && players.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No players found</p>
          <p className="text-xs mt-1">
            Try syncing the club from the club page.
          </p>
        </div>
      )}

      {/* Players grouped by position */}
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
                  <PlayerRow
                    key={p.id ?? p.api_football_id ?? p.name}
                    p={p}
                    isSdOrAdmin={isSdOrAdmin}
                    isAuthenticated={!!isAuthenticated}
                    onRemove={handleRemove}
                    removing={
                      deleteOverride.isPending || addRemoveOverride.isPending
                    }
                    clubId={id}
                  />
                ))}
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
