"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  simulationsApi,
  clubsApi,
  searchApi,
  CURRENT_SEASON,
} from "@/lib/api/client";
import type { SimulationResponse } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PageLoader,
  ErrorMessage,
  Badge,
  Button,
  Modal,
  FFPBadge,
  Tabs,
  Card,
  Skeleton,
} from "@/components/ui";
import { formatEur, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  Settings,
  Search,
  Loader2,
  X,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "buys", label: "Buys", icon: "🟢" },
  { id: "sells", label: "Sells", icon: "🔴" },
  { id: "loans_in", label: "Loans In", icon: "🔵" },
  { id: "loans_out", label: "Loans Out", icon: "🟠" },
];

// ── Inline player search: searches CLUBS then their squads ────
function PlayerSearchField({
  onSelect,
  placeholder = "Search player by club…",
}: {
  onSelect: (p: {
    name: string;
    position?: string;
    age?: number;
    nationality?: string;
    annual_salary?: number;
    transfer_value?: number;
    api_football_id?: number;
  }) => void;
  placeholder?: string;
}) {
  const [step, setStep] = useState<"club" | "player">("club");
  const [clubQ, setClubQ] = useState("");
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubLoading, setClubLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerQ, setPlayerQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Search clubs
  useEffect(() => {
    if (clubQ.length < 2) {
      setClubs([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setClubLoading(true);
      try {
        setClubs(await searchApi.clubs(clubQ));
      } catch {
      } finally {
        setClubLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [clubQ]);

  const pickClub = async (club: any) => {
    setSelectedClub(club);
    setStep("player");
    setPlayerLoading(true);
    setOpen(true);
    try {
      const data = await clubsApi.squad(club.api_football_id, CURRENT_SEASON);
      const arr = data?.players ?? (Array.isArray(data) ? data : []);
      setPlayers(arr);
    } catch {
      setPlayers([]);
    } finally {
      setPlayerLoading(false);
    }
  };

  const filteredPlayers = playerQ
    ? players.filter((p: any) =>
        p.name?.toLowerCase().includes(playerQ.toLowerCase()),
      )
    : players;

  const reset = () => {
    setStep("club");
    setSelectedClub(null);
    setPlayers([]);
    setClubQ("");
    setPlayerQ("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {step === "club" ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={clubQ}
            onChange={(e) => {
              setClubQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search club to browse players…"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
          />
          {clubLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-medium text-primary shrink-0">
            {selectedClub?.logo_url && (
              <img
                src={selectedClub.logo_url}
                alt=""
                className="w-4 h-4 object-contain"
              />
            )}
            {selectedClub?.name}
            <button onClick={reset} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={playerQ}
              onChange={(e) => {
                setPlayerQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Filter player by name…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {open && step === "club" && clubs.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-56 overflow-y-auto">
          {clubs.slice(0, 8).map((c: any) => (
            <button
              key={c.api_football_id}
              type="button"
              onClick={() => pickClub(c)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
            >
              {c.logo_url && (
                <img
                  src={c.logo_url}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                />
              )}
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.country} · {c.league}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && step === "player" && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in max-h-64 overflow-y-auto">
          {playerLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading squad…
            </div>
          ) : filteredPlayers.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No players found
            </p>
          ) : (
            filteredPlayers.slice(0, 12).map((p: any) => (
              <button
                key={p.api_football_id ?? p.name}
                type="button"
                onClick={() => {
                  onSelect({
                    name: p.name,
                    position: p.position,
                    age: p.age,
                    nationality: p.nationality,
                    annual_salary: p.annual_salary,
                    transfer_value: p.transfer_value,
                    api_football_id: p.api_football_id,
                  });
                  reset();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
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
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.position}
                    {p.age ? ` · ${p.age}` : ""}
                    {p.nationality ? ` · ${p.nationality}` : ""}
                  </p>
                </div>
                {p.transfer_value && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatEur(p.transfer_value, true)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SimDetailPage() {
  const { simId } = useParams<{ simId: string }>();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("buys");
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

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

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  const deleteMutation = useMutation({
    mutationFn: (idx: number) => {
      if (tab === "buys") return simulationsApi.removeBuy(simId, idx);
      if (tab === "sells") return simulationsApi.removeSell(simId, idx);
      if (tab === "loans_in") return simulationsApi.removeLoanIn(simId, idx);
      return simulationsApi.removeLoanOut(simId, idx);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sim", simId] });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading || (!isAuthenticated && !loading)) return <PageLoader />;
  if (isLoading)
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  if (error || !sim)
    return <ErrorMessage message={(error as Error)?.message ?? "Not found"} />;

  const currentList: any[] = (sim as any)[tab] || [];
  const tabsData = TABS.map((t) => ({
    ...t,
    count: ((sim as any)[t.id] as any[])?.length ?? 0,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
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
            >
              FFP
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Buys",
            value: formatEur(sim.total_buy_fees, true),
            sub: `${sim.buys.length} players`,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Total Sells",
            value: formatEur(sim.total_sell_fees, true),
            sub: `${sim.sells.length} players`,
            color: "text-red-500",
          },
          {
            label: "Loans Paid",
            value: formatEur(sim.total_loan_fees_paid, true),
            sub: `${sim.loans_in.length} in / ${sim.loans_out.length} out`,
            color: "text-violet-500",
          },
          {
            label: "Net Spend",
            value: formatEur(sim.net_spend, true),
            sub: "Total outlay",
            color:
              sim.net_spend > 0
                ? "text-red-500"
                : "text-emerald-600 dark:text-emerald-400",
          },
        ].map((k) => (
          <Card key={k.label} className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={cn("font-bold text-lg font-display", k.color)}>
              {k.value}
            </p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* Tabs + Add button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          tabs={tabsData.map((t) => ({
            id: t.id,
            label: `${t.icon} ${t.label}`,
            count: t.count,
          }))}
          active={tab}
          onChange={setTab}
        />
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setEditIdx(null);
            setAddOpen(true);
          }}
        >
          Add{" "}
          {tab === "buys"
            ? "Buy"
            : tab === "sells"
              ? "Sell"
              : tab === "loans_in"
                ? "Loan In"
                : "Loan Out"}
        </Button>
      </div>

      {/* Transfer list */}
      <div className="space-y-2">
        {currentList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No {tab.replace("_", " ")} yet</p>
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
              className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-2xl hover:border-primary/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{item.player_name}</p>
                  {item.position && <Badge>{item.position}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  {item.age && <span>Age {item.age}</span>}
                  {item.nationality && <span>{item.nationality}</span>}
                  {item.transfer_fee != null && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Fee: {formatEur(item.transfer_fee, true)}
                    </span>
                  )}
                  {item.loan_fee != null && (
                    <span className="text-violet-500 font-medium">
                      Loan fee: {formatEur(item.loan_fee, true)}
                    </span>
                  )}
                  {item.loan_fee_received != null && (
                    <span className="text-orange-500 font-medium">
                      Recv: {formatEur(item.loan_fee_received, true)}
                    </span>
                  )}
                  {item.annual_salary && (
                    <span>
                      Salary: {formatEur(item.annual_salary, true)}/yr
                    </span>
                  )}
                  {item.contract_length_years && (
                    <span>{item.contract_length_years}yr contract</span>
                  )}
                  {item.wage_contribution_pct != null && (
                    <span>{item.wage_contribution_pct}% wages</span>
                  )}
                  {item.has_option_to_buy && (
                    <Badge variant="violet">Option to buy</Badge>
                  )}
                  {item.has_option_to_sell && (
                    <Badge variant="violet">Option to sell</Badge>
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
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(idx)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {addOpen && (
        <TransferEntryModal
          open={addOpen}
          onClose={() => {
            setAddOpen(false);
            setEditIdx(null);
          }}
          simId={simId}
          tab={tab}
          editIdx={editIdx}
          editData={editIdx !== null ? currentList[editIdx] : null}
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

// ── Transfer Entry Modal ──────────────────────────────────────
function TransferEntryModal({
  open,
  onClose,
  simId,
  tab,
  editIdx,
  editData,
}: {
  open: boolean;
  onClose: () => void;
  simId: string;
  tab: string;
  editIdx: number | null;
  editData: any;
}) {
  const qc = useQueryClient();
  const isEdit = editIdx !== null;
  const isBuy = tab === "buys",
    isSell = tab === "sells",
    isLoanIn = tab === "loans_in",
    isLoanOut = tab === "loans_out";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<any>({
    defaultValues: editData ?? {
      position: "",
      age: "",
      nationality: "",
      transfer_fee: "",
      loan_fee: "",
      loan_fee_received: "",
      annual_salary: "",
      contract_length_years: 1,
      wage_contribution_pct: 100,
      has_option_to_buy: false,
      has_option_to_sell: false,
    },
    mode: "onSubmit",
  });

  const hasOptionBuy = watch("has_option_to_buy");
  const hasOptionSell = watch("has_option_to_sell");

  const handlePlayerSelect = (p: any) => {
    if (p.name) setValue("player_name", p.name);
    if (p.position) setValue("position", p.position);
    if (p.age) setValue("age", p.age);
    if (p.nationality) setValue("nationality", p.nationality);
    if (p.annual_salary) setValue("annual_salary", p.annual_salary);
    if (p.transfer_value)
      setValue(isBuy ? "transfer_fee" : "transfer_fee", p.transfer_value);
    if (p.api_football_id)
      setValue("api_football_player_id", p.api_football_id);
    toast.success(`Auto-filled: ${p.name}`);
  };

  const n = (v: any) => (v === "" || v == null ? undefined : Number(v));
  const b = (v: any) => v === true || v === "true";

  const onSubmit = async (data: any) => {
    try {
      if (isBuy) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          age: n(data.age) ?? 0,
          nationality: data.nationality || "",
          transfer_fee: n(data.transfer_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          contract_length_years: n(data.contract_length_years) ?? 1,
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editBuy(simId, editIdx!, body)
          : await simulationsApi.addBuy(simId, body);
      } else if (isSell) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          transfer_fee: n(data.transfer_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          contract_length_years: n(data.contract_length_years) ?? 1,
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editSell(simId, editIdx!, body)
          : await simulationsApi.addSell(simId, body);
      } else if (isLoanIn) {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          age: n(data.age) ?? 0,
          loan_fee: n(data.loan_fee) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          wage_contribution_pct: n(data.wage_contribution_pct) ?? 100,
          contract_length_years: n(data.contract_length_years) ?? 1,
          has_option_to_buy: b(data.has_option_to_buy),
          option_to_buy_fee: n(data.option_to_buy_fee),
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editLoanIn(simId, editIdx!, body)
          : await simulationsApi.addLoanIn(simId, body);
      } else {
        const body = {
          player_name: data.player_name,
          position: data.position || "",
          loan_fee_received: n(data.loan_fee_received) ?? 0,
          annual_salary: n(data.annual_salary) ?? 0,
          wage_contribution_pct: n(data.wage_contribution_pct) ?? 100,
          contract_length_years: n(data.contract_length_years) ?? 1,
          has_option_to_sell: b(data.has_option_to_sell),
          option_to_sell_fee: n(data.option_to_sell_fee),
          api_football_player_id: n(data.api_football_player_id),
        };
        isEdit
          ? await simulationsApi.editLoanOut(simId, editIdx!, body)
          : await simulationsApi.addLoanOut(simId, body);
      }
      qc.invalidateQueries({ queryKey: ["sim", simId] });
      toast.success(isEdit ? "Updated" : "Added successfully");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const title = isBuy
    ? "Buy"
    : isSell
      ? "Sell"
      : isLoanIn
        ? "Loan In"
        : "Loan Out";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? "Edit" : "Add"} ${title}`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Player search */}
        {!isEdit && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              {isSell || isLoanOut
                ? "Search your squad or fill manually"
                : "Search any club to find a player (auto-fills fields)"}
            </p>
            <PlayerSearchField onSelect={handlePlayerSelect} />
          </div>
        )}

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Player Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("player_name", { required: true })}
              placeholder="Player name"
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Position</label>
            <input
              {...register("position")}
              placeholder="Midfielder"
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {(isBuy || isLoanIn) && (
            <div>
              <label className="block text-xs font-medium mb-1">Age</label>
              <input
                type="number"
                min="15"
                max="45"
                {...register("age")}
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {isBuy && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Nationality
              </label>
              <input
                {...register("nationality")}
                placeholder="Spanish"
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {(isBuy || isSell) && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Transfer Fee (€) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="0"
                {...register("transfer_fee")}
                placeholder="e.g. 50000000"
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {isLoanIn && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Loan Fee (€)
              </label>
              <input
                type="number"
                min="0"
                {...register("loan_fee")}
                placeholder="0"
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {isLoanOut && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Loan Fee Received (€)
              </label>
              <input
                type="number"
                min="0"
                {...register("loan_fee_received")}
                placeholder="0"
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">
              Annual Salary (€)
            </label>
            <input
              type="number"
              min="0"
              {...register("annual_salary")}
              placeholder="e.g. 3000000"
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Contract Length (years)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              {...register("contract_length_years")}
              placeholder="3"
              className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {(isLoanIn || isLoanOut) && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Wage Contribution %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                {...register("wage_contribution_pct")}
                placeholder="100"
                className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        {/* Option to buy (loan in) */}
        {isLoanIn && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="opt_buy"
                {...register("has_option_to_buy")}
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="opt_buy" className="text-sm font-medium">
                Has option to buy
              </label>
            </div>
            {(hasOptionBuy === true || hasOptionBuy === "true") && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/50 rounded-xl">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Option Fee (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("option_to_buy_fee")}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Option Year
                  </label>
                  <input
                    type="number"
                    {...register("option_to_buy_year")}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Option to sell (loan out) */}
        {isLoanOut && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="opt_sell"
                {...register("has_option_to_sell")}
                className="w-4 h-4 rounded accent-primary"
              />
              <label htmlFor="opt_sell" className="text-sm font-medium">
                Has option/obligation to sell
              </label>
            </div>
            {(hasOptionSell === true || hasOptionSell === "true") && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/50 rounded-xl">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Option Fee (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register("option_to_sell_fee")}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
            {isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Rename Modal ──────────────────────────────────────────────
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
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit Simulation" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <label className="block text-xs font-medium mb-1">Name</label>
          <input
            {...register("simulation_name")}
            className="w-full h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
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
            <input
              {...register("season")}
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none"
            />
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
