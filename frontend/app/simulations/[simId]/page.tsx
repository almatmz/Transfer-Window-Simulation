"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { simulationsApi, clubsApi, CURRENT_SEASON } from "@/lib/api/client";
import type { SimulationResponse, PlayerData } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Modal,
  FFPBadge,
  Card,
  Skeleton,
} from "@/components/ui";
import { formatEur, formatDate, friendlyError } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  Settings,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { TransferForm } from "@/components/simulation/TransferForm";
import { SimulatedSquad } from "@/components/simulation/SimulatedSquad";

const TRANSFER_TABS = [
  { id: "buys", label: "🟢 Buys" },
  { id: "sells", label: "🔴 Sells" },
  { id: "loans_in", label: "🔵 Loans In" },
  { id: "loans_out", label: "🟠 Loans Out" },
];

export default function SimDetailPage() {
  const { simId } = useParams<{ simId: string }>();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("buys");
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  const {
    data: sim,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sim", simId],
    queryFn: () => simulationsApi.get(simId),
    enabled: !!simId && !!isAuthenticated,
    staleTime: 1000 * 30,
  });

  const { data: clubSquadData } = useQuery({
    queryKey: ["squad", sim?.club_api_football_id, CURRENT_SEASON],
    queryFn: () => clubsApi.squad(sim!.club_api_football_id, CURRENT_SEASON),
    enabled: !!sim?.club_api_football_id,
    staleTime: 1000 * 60 * 10,
  });
  const clubSquad: PlayerData[] =
    (clubSquadData as any)?.players ??
    (Array.isArray(clubSquadData) ? clubSquadData : []);

  const delMutation = useMutation({
    mutationFn: (idx: number) => {
      if (activeTab === "buys") return simulationsApi.removeBuy(simId, idx);
      if (activeTab === "sells") return simulationsApi.removeSell(simId, idx);
      if (activeTab === "loans_in")
        return simulationsApi.removeLoanIn(simId, idx);
      return simulationsApi.removeLoanOut(simId, idx);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sim", simId] });
      qc.removeQueries({ queryKey: ["sim-squad", simId] });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  if (loading || (!isAuthenticated && !loading)) return <PageLoader />;
  if (isLoading)
    return (
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (error || !sim)
    return (
      <ErrorMessage
        message={friendlyError((error as Error)?.message ?? "Not found")}
      />
    );

  const currentList: any[] = (sim as any)[activeTab] || [];

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/simulations"
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors mt-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="font-display font-bold text-xl truncate">
              {sim.simulation_name}
            </h1>
            <FFPBadge status={sim.overall_ffp_status} />
            {sim.used_salary_overrides && (
              <Badge variant="violet">Real salaries</Badge>
            )}
            {sim.is_public && <Badge variant="info">Public</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {sim.club_name} · {sim.window_type === "summer" ? "☀️" : "❄️"}{" "}
            {sim.season} · Updated {formatDate(sim.updated_at)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/ffp/${sim.club_api_football_id}?sim=${simId}`}>
            <Button
              variant="outline"
              size="sm"
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              className="hidden sm:flex"
            >
              FFP Impact
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings className="w-3.5 h-3.5" />}
            onClick={() => setRenameOpen(true)}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Buys",
            value: formatEur(sim.total_buy_fees, true),
            sub: `${sim.buys.length} players`,
            color: "text-emerald-500",
          },
          {
            label: "Sells",
            value: formatEur(sim.total_sell_fees, true),
            sub: `${sim.sells.length} players`,
            color: "text-red-500",
          },
          {
            label: "Loans",
            value: formatEur(sim.total_loan_fees_paid, true),
            sub: `${sim.loans_in.length} in · ${sim.loans_out.length} out`,
            color: "text-violet-500",
          },
          {
            label: "Net Spend",
            value: formatEur(sim.net_spend, true),
            sub: "Total outlay",
            color: sim.net_spend > 0 ? "text-red-500" : "text-emerald-500",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-card border border-border rounded-2xl p-4 text-center"
          >
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={cn("font-bold text-xl font-display", k.color)}>
              {k.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column: Squad on left, Transfers on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT: Squad view */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Squad View
          </h2>
          <SimulatedSquad simId={simId} sim={sim} />
        </div>

        {/* RIGHT: Transfer tabs */}
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {TRANSFER_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    activeTab === t.id
                      ? "bg-primary text-white shadow-sm shadow-primary/20"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold",
                      activeTab === t.id ? "bg-white/20" : "bg-background",
                    )}
                  >
                    {((sim as any)[t.id] as any[])?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <Button
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditIdx(null);
                setAddOpen(true);
              }}
            >
              Add{" "}
              {activeTab === "buys"
                ? "Buy"
                : activeTab === "sells"
                  ? "Sell"
                  : activeTab === "loans_in"
                    ? "Loan In"
                    : "Loan Out"}
            </Button>
          </div>

          {/* Transfer list */}
          <div className="space-y-2">
            {currentList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-border border-dashed rounded-2xl">
                <Trophy className="w-7 h-7 mb-2 opacity-20" />
                <p className="text-sm">No {activeTab.replace("_", " ")} yet</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setEditIdx(null);
                    setAddOpen(true);
                  }}
                >
                  Add first
                </Button>
              </div>
            ) : (
              currentList.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 bg-card border border-border rounded-xl hover:border-primary/20 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        {item.player_name}
                      </p>
                      {item.position && <Badge>{item.position}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      {item.age && <span>Age {item.age}</span>}
                      {item.nationality && <span>{item.nationality}</span>}
                      {item.transfer_fee != null && (
                        <span className="text-emerald-500 font-medium">
                          Fee: {formatEur(item.transfer_fee, true)}
                        </span>
                      )}
                      {item.loan_fee != null && item.loan_fee > 0 && (
                        <span className="text-violet-500 font-medium">
                          Loan: {formatEur(item.loan_fee, true)}
                        </span>
                      )}
                      {item.loan_fee_received != null &&
                        item.loan_fee_received > 0 && (
                          <span className="text-orange-500 font-medium">
                            Rcvd: {formatEur(item.loan_fee_received, true)}
                          </span>
                        )}
                      {item.annual_salary > 0 && (
                        <span>
                          Salary: {formatEur(item.annual_salary, true)}/yr
                        </span>
                      )}
                      {item.contract_length_years && (
                        <span>{item.contract_length_years}yr</span>
                      )}
                      {item.wage_contribution_pct != null &&
                        item.wage_contribution_pct !== 100 && (
                          <span>{item.wage_contribution_pct}% wages</span>
                        )}
                      {item.has_option_to_buy && (
                        <Badge variant="violet" className="text-[10px]">
                          Option to buy
                        </Badge>
                      )}
                      {item.has_option_to_sell && (
                        <Badge variant="violet" className="text-[10px]">
                          Option to sell
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditIdx(idx);
                        setAddOpen(true);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      className="text-muted-foreground hover:text-destructive"
                      loading={delMutation.isPending}
                      onClick={() => delMutation.mutate(idx)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {addOpen && (
        <TransferForm
          open
          onClose={() => {
            setAddOpen(false);
            setEditIdx(null);
          }}
          simId={simId}
          tab={activeTab}
          editIdx={editIdx}
          editData={editIdx !== null ? currentList[editIdx] : null}
          clubSquad={clubSquad}
        />
      )}
      <RenameModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        sim={sim}
      />
    </div>
  );
}

function RenameModal({
  open,
  onClose,
  sim,
}: {
  open: boolean;
  onClose: () => void;
  sim: SimulationResponse;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: {
      simulation_name: sim.simulation_name,
      window_type: sim.window_type,
      season: sim.season,
      is_public: sim.is_public,
    },
  });
  const onSubmit = async (data: any) => {
    try {
      await simulationsApi.update(sim.id, data);
      qc.invalidateQueries({ queryKey: ["sim", sim.id] });
      toast.success("Updated");
      onClose();
    } catch (e: any) {
      toast.error(friendlyError(e.message));
    }
  };
  const inp =
    "w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  return (
    <Modal open={open} onClose={onClose} title="Edit Simulation" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <label className="block text-xs font-medium mb-1">Name</label>
          <input {...register("simulation_name")} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">Window</label>
            <select
              {...register("window_type")}
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none"
            >
              <option value="summer">☀️ Summer</option>
              <option value="winter">❄️ Winter</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Season</label>
            <input {...register("season")} className={inp} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pub"
            {...register("is_public")}
            className="w-4 h-4 rounded accent-primary"
          />
          <label htmlFor="pub" className="text-sm">
            Make public
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
